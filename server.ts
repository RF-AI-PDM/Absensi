import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface KnowledgeItemInput {
  id: string;
  title: string;
  category: string;
  content: string;
  tags?: string[];
}

interface OperationalContextInput {
  selectedDate: string;
  selectedMonth: string;
  totalStaff: number;
  presentToday: number;
  onTimeToday: number;
  lateToday: number;
  withinGeofenceToday: number;
  outsideGeofenceToday: number;
  unloggedStaffNames: string[];
  unitBreakdown: Array<{
    code: string;
    name: string;
    region: string;
    activeCount: number;
    radiusMeters: number;
  }>;
  currentUserName?: string;
  currentUserRole?: string;
  officeStart?: string;
  officeEnd?: string;
  graceMinutes?: number;
}

function buildLocalFallbackResponse(
  message: string,
  knowledgeBase: KnowledgeItemInput[],
  ctx: OperationalContextInput
) {
  const q = message.toLowerCase();

  // Check for matching knowledge base articles
  const scoredArticles = knowledgeBase
    .map((item) => {
      let score = 0;
      const titleLower = item.title.toLowerCase();
      const contentLower = item.content.toLowerCase();
      const tagsLower = (item.tags || []).map((t) => t.toLowerCase());

      const words = q
        .replace(/[^a-z0-9\s]/gi, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      for (const word of words) {
        if (titleLower.includes(word)) score += 4;
        if (tagsLower.some((t) => t.includes(word))) score += 3;
        if (contentLower.includes(word)) score += 1;
      }
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const citedArticles = scoredArticles.slice(0, 2).map((s) => s.item.title);

  // Operational status queries
  if (
    q.includes('status') ||
    q.includes('hari ini') ||
    q.includes('hadir') ||
    q.includes('belum absen') ||
    q.includes('rekap') ||
    q.includes('monitoring')
  ) {
    const unitLines = (ctx.unitBreakdown || [])
      .map((u) => `• ${u.code} (${u.name} — ${u.region}): ${u.activeCount} staf bertugas (Radius ${u.radiusMeters}m)`)
      .join('\n');
    const unloggedText =
      ctx.unloggedStaffNames && ctx.unloggedStaffNames.length > 0
        ? `Staf belum check-in (${ctx.unloggedStaffNames.length} orang): ${ctx.unloggedStaffNames.slice(0, 6).join(', ')}.`
        : 'Seluruh staf terdaftar telah melakukan absensi hari ini.';

    return {
      answer:
        `Berikut laporan operasional sistem HADIROT untuk tanggal ${ctx.selectedDate}:\n\n` +
        `1. Ringkasan Kehadiran: Tercatat ${ctx.presentToday} dari ${ctx.totalStaff} staf telah absen (${ctx.onTimeToday} tepat waktu, ${ctx.lateToday} terlambat).\n` +
        `2. Kepatuhan Geofence: ${ctx.withinGeofenceToday} staf berada valid di dalam zona pembangkit, dan ${ctx.outsideGeofenceToday} staf berada di luar zona.\n` +
        `3. Distribusi 4 Unit Pembangkit NTB:\n${unitLines}\n\n` +
        `4. Status Pengingat: ${unloggedText}`,
      citedArticles:
        citedArticles.length > 0
          ? citedArticles
          : ['SOP Absensi Geofence Multi-Unit NTB', 'Profil Operasional 4 Unit Pembangkit IPS'],
      suggestedAction:
        ctx.unloggedStaffNames && ctx.unloggedStaffNames.length > 0
          ? 'SEND_REMINDERS'
          : 'OPEN_MONITORING',
      confidenceCategory: 'Operasional & Geofence',
    };
  }

  // Payroll / Salary queries
  if (
    q.includes('gaji') ||
    q.includes('payroll') ||
    q.includes('tunjangan') ||
    q.includes('potongan') ||
    q.includes('lembur') ||
    q.includes('bpjs') ||
    q.includes('pph')
  ) {
    return {
      answer:
        `Berdasarkan Kebijakan Remunerasi & Penggajian Otomatis HADIROT:\n\n` +
        `• Gaji Pokok Bulanan: Ditetapkan sesuai jabatan dan golongan staf pada profil kepegawaian.\n` +
        `• Tunjangan Kehadiran Harian: Diberikan proporsional berdasarkan jumlah hari hadir aktual (Tunjangan Harian × Hari Hadir).\n` +
        `• Perhitungan Upah Lembur: Dihitung otomatis dari akumulasi jam lembur dikalikan 1,5× tarif jam dasar ((Gaji Pokok / 173 jam) × 1,5).\n` +
        `• Potongan Keterlambatan: Dikenakan apabila staf check-in melewati jam masuk (${ctx.officeStart || '08:30'}) ditambah toleransi (${ctx.graceMinutes ?? 15} menit), sebesar tarif potongan per kejadian.\n` +
        `• Potongan BPJS & PPh21: Diestimasi sebesar 5% dari Gaji Pokok untuk kepatuhan jaminan sosial dan pajak penghasilan.\n\n` +
        `Admin dapat langsung menjalankan sinkronisasi rekap kehadiran bulan ${ctx.selectedMonth} menjadi slip gaji siap bayar.`,
      citedArticles:
        citedArticles.length > 0
          ? citedArticles
          : ['Kebijakan Remunerasi, Tunjangan, Lembur & Potongan Payroll'],
      suggestedAction: 'OPEN_PAYROLL',
      confidenceCategory: 'HR & Penggajian',
    };
  }

  // K3 / Safety / Technical Power Plant queries
  if (
    q.includes('k3') ||
    q.includes('apd') ||
    q.includes('keselamatan') ||
    q.includes('pltu') ||
    q.includes('pltd') ||
    q.includes('jeranjang') ||
    q.includes('ampenan') ||
    q.includes('pringgabaya') ||
    q.includes('taliwang') ||
    q.includes('loto')
  ) {
    return {
      answer:
        `Standar Operasional & K3L Indonesia Power Service (Regional NTB):\n\n` +
        `1. Empat Unit Pembangkit Utama:\n` +
        `   • PLTU Jeranjang (PLTU-JRJ) — Gerung, Lombok Barat: Pembangkit listrik tenaga uap berbahan bakar batubara penyuplai tulang punggung sistem kelistrikan Lombok.\n` +
        `   • PLTD Ampenan (PLTD-AMP) — Mataram: Unit pembangkit diesel strategis penopang beban puncak dan keandalan jaringan kota Mataram.\n` +
        `   • PLTD Pringgabaya (PLTD-PGB) — Lombok Timur: Unit pembangkit penyeimbang tegangan dan keandalan pasokan wilayah timur Pulau Lombok.\n` +
        `   • PLTU Taliwang (PLTU-TLW) — Sumbawa Barat: Unit pembangkit uap penyuplai energi utama kawasan industri dan pemukiman Sumbawa Barat.\n\n` +
        `2. Protokol K3L Wajib:\n` +
        `   • Seluruh personel wajib menggunakan APD lengkap (Safety Helmet, Safety Shoes isolator listrik, Earplug di ruang mesin/turbin, dan Wearpack tahan panas) sebelum melakukan check-in di area unit.\n` +
        `   • Pekerjaan pemeliharaan elektrikal/mekanikal wajib menerapkan prosedur LOTO (Lockout-Tagout) dan mengantongi Job Safety Analysis (JSA) aktif.`,
      citedArticles:
        citedArticles.length > 0
          ? citedArticles
          : [
              'Standar K3L & Prosedur LOTO Area Pembangkit PLTU/PLTD',
              'Profil Operasional 4 Unit Pembangkit IPS',
            ],
      suggestedAction: 'OPEN_MONITORING',
      confidenceCategory: 'SOP & K3 Pembangkit',
    };
  }

  // 2FA / Security queries
  if (q.includes('2fa') || q.includes('totp') || q.includes('otp') || q.includes('keamanan')) {
    return {
      answer:
        `Sistem Keamanan HADIROT menggunakan standar Autentikasi Dua Faktor (2FA) TOTP RFC 6238:\n\n` +
        `• Setiap akun staf dan administrator memiliki kunci rahasia Base32 unik yang menghasilkan token 6 digit berganti setiap 30 detik (HMAC-SHA1).\n` +
        `• Anda dapat memindai URI otpauth pada tab Keamanan & Geofence menggunakan Google Authenticator, Authy, atau Microsoft Authenticator.\n` +
        `• Selain 2FA, sistem menerapkan validasi anti-manipulasi lokasi (Haversine Geofencing) yang menolak absensi apabila koordinat GPS berada di luar ke-4 unit pembangkit resmi.`,
      citedArticles: ['Protokol Keamanan Siber & 2FA TOTP RFC 6238'],
      suggestedAction: 'OPEN_SECURITY',
      confidenceCategory: 'Keamanan 2FA',
    };
  }

  // If matched a custom/specific knowledge base article
  if (scoredArticles.length > 0) {
    const top = scoredArticles[0].item;
    return {
      answer: `Berdasarkan dokumen Basis Pengetahuan Perusahaan **"${top.title}"** (${top.category}):\n\n${top.content}`,
      citedArticles: scoredArticles.slice(0, 3).map((s) => s.item.title),
      suggestedAction: 'NONE',
      confidenceCategory: top.category || 'Pengetahuan Umum Korporat',
    };
  }

  return {
    answer:
      `Halo ${ctx.currentUserName || 'Rekan IPS'}! Saya adalah **Agen Sistem & Bot Pengetahuan HADIROT** untuk operasional Indonesia Power Service (Regional NTB).\n\n` +
      `Saat ini sistem memantau **4 Unit Pembangkit** (PLTU Jeranjang, PLTD Ampenan, PLTD Pringgabaya, dan PLTU Taliwang) dengan **${ctx.presentToday}/${ctx.totalStaff} staf** tercatat hadir pada tanggal ${ctx.selectedDate}.\n\n` +
      `Anda dapat menanyakan kepada saya mengenai:\n` +
      `• **Operasional Real-Time**: Status kehadiran hari ini, daftar staf belum absen, dan audit radius geofence 4 unit.\n` +
      `• **SOP & Pengetahuan Perusahaan**: Aturan pindah tugas antar unit PLTU/PLTD, prosedur K3L & LOTO, serta jam kerja shift.\n` +
      `• **HR & Penggajian**: Simulasi perhitungan gaji pokok, tunjangan harian, lembur, dan potongan keterlambatan.`,
    citedArticles: [
      'Profil Operasional 4 Unit Pembangkit IPS',
      'SOP Absensi Geofence Multi-Unit NTB',
    ],
    suggestedAction: 'OPEN_MONITORING',
    confidenceCategory: 'Pengetahuan Umum Korporat',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/enterprise-agent/chat', async (req, res) => {
    const {
      message = '',
      history = [],
      knowledgeBase = [],
      operationalContext = {},
    } = req.body || {};

    const trimmedMessage = String(message || '').trim();
    if (!trimmedMessage) {
      res.status(400).json({ error: 'Pesan pertanyaan tidak boleh kosong.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const hasValidApiKey =
      Boolean(apiKey) &&
      apiKey !== 'MY_GEMINI_API_KEY' &&
      apiKey !== 'YOUR_API_KEY' &&
      apiKey!.trim().length > 10;

    if (!hasValidApiKey) {
      const fallback = buildLocalFallbackResponse(
        trimmedMessage,
        knowledgeBase,
        operationalContext
      );
      res.json({
        ...fallback,
        engine: 'hadirot-knowledge-engine',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const kbContextText = (knowledgeBase as KnowledgeItemInput[])
        .map(
          (kb, idx) =>
            `[DOKUMEN ${idx + 1}] Judul: ${kb.title} | Kategori: ${kb.category}\nIsi: ${kb.content}`
        )
        .join('\n\n');

      const recentHistoryText = Array.isArray(history)
        ? history
            .slice(-16)
            .map((h: { role?: string; text?: string }) => `${h.role === 'user' ? 'Pengguna' : 'Agen HADIROT'}: ${h.text}`)
            .join('\n')
        : '';

      const systemInstruction = `Anda adalah "Agen Sistem & Bot Pengetahuan HADIROT", asisten cerdas resmi untuk platform manajemen kehadiran geospasial multi-unit dan penggajian Indonesia Power Service (Regional NTB: Lombok & Sumbawa).

TUGAS UTAMA ANDA:
1. Menjadi Bot Pengetahuan Perusahaan (Company Knowledge Base Bot) yang menjawab pertanyaan seputar SOP perusahaan, aturan absensi geofence 4 unit pembangkit (PLTU Jeranjang - Gerung, PLTD Ampenan - Mataram, PLTD Pringgabaya - Lombok Timur, PLTU Taliwang - Sumbawa Barat), kebijakan HR & perhitungan payroll (gaji pokok, tunjangan harian, lembur 1,5x, potongan terlambat, BPJS/PPh21 5%), prosedur K3L pembangkit (APD, LOTO, JSA), serta keamanan 2FA TOTP RFC 6238.
2. Menjadi Agen Operasional Sistem Perusahaan yang menganalisis data real-time kehadiran hari ini dan merekomendasikan tindakan sistem yang tepat (suggestedAction).

DATA OPERASIONAL REAL-TIME SAAT INI:
${JSON.stringify(operationalContext, null, 2)}

BASIS PENGETAHUAN PERUSAHAAN (KNOWLEDGE BASE):
${kbContextText}

ATURAN FORMAT JAWABAN:
- Gunakan Bahasa Indonesia yang profesional, jelas, ringkas, dan terstruktur dengan poin-poin bila relevan.
- Sertakan angka spesifik dari data operasional real-time atau dokumen pengetahuan perusahaan.
- Pilih "suggestedAction" yang paling relevan:
  - "SEND_REMINDERS" jika pengguna membahas staf belum absen atau pengingat.
  - "SYNC_PAYROLL" jika pengguna meminta sinkronisasi/pembuatan slip gaji.
  - "OPEN_PAYROLL" jika pengguna membahas detail gaji/tunjangan/potongan.
  - "OPEN_RECAP" jika pengguna membahas rekap bulanan/skor disiplin.
  - "OPEN_TERMINAL" jika pengguna ingin melakukan check-in/check-out absensi.
  - "OPEN_SECURITY" jika pengguna membahas 2FA TOTP atau pengaturan radius geofence.
  - "EXPORT_PDF" atau "EXPORT_EXCEL" jika pengguna meminta unduh/ekspor laporan.
  - "OPEN_MONITORING" jika pengguna membahas peta, unit PLTU/PLTD, atau monitoring.
  - "NONE" jika hanya tanya jawab informasi umum.`;

      const promptContents = recentHistoryText
        ? `Riwayat Percakapan Sebelumnya:\n${recentHistoryText}\n\nPertanyaan/Perintah Pengguna Saat Ini:\n${trimmedMessage}`
        : trimmedMessage;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptContents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description:
                  'Jawaban lengkap dalam Bahasa Indonesia yang terstruktur dan akurat.',
              },
              citedArticles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Daftar judul dokumen Basis Pengetahuan yang menjadi rujukan.',
              },
              suggestedAction: {
                type: Type.STRING,
                description:
                  'Salah satu dari: NONE, OPEN_MONITORING, OPEN_TERMINAL, OPEN_RECAP, OPEN_PAYROLL, OPEN_SECURITY, SEND_REMINDERS, SYNC_PAYROLL, EXPORT_PDF, EXPORT_EXCEL',
              },
              confidenceCategory: {
                type: Type.STRING,
                description:
                  'Kategori topik: Operasional & Geofence, HR & Penggajian, SOP & K3 Pembangkit, Keamanan 2FA, atau Pengetahuan Umum Korporat',
              },
            },
            required: ['answer', 'citedArticles', 'suggestedAction', 'confidenceCategory'],
          },
        },
      });

      const rawText = response.text || '';
      const parsed = JSON.parse(rawText);

      res.json({
        answer: parsed.answer || 'Berikut informasi dari sistem HADIROT.',
        citedArticles: Array.isArray(parsed.citedArticles) ? parsed.citedArticles : [],
        suggestedAction: parsed.suggestedAction || 'NONE',
        confidenceCategory: parsed.confidenceCategory || 'Pengetahuan Umum Korporat',
        engine: 'gemini-3.8-flash',
      });
    } catch (error) {
      console.error('Gemini Enterprise Agent Error, falling back to local engine:', error);
      const fallback = buildLocalFallbackResponse(
        trimmedMessage,
        knowledgeBase,
        operationalContext
      );
      res.json({
        ...fallback,
        engine: 'hadirot-knowledge-engine',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HADIROT Enterprise Server & Agent API listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
