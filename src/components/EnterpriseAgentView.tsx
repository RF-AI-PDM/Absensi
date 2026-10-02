import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  MapPin,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import {
  AttendanceLog,
  MonthlyRecapItem,
  OfficeConfig,
  PayrollRecord,
  UserProfile,
} from '../types';
import { evaluateMultiUnitGeofence, IPS_POWER_UNITS } from '../utils/geo';

export interface CompanyKnowledgeArticle {
  id: string;
  title: string;
  category:
    | 'Profil & Unit Pembangkit'
    | 'SOP Absensi & Geofence'
    | 'HR & Penggajian'
    | 'K3L & Teknis Pembangkit'
    | 'Keamanan & 2FA';
  summary: string;
  content: string;
  tags: string[];
  updatedDate: string;
  isCustom?: boolean;
}

export type AgentSuggestedAction =
  | 'NONE'
  | 'OPEN_MONITORING'
  | 'OPEN_TERMINAL'
  | 'OPEN_RECAP'
  | 'OPEN_PAYROLL'
  | 'OPEN_SECURITY'
  | 'SEND_REMINDERS'
  | 'SYNC_PAYROLL'
  | 'EXPORT_PDF'
  | 'EXPORT_EXCEL';

interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  fullDate?: string;
  citedArticles?: string[];
  suggestedAction?: AgentSuggestedAction;
  confidenceCategory?: string;
}

const CHAT_HISTORY_STORAGE_KEY = 'hadirot_agent_chat_history_v1';

export const DEFAULT_COMPANY_KNOWLEDGE: CompanyKnowledgeArticle[] = [
  {
    id: 'kb-ips-units',
    title: 'Profil Operasional 4 Unit Pembangkit IPS (Lombok & Sumbawa)',
    category: 'Profil & Unit Pembangkit',
    summary:
      'Daftar titik koordinat resmi, kapasitas operasional, dan wilayah kerja 4 unit pembangkit Indonesia Power Service di NTB.',
    content:
      'Indonesia Power Service (Regional NTB) mengelola 4 unit pembangkit strategis yang terintegrasi dalam radar geospasial HADIROT:\n' +
      '1. PLTU Jeranjang — Gerung (Kode: PLTU-JRJ, Wilayah: Lombok Barat, Koordinat: -8.65750, 116.07470): Pembangkit Listrik Tenaga Uap batubara penyuplai beban dasar utama sistem kelistrikan Pulau Lombok.\n' +
      '2. PLTD Ampenan — Mataram (Kode: PLTD-AMP, Wilayah: Kota Mataram, Koordinat: -8.56720, 116.07780): Unit pembangkit diesel penopang beban puncak dan stabilitas jaringan ibu kota provinsi.\n' +
      '3. PLTD Pringgabaya — Lombok Timur (Kode: PLTD-PGB, Wilayah: Lombok Timur, Koordinat: -8.51460, 116.63440): Unit pembangkit diesel penyeimbang tegangan wilayah timur Pulau Lombok.\n' +
      '4. PLTU Taliwang — Sumbawa Barat (Kode: PLTU-TLW, Wilayah: Sumbawa Barat, Koordinat: -8.76540, 116.84210): Unit pembangkit uap penyuplai energi utama kawasan Sumbawa Barat.',
    tags: ['pltu', 'pltd', 'jeranjang', 'ampenan', 'pringgabaya', 'taliwang', 'koordinat', 'unit'],
    updatedDate: '2026-10-01',
  },
  {
    id: 'kb-sop-geofence',
    title: 'SOP Absensi Geofence Multi-Unit & Perpindahan Tugas Antar Lokasi',
    category: 'SOP Absensi & Geofence',
    summary:
      'Prosedur check-in dan check-out berbasis GPS Haversine, toleransi keterlambatan, serta aturan mutasi/dinas antar 4 unit pembangkit.',
    content:
      '1. Jam Kerja Operasional: Jam masuk standar adalah pukul 08:30 WITA dan jam pulang pukul 17:30 WITA dengan toleransi keterlambatan (grace period) sesuai ketetapan kantor (default 15 menit).\n' +
      '2. Validasi Multi-Unit Otomatis: Staf teknik maupun administrasi yang ditugaskan berpindah antar 4 unit resmi (PLTU Jeranjang, PLTD Ampenan, PLTD Pringgabaya, PLTU Taliwang) tetap tervalidasi "Dalam Geofence" selama berjarak di dalam radius meter unit yang aktif.\n' +
      '3. Proteksi Anti-Manipulasi Luar Wilayah: Sistem secara otomatis memblokir pengajuan Absen Masuk apabila koordinat GPS staf berada di luar ke-4 unit pembangkit (misalnya di wilayah Bali, Jawa, atau luar area penugasan).\n' +
      '4. Kustomisasi Radius Dinamis: Administrator dapat memperluas atau mempersempit zona validasi geofence (50m hingga 3.000m) secara langsung melalui slider kontrol pada sidebar peta.',
    tags: ['sop', 'absensi', 'geofence', 'radius', 'jam masuk', 'terlambat', 'pindah unit', 'gps'],
    updatedDate: '2026-10-01',
  },
  {
    id: 'kb-hr-payroll',
    title: 'Kebijakan Remunerasi, Tunjangan Harian, Lembur & Potongan Payroll',
    category: 'HR & Penggajian',
    summary:
      'Rumus resmi perhitungan Take Home Pay (THP), tunjangan kehadiran, tarif lembur, potongan terlambat, serta BPJS & PPh21.',
    content:
      'Sistem Penggajian HADIROT mengonversi rekapitulasi kehadiran bulanan menjadi Slip Gaji secara transparan dengan rumus berikut:\n' +
      '• Gaji Pokok Bulanan: Sesuai kontrak jabatan masing-masing staf.\n' +
      '• Total Tunjangan Kehadiran: Tunjangan Harian × Jumlah Hari Hadir Aktual (termasuk hadir tepat waktu, terlambat, lembur, atau selesai shift).\n' +
      '• Upah Lembur (Overtime Pay): Akumulasi jam lembur dikalikan 1,5 × tarif jam dasar, di mana tarif jam dasar = Gaji Pokok / 173 jam kerja bulanan.\n' +
      '• Potongan Keterlambatan: Tarif potongan per kejadian × jumlah hari terlambat pada bulan berjalan.\n' +
      '• Potongan BPJS & PPh21: Diestimasi sebesar 5% dari Gaji Pokok.\n' +
      '• Gaji Bersih (Take Home Pay): Gaji Pokok + Total Tunjangan + Upah Lembur − Potongan Terlambat − Potongan BPJS/PPh21.',
    tags: ['gaji', 'payroll', 'tunjangan', 'lembur', 'potongan', 'bpjs', 'pph21', 'slip gaji'],
    updatedDate: '2026-10-01',
  },
  {
    id: 'kb-k3l-pembangkit',
    title: 'Standar K3L (Keselamatan & Kesehatan Kerja) & Prosedur LOTO Pembangkit',
    category: 'K3L & Teknis Pembangkit',
    summary:
      'Kewajiban Alat Pelindung Diri (APD), prosedur Lockout-Tagout (LOTO), dan keselamatan kerja di area turbin, boiler, dan ruang mesin.',
    content:
      'Demi mewujudkan Zero Accident di seluruh lingkungan PLTU dan PLTD Indonesia Power Service:\n' +
      '1. Kewajiban APD: Setiap staf lapangan dan teknisi pemeliharaan wajib mengenakan Safety Helmet sesuai kode warna divisi, Safety Shoes berisolasi listrik, Earplug/Earmuff di area bising (>85 dB seperti ruang mesin PLTD dan turbin PLTU), serta kacamata pelindung dan masker partikulat di area coal yard/boiler.\n' +
      '2. Prosedur LOTO (Lockout-Tagout): Sebelum melakukan inspeksi atau perbaikan pada panel tegangan menengah/tinggi, pompa, maupun katup uap bertekanan, teknisi wajib mengisolasi sumber energi dan memasang gembok/label LOTO resmi.\n' +
      '3. Job Safety Analysis (JSA) & Permit to Work (PTW): Setiap pekerjaan berisiko tinggi (ruang terbatas, ketinggian, pekerjaan panas) wajib memiliki dokumen JSA dan izin kerja aktif sebelum shift dimulai.',
    tags: ['k3', 'k3l', 'apd', 'loto', 'keselamatan', 'turbin', 'boiler', 'teknis', 'sop'],
    updatedDate: '2026-10-01',
  },
  {
    id: 'kb-security-2fa',
    title: 'Protokol Keamanan Siber, Hak Akses Role & 2FA TOTP RFC 6238',
    category: 'Keamanan & 2FA',
    summary:
      'Panduan pengamanan akun menggunakan token 6 digit TOTP 30 detik dan aturan kontrol akses berbasis peran (RBAC) Firestore.',
    content:
      '1. Autentikasi Dua Faktor (2FA TOTP): HADIROT mengimplementasikan algoritma HMAC-SHA1 sesuai standar RFC 6238 dengan siklus token 6 digit setiap 30 detik. Staf dapat mengaktifkan 2FA pada menu Keamanan & Geofence.\n' +
      '2. Kontrol Akses Berjenjang (RBAC): Staf reguler hanya dapat mencatat kehadiran pribadi dan melihat slip gaji miliknya sendiri, sedangkan Administrator memiliki otoritas untuk mengelola profil staf, menyinkronkan penggajian bulanan, mengirim pengingat absensi, dan menyesuaikan radius geofence.\n' +
      '3. Audit Trail & Integritas Waktu: Seluruh pencatatan waktu pembuatan dan pembaruan dokumen absensi divalidasi menggunakan Server Timestamp untuk mencegah manipulasi jam perangkat.',
    tags: ['2fa', 'totp', 'otp', 'keamanan', 'authenticator', 'admin', 'rbac', 'rfc 6238'],
    updatedDate: '2026-10-01',
  },
  {
    id: 'kb-preventive-maintenance',
    title: 'Panduan Pemeliharaan Preventif & Keandalan Operasi Unit (O&M)',
    category: 'K3L & Teknis Pembangkit',
    summary:
      'Standar inspeksi harian operator shift, pencatatan parameter suhu/tekanan, dan pelaporan anomali pada catatan tugas absensi.',
    content:
      '1. Patroli & Inspeksi Shift: Operator PLTU dan PLTD wajib melakukan pengecekan parameter vibrasi, temperatur bearing, tekanan uap/oli, serta level bahan bakar setiap pergantian shift.\n' +
      '2. Pelaporan pada Catatan Absensi: Saat melakukan Absen Masuk maupun Absen Keluar di HADIROT, teknisi dianjurkan mencantumkan ringkasan area kerja pada kolom Catatan Tugas (contoh: "Inspeksi rutin Turbin Unit 1 PLTU Jeranjang" atau "Overhaul berkala Generator PLTD Ampenan").\n' +
      '3. Koordinasi Lintas Unit: Apabila terjadi pemeliharaan besar (Major Overhaul), personel bantuan dari unit lain dapat langsung melakukan check-in di unit tujuan tanpa perlu konfigurasi ulang akun.',
    tags: ['pemeliharaan', 'maintenance', 'operator', 'inspeksi', 'turbin', 'generator', 'catatan'],
    updatedDate: '2026-10-01',
  },
];

const CUSTOM_KB_STORAGE_KEY = 'hadirot_custom_knowledge_v1';

interface EnterpriseAgentViewProps {
  currentUserProfile: UserProfile | null;
  isAdmin: boolean;
  officeConfig: OfficeConfig;
  selectedDate: string;
  selectedMonth: string;
  allUsers: UserProfile[];
  logsForSelectedDate: AttendanceLog[];
  unloggedUsersToday: UserProfile[];
  monthlyRecapItems: MonthlyRecapItem[];
  payrollRecords: PayrollRecord[];
  onNavigateTab: (
    tab: 'monitoring' | 'terminal' | 'recap' | 'payroll' | 'security' | 'agent'
  ) => void;
  onSendBulkReminders: () => Promise<void>;
  onSyncPayrollFromRecap: () => Promise<void>;
  onExportPDF: () => void;
  onExportExcel: () => void;
}

export const EnterpriseAgentView: React.FC<EnterpriseAgentViewProps> = ({
  currentUserProfile,
  isAdmin,
  officeConfig,
  selectedDate,
  selectedMonth,
  allUsers,
  logsForSelectedDate,
  unloggedUsersToday,
  monthlyRecapItems,
  payrollRecords,
  onNavigateTab,
  onSendBulkReminders,
  onSyncPayrollFromRecap,
  onExportPDF,
  onExportExcel,
}) => {
  // Custom knowledge base persisted in localStorage
  const [customArticles, setCustomArticles] = useState<CompanyKnowledgeArticle[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_KB_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_KB_STORAGE_KEY, JSON.stringify(customArticles));
    } catch {
      // ignore
    }
  }, [customArticles]);

  const allKnowledgeArticles = useMemo(
    () => [...customArticles, ...DEFAULT_COMPANY_KNOWLEDGE],
    [customArticles]
  );

  // Knowledge base filter & search state
  const [kbSearch, setKbSearch] = useState('');
  const [kbCategoryFilter, setKbCategoryFilter] = useState<string>('ALL');
  const [showAddKbModal, setShowAddKbModal] = useState(false);
  const [newKbForm, setNewKbForm] = useState<{
    title: string;
    category: CompanyKnowledgeArticle['category'];
    summary: string;
    content: string;
    tagsInput: string;
  }>({
    title: '',
    category: 'SOP Absensi & Geofence',
    summary: '',
    content: '',
    tagsInput: '',
  });

  // Operational metrics for the Agent
  const operationalSummary = useMemo(() => {
    const onTimeToday = logsForSelectedDate.filter(
      (l) =>
        l.status === 'hadir_tepat_waktu' || (l.status === 'selesai_shift' && l.lateMinutes === 0)
    ).length;
    const lateToday = logsForSelectedDate.filter(
      (l) => l.status === 'terlambat' || l.lateMinutes > 0
    ).length;
    const withinGeofenceToday = logsForSelectedDate.filter((l) => l.isWithinGeofence).length;
    const outsideGeofenceToday = logsForSelectedDate.length - withinGeofenceToday;

    const unitBreakdown = IPS_POWER_UNITS.map((unit) => {
      const count = logsForSelectedDate.filter((log) => {
        const evalRes = evaluateMultiUnitGeofence(
          log.latitude,
          log.longitude,
          officeConfig.radiusMeters
        );
        return evalRes.nearestUnit.unitId === unit.unitId;
      }).length;
      return {
        code: unit.code,
        name: unit.name,
        region: unit.region,
        activeCount: count,
        radiusMeters: officeConfig.radiusMeters,
      };
    });

    return {
      selectedDate,
      selectedMonth,
      totalStaff: allUsers.length,
      presentToday: logsForSelectedDate.length,
      onTimeToday,
      lateToday,
      withinGeofenceToday,
      outsideGeofenceToday,
      unloggedStaffNames: unloggedUsersToday.map((u) => u.name),
      unitBreakdown,
      currentUserName: currentUserProfile?.name || 'Staf IPS',
      currentUserRole: isAdmin ? 'Administrator' : 'Karyawan',
      officeStart: officeConfig.shiftStart,
      officeEnd: officeConfig.shiftEnd,
      graceMinutes: officeConfig.lateGraceMinutes,
    };
  }, [
    allUsers.length,
    currentUserProfile?.name,
    isAdmin,
    logsForSelectedDate,
    officeConfig.lateGraceMinutes,
    officeConfig.radiusMeters,
    officeConfig.shiftEnd,
    officeConfig.shiftStart,
    selectedDate,
    selectedMonth,
    unloggedUsersToday,
  ]);

  // Bot chat state with persistent history
  const [messages, setMessages] = useState<AgentChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'welcome-msg',
        role: 'assistant',
        text:
          `Selamat datang di **Agen Sistem Perusahaan & Bot Pengetahuan HADIROT**.\n\n` +
          `Saya terhubung langsung dengan telemetri operasional **4 Unit Pembangkit NTB** (*PLTU Jeranjang*, *PLTD Ampenan*, *PLTD Pringgabaya*, dan *PLTU Taliwang*) serta **${DEFAULT_COMPANY_KNOWLEDGE.length} dokumen Basis Pengetahuan Perusahaan**.\n\n` +
          `Silakan ajukan pertanyaan mengenai SOP perusahaan, perhitungan gaji/lembur, prosedur K3L pembangkit, atau jalankan instruksi agen sistem di bawah ini.`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        fullDate: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
        citedArticles: [
          'Profil Operasional 4 Unit Pembangkit IPS (Lombok & Sumbawa)',
          'SOP Absensi Geofence Multi-Unit & Perpindahan Tugas Antar Lokasi',
        ],
        suggestedAction: 'NONE',
        confidenceCategory: 'Agen Sistem & Basis Pengetahuan',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  const [botTab, setBotTab] = useState<'chat' | 'history'>('chat');
  const [historySearch, setHistorySearch] = useState('');
  const [historyRoleFilter, setHistoryRoleFilter] = useState<'all' | 'user' | 'assistant'>('all');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [agentToast, setAgentToast] = useState<string | null>(null);

  const showAgentToast = (msg: string) => {
    setAgentToast(msg);
    setTimeout(() => setAgentToast(null), 3500);
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(id);
      showAgentToast('Teks berhasil disalin ke papan klip.');
      setTimeout(() => setCopiedMsgId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      showAgentToast('Gagal menyalin teks.');
    }
  };

  const handleClearHistory = () => {
    const freshWelcome: AgentChatMessage = {
      id: `welcome-msg-${Date.now()}`,
      role: 'assistant',
      text:
        `Sesi percakapan baru dimulai.\n\n` +
        `Saya siap membantu menjawab pertanyaan seputar operasional 4 unit pembangkit, SOP absensi, perhitungan gaji, dan K3L. Silakan ajukan pertanyaan Anda.`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      fullDate: selectedDate,
      citedArticles: ['Profil Operasional 4 Unit Pembangkit IPS (Lombok & Sumbawa)'],
      suggestedAction: 'NONE',
      confidenceCategory: 'Agen Sistem & Basis Pengetahuan',
    };
    setMessages([freshWelcome]);
    setShowClearHistoryConfirm(false);
    showAgentToast('Riwayat percakapan berhasil dibersihkan.');
  };

  const handleExportChatHistory = () => {
    if (messages.length === 0) return;
    const header =
      `=================================================================\n` +
      `LOG RIWAYAT PERCAKAPAN — AGEN SISTEM & BOT PENGETAHUAN HADIROT\n` +
      `PT PLN Indonesia Power · Danantara Indonesia\n` +
      `Tanggal Unduh: ${new Date().toLocaleString('id-ID')}\n` +
      `Total Pesan: ${messages.length}\n` +
      `=================================================================\n\n`;

    const body = messages
      .map((m, idx) => {
        const sender = m.role === 'user' ? (currentUserProfile?.name || 'PENGGUNA') : 'AGEN HADIROT';
        const citations =
          m.citedArticles && m.citedArticles.length > 0
            ? `\nRujukan SOP: ${m.citedArticles.join(', ')}`
            : '';
        const action =
          m.suggestedAction && m.suggestedAction !== 'NONE'
            ? `\nRekomendasi Tindakan: ${m.suggestedAction}`
            : '';
        return `[#${idx + 1}] ${sender} (${m.timestamp} · ${m.fullDate || selectedDate})\n${m.text}${citations}${action}\n`;
      })
      .join('\n-----------------------------------------------------------------\n\n');

    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HADIROT_Log_Riwayat_Percakapan_${selectedDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAgentToast('Log riwayat percakapan berhasil diunduh (.txt).');
  };

  const handleReAskQuery = (queryText: string) => {
    setBotTab('chat');
    sendQuestionToBot(queryText);
  };

  const userMessagesCount = useMemo(
    () => messages.filter((m) => m.role === 'user').length,
    [messages]
  );

  const assistantMessagesCount = useMemo(
    () => messages.filter((m) => m.role === 'assistant').length,
    [messages]
  );

  const filteredHistoryMessages = useMemo(() => {
    let list = messages;
    if (historyRoleFilter !== 'all') {
      list = list.filter((m) => m.role === historyRoleFilter);
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter((m) => {
        const textMatch = m.text.toLowerCase().includes(q);
        const timeMatch = m.timestamp.toLowerCase().includes(q);
        const dateMatch = m.fullDate ? m.fullDate.toLowerCase().includes(q) : false;
        const catMatch = m.confidenceCategory ? m.confidenceCategory.toLowerCase().includes(q) : false;
        const citeMatch = m.citedArticles ? m.citedArticles.some((c) => c.toLowerCase().includes(q)) : false;
        return textMatch || timeMatch || dateMatch || catMatch || citeMatch;
      });
    }
    return list;
  }, [messages, historyRoleFilter, historySearch]);

  const recentUserQueries = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user') {
        const text = m.text.trim();
        if (text && !seen.has(text)) {
          seen.add(text);
          list.push(text);
        }
      }
    }
    return list.slice(0, 4);
  }, [messages]);

  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [executingWorkflow, setExecutingWorkflow] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (botTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, botTab]);

  const sendQuestionToBot = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isSending) return;

    const userMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      fullDate: selectedDate,
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/enterprise-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-16).map((m) => ({ role: m.role, text: m.text })),
          knowledgeBase: allKnowledgeArticles.map((kb) => ({
            id: kb.id,
            title: kb.title,
            category: kb.category,
            content: kb.content,
            tags: kb.tags,
          })),
          operationalContext: operationalSummary,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const botMsg: AgentChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: data.answer || 'Informasi berhasil diproses oleh Agen HADIROT.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        fullDate: selectedDate,
        citedArticles: Array.isArray(data.citedArticles) ? data.citedArticles : [],
        suggestedAction: (data.suggestedAction as AgentSuggestedAction) || 'NONE',
        confidenceCategory: data.confidenceCategory || 'Pengetahuan Korporat',
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const fallbackMsg: AgentChatMessage = {
        id: `bot-fallback-${Date.now()}`,
        role: 'assistant',
        text:
          `Berdasarkan data operasional HADIROT tanggal ${selectedDate}, tercatat **${logsForSelectedDate.length}/${allUsers.length} staf** telah melakukan absensi di 4 unit pembangkit NTB (${operationalSummary.withinGeofenceToday} valid di dalam geofence).\n\n` +
          `Gunakan tombol aksi cepat atau telusuri kartu Basis Pengetahuan di sebelah kanan untuk melihat detail SOP perusahaan.`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        fullDate: selectedDate,
        citedArticles: ['SOP Absensi Geofence Multi-Unit & Perpindahan Tugas Antar Lokasi'],
        suggestedAction: 'OPEN_MONITORING',
        confidenceCategory: 'Operasional & Geofence',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestionToBot(chatInput);
  };

  const handleExecuteSuggestedAction = async (action: AgentSuggestedAction) => {
    switch (action) {
      case 'OPEN_MONITORING':
        onNavigateTab('monitoring');
        break;
      case 'OPEN_TERMINAL':
        onNavigateTab('terminal');
        break;
      case 'OPEN_RECAP':
        onNavigateTab('recap');
        break;
      case 'OPEN_PAYROLL':
        onNavigateTab('payroll');
        break;
      case 'OPEN_SECURITY':
        onNavigateTab('security');
        break;
      case 'SEND_REMINDERS':
        setExecutingWorkflow('reminders');
        try {
          await onSendBulkReminders();
        } finally {
          setExecutingWorkflow(null);
        }
        break;
      case 'SYNC_PAYROLL':
        setExecutingWorkflow('payroll');
        try {
          await onSyncPayrollFromRecap();
        } finally {
          setExecutingWorkflow(null);
        }
        break;
      case 'EXPORT_PDF':
        onExportPDF();
        break;
      case 'EXPORT_EXCEL':
        onExportExcel();
        break;
      default:
        break;
    }
  };

  const getSuggestedActionLabel = (action: AgentSuggestedAction): string | null => {
    switch (action) {
      case 'OPEN_MONITORING':
        return 'Buka Peta Monitoring 4 Unit';
      case 'OPEN_TERMINAL':
        return 'Buka Terminal Absensi Masuk/Keluar';
      case 'OPEN_RECAP':
        return 'Buka Rekapitulasi Bulanan';
      case 'OPEN_PAYROLL':
        return 'Buka Modul Slip Gaji & Payroll';
      case 'OPEN_SECURITY':
        return 'Buka Pengaturan 2FA & Geofence';
      case 'SEND_REMINDERS':
        return `Kirim Pengingat ke ${unloggedUsersToday.length} Staf Belum Absen`;
      case 'SYNC_PAYROLL':
        return `Sinkronisasi Rekap ke Slip Gaji (${selectedMonth})`;
      case 'EXPORT_PDF':
        return 'Unduh Laporan PDF Sekarang';
      case 'EXPORT_EXCEL':
        return 'Unduh Laporan Excel (.xlsx)';
      default:
        return null;
    }
  };

  const filteredKnowledge = useMemo(() => {
    return allKnowledgeArticles.filter((article) => {
      const matchesCat = kbCategoryFilter === 'ALL' || article.category === kbCategoryFilter;
      const q = kbSearch.trim().toLowerCase();
      if (!q) return matchesCat;
      const matchesSearch =
        article.title.toLowerCase().includes(q) ||
        article.summary.toLowerCase().includes(q) ||
        article.content.toLowerCase().includes(q) ||
        article.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [allKnowledgeArticles, kbCategoryFilter, kbSearch]);


  const handleAddCustomKnowledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKbForm.title.trim() || !newKbForm.content.trim()) return;

    const tags = newKbForm.tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const created: CompanyKnowledgeArticle = {
      id: `kb-custom-${Date.now()}`,
      title: newKbForm.title.trim(),
      category: newKbForm.category,
      summary:
        newKbForm.summary.trim() ||
        newKbForm.content.trim().slice(0, 140) +
          (newKbForm.content.trim().length > 140 ? '...' : ''),
      content: newKbForm.content.trim(),
      tags: tags.length > 0 ? tags : ['sop', 'perusahaan', 'internal'],
      updatedDate: selectedDate,
      isCustom: true,
    };

    setCustomArticles((prev) => [created, ...prev]);
    setNewKbForm({
      title: '',
      category: 'SOP Absensi & Geofence',
      summary: '',
      content: '',
      tagsInput: '',
    });
    setShowAddKbModal(false);
  };

  const handleDeleteCustomKnowledge = (id: string) => {
    setCustomArticles((prev) => prev.filter((item) => item.id !== id));
  };

  const quickPrompts = [
    'Bagaimana laporan kehadiran & distribusi staf di 4 unit pembangkit hari ini?',
    'Jelaskan SOP absensi geofence saat pindah tugas antar PLTU Jeranjang & PLTD Ampenan',
    'Bagaimana rumus perhitungan gaji pokok, tunjangan harian, lembur, dan potongan terlambat?',
    'Apa saja standar K3L, APD wajib, dan prosedur LOTO di area pembangkit?',
    'Siapa saja staf yang belum check-in hari ini dan bagaimana cara mengirim pengingat?',
  ];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="text-xs text-slate-500">
            Otomasi Operasional Korporat · Basis Pengetahuan Indonesia Power Service
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display mt-0.5">
            Agen Sistem Perusahaan & Bot Pengetahuan HADIROT
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowAddKbModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Dokumen Pengetahuan
          </button>
        </div>
      </div>

      {/* Section 1: Enterprise System Agent Action Center (Otomasi Tugas Sistem) */}
      <div className="border border-slate-200 bg-white rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-700" />
              Pusat Aksi Agen Sistem Perusahaan (One-Click Enterprise Workflows)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Agen memantau kondisi operasional secara real-time dan menyiapkan tindakan otomatis
              untuk kehadiran, kepatuhan geofence, dan penggajian.
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-600">
            Data Aktif: {selectedDate} · {allKnowledgeArticles.length} Dokumen Pengetahuan Terindeks
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Agent Workflow 1: Absent Staff Nudge */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
            <div>
              <div className="text-slate-500 font-mono tabular-nums">
                01 · Agen Disiplin Kehadiran
              </div>
              <div className="font-semibold text-slate-900 text-sm mt-0.5">
                Deteksi & Pengingat Staf Belum Absen
              </div>
              <p className="text-slate-600 mt-1">
                Terdapat{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {unloggedUsersToday.length} staf
                </strong>{' '}
                yang belum melakukan check-in pada tanggal {selectedDate}.
              </p>
            </div>
            <button
              type="button"
              disabled={unloggedUsersToday.length === 0 || executingWorkflow === 'reminders'}
              onClick={() => handleExecuteSuggestedAction('SEND_REMINDERS')}
              className="w-full px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              {executingWorkflow === 'reminders'
                ? 'Mengirim Pengingat...'
                : unloggedUsersToday.length > 0
                ? `Kirim Pengingat (${unloggedUsersToday.length} Staf)`
                : 'Semua Staf Sudah Absen'}
            </button>
          </div>

          {/* Agent Workflow 2: Geofence Multi-Unit Audit */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
            <div>
              <div className="text-slate-500 font-mono tabular-nums">
                02 · Agen Audit Geofence 4 Unit
              </div>
              <div className="font-semibold text-slate-900 text-sm mt-0.5">
                Validasi Zona Radius PLTU/PLTD
              </div>
              <p className="text-slate-600 mt-1">
                <strong className="font-mono tabular-nums text-emerald-700">
                  {operationalSummary.withinGeofenceToday} valid
                </strong>{' '}
                di dalam radius ·{' '}
                <strong className="font-mono tabular-nums text-red-700">
                  {operationalSummary.outsideGeofenceToday} luar radius
                </strong>{' '}
                (Batas {officeConfig.radiusMeters}m).
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                sendQuestionToBot(
                  'Lakukan audit lengkap kepatuhan geofence dan distribusi staf di 4 unit pembangkit hari ini'
                )
              }
              className="w-full px-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Jalankan Analisis Geofence di Bot
            </button>
          </div>

          {/* Agent Workflow 3: Monthly Payroll Sync */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
            <div>
              <div className="text-slate-500 font-mono tabular-nums">
                03 · Agen Otomasi Payroll
              </div>
              <div className="font-semibold text-slate-900 text-sm mt-0.5">
                Sinkronisasi Rekap ke Slip Gaji
              </div>
              <p className="text-slate-600 mt-1">
                Periode{' '}
                <strong className="font-mono tabular-nums text-slate-900">{selectedMonth}</strong>:{' '}
                <span className="font-mono tabular-nums">{payrollRecords.length}</span> dari{' '}
                <span className="font-mono tabular-nums">{monthlyRecapItems.length}</span> slip gaji
                telah tersinkronisasi.
              </p>
            </div>
            {isAdmin ? (
              <button
                type="button"
                disabled={executingWorkflow === 'payroll'}
                onClick={() => handleExecuteSuggestedAction('SYNC_PAYROLL')}
                className="w-full px-3 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-40 transition-colors"
              >
                {executingWorkflow === 'payroll'
                  ? 'Menyinkronkan Payroll...'
                  : 'Sinkronkan Slip Gaji Sekarang'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateTab('payroll')}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Lihat Slip Gaji Saya
              </button>
            )}
          </div>

          {/* Agent Workflow 4: Instant Executive Export */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
            <div>
              <div className="text-slate-500 font-mono tabular-nums">
                04 · Agen Pelaporan Eksekutif
              </div>
              <div className="font-semibold text-slate-900 text-sm mt-0.5">
                Ekspor Dokumen Audit & Gaji
              </div>
              <p className="text-slate-600 mt-1">
                Cetak laporan resmi kehadiran geospasial dan rincian penggajian dalam format PDF
                atau Excel.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onExportPDF}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={onExportExcel}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Split Workspace — Left: Interactive Bot Chat | Right: Company Knowledge Base */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Interactive Enterprise Agent & Knowledge Bot with Scrollable History Log */}
        <div className="lg:col-span-7 border border-slate-200 bg-white rounded-xl flex flex-col overflow-hidden">
          {/* Header with Navigation Tabs */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Asisten Bot Pengetahuan & Agen HADIROT</span>
                  <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h2>
                <p className="text-xs text-slate-300">
                  SOP Perusahaan, K3L Pembangkit, Regulasi Geofence & Analisis Operasional
                </p>
              </div>
            </div>

            {/* Segmented Tab Switcher: Active Chat vs Scrollable History Log */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-lg border border-slate-700/80 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBotTab('chat')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  botTab === 'chat'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Obrolan Aktif</span>
              </button>
              <button
                type="button"
                onClick={() => setBotTab('history')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  botTab === 'history'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title="Buka log riwayat percakapan masa lalu"
              >
                <History className="w-3.5 h-3.5" />
                <span>Log Riwayat</span>
                <span className="font-mono text-[10px] bg-slate-900/80 px-1.5 py-0.5 rounded-full text-slate-200">
                  {messages.length}
                </span>
              </button>
            </div>
          </div>

          {/* VIEW MODE 1: ACTIVE LIVE CHAT */}
          {botTab === 'chat' && (
            <>
              {/* Quick Prompt Suggestions */}
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>Pertanyaan Cepat & Instruksi Agen:</span>
                  <button
                    type="button"
                    onClick={() => setBotTab('history')}
                    className="text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                  >
                    <History className="w-3 h-3" />
                    Lihat Log Riwayat ({messages.length})
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendQuestionToBot(prompt)}
                      disabled={isSending}
                      className="text-left text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {/* Recent User Queries Strip for fast context review */}
                {recentUserQueries.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400 font-medium">Pertanyaan Anda Sebelumnya:</span>
                    {recentUserQueries.map((prevQ, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => sendQuestionToBot(prevQ)}
                        disabled={isSending}
                        title="Klik untuk ajukan lagi"
                        className="truncate max-w-[200px] text-xs px-2 py-0.5 bg-slate-200/70 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                      >
                        "{prevQ}"
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Message Stream */}
              <div className="p-5 space-y-4 h-[440px] overflow-y-auto bg-white">
                {messages.map((msg) => {
                  const actionLabel =
                    msg.suggestedAction && msg.suggestedAction !== 'NONE'
                      ? getSuggestedActionLabel(msg.suggestedAction)
                      : null;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1 px-1">
                        <span className="font-medium text-slate-600">
                          {msg.role === 'user'
                            ? currentUserProfile?.name || 'Anda'
                            : 'Agen HADIROT'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{msg.timestamp}</span>
                        {msg.confidenceCategory && msg.role === 'assistant' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-700 font-medium">
                              {msg.confidenceCategory}
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          title="Salin isi pesan"
                          className="hover:text-slate-700 p-0.5 rounded transition-colors ml-1"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <div
                        className={`group relative max-w-[90%] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line shadow-xs ${
                          msg.role === 'user'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-50 border border-slate-200 text-slate-800'
                        }`}
                      >
                        {msg.text}

                        {/* Cited Knowledge Base Articles */}
                        {msg.role === 'assistant' &&
                          msg.citedArticles &&
                          msg.citedArticles.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-700">
                                Rujukan Basis Pengetahuan:{' '}
                              </span>
                              {msg.citedArticles.join(' · ')}
                            </div>
                          )}

                        {/* Suggested Executable Action Button */}
                        {msg.role === 'assistant' && actionLabel && msg.suggestedAction && (
                          <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                            <button
                              type="button"
                              onClick={() => handleExecuteSuggestedAction(msg.suggestedAction!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              {actionLabel}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 px-2 py-2">
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>
                      Agen HADIROT sedang menganalisis basis pengetahuan & telemetri unit...
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Form */}
              <form
                onSubmit={handleChatSubmit}
                className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Tanyakan tentang SOP perusahaan, K3 PLTU/PLTD, aturan geofence, atau perhitungan gaji..."
                  className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="submit"
                  disabled={isSending || !chatInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  Kirim ke Bot
                </button>
              </form>
            </>
          )}

          {/* VIEW MODE 2: DEDICATED SCROLLABLE CHAT HISTORY LOG */}
          {botTab === 'history' && (
            <div className="flex flex-col h-[560px]">
              {/* Context Summary & Management Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-emerald-700" />
                      <span>Log Riwayat Pertanyaan & Jawaban Bot</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Menyimpan seluruh konteks dialog dan rekomendasi SOP lintas sesi untuk kemudahan peninjauan kembali.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExportChatHistory}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Unduh seluruh riwayat dalam format file teks"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Ekspor (.txt)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearHistoryConfirm(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                      title="Bersihkan riwayat percakapan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Bersihkan</span>
                    </button>
                  </div>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Cari dalam log percakapan (kata kunci, SOP, tanggal, topik)..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    {historySearch && (
                      <button
                        type="button"
                        onClick={() => setHistorySearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setHistoryRoleFilter('all')}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        historyRoleFilter === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Semua ({messages.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryRoleFilter('user')}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        historyRoleFilter === 'user'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Pertanyaan ({userMessagesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryRoleFilter('assistant')}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        historyRoleFilter === 'assistant'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Jawaban Agen ({assistantMessagesCount})
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable History Stream Log */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {filteredHistoryMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-xl border border-dashed border-slate-300">
                    <History className="w-10 h-10 text-slate-300 mb-2" />
                    <div className="text-sm font-semibold text-slate-800">
                      {historySearch
                        ? 'Tidak Ditemukan Riwayat Percakapan'
                        : 'Belum Ada Riwayat Percakapan'}
                    </div>
                    <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
                      {historySearch
                        ? `Tidak ada pesan atau jawaban yang cocok dengan kata kunci "${historySearch}". Coba gunakan kata kunci lain.`
                        : 'Mulai ajukan pertanyaan kepada Bot Pengetahuan atau jalankan instruksi agen di tab Obrolan Aktif.'}
                    </p>
                    {historySearch ? (
                      <button
                        type="button"
                        onClick={() => setHistorySearch('')}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        Reset Pencarian
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setBotTab('chat')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Buka Obrolan Aktif
                      </button>
                    )}
                  </div>
                ) : (
                  filteredHistoryMessages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    const actionLabel =
                      msg.suggestedAction && msg.suggestedAction !== 'NONE'
                        ? getSuggestedActionLabel(msg.suggestedAction)
                        : null;

                    return (
                      <div
                        key={msg.id}
                        className={`rounded-xl border transition-all ${
                          isUser
                            ? 'bg-white border-slate-300 shadow-xs'
                            : 'bg-white border-slate-200 shadow-xs ring-1 ring-emerald-500/10'
                        }`}
                      >
                        {/* History Entry Header */}
                        <div
                          className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 text-xs rounded-t-xl ${
                            isUser ? 'bg-slate-100/70 border-slate-200' : 'bg-emerald-50/60 border-emerald-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-slate-500 px-1.5 py-0.5 rounded bg-white border border-slate-200">
                              #{idx + 1}
                            </span>
                            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                              {isUser ? (
                                <>
                                  <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">
                                    <User className="w-3 h-3" />
                                  </div>
                                  <span>{currentUserProfile?.name || 'Staf / Pengguna'}</span>
                                  <span className="text-[10px] font-normal text-slate-500 bg-slate-200 px-1.5 py-0.2 rounded">
                                    {isAdmin ? 'Admin' : 'Staf'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                                    <Bot className="w-3 h-3" />
                                  </div>
                                  <span>Agen HADIROT</span>
                                  <span className="text-[10px] font-normal text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-medium">
                                    Terverifikasi
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-mono tabular-nums flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {msg.timestamp}
                              {msg.fullDate && ` · ${msg.fullDate}`}
                            </span>

                            {msg.confidenceCategory && !isUser && (
                              <span className="hidden sm:inline-block text-[10px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full font-medium">
                                {msg.confidenceCategory}
                              </span>
                            )}

                            {/* Card Quick Actions */}
                            <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(msg.id, msg.text)}
                                title="Salin teks ini"
                                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-white rounded transition-colors"
                              >
                                {copiedMsgId === msg.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {isUser ? (
                                <button
                                  type="button"
                                  onClick={() => handleReAskQuery(msg.text)}
                                  title="Ajukan pertanyaan ini lagi ke bot"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Tanya Lagi</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBotTab('chat');
                                    setChatInput(`Lanjutkan penjelasan terkait: ${msg.text.slice(0, 60)}...`);
                                  }}
                                  title="Lanjutkan topik bahasan ini di obrolan aktif"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-100/60 rounded hover:bg-emerald-100 transition-colors"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  <span>Lanjutkan</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* History Entry Body */}
                        <div className="p-4 text-xs leading-relaxed text-slate-800 whitespace-pre-line">
                          {msg.text}

                          {/* Citations in History Card */}
                          {msg.citedArticles && msg.citedArticles.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-slate-700">Rujukan SOP:</span>
                              {msg.citedArticles.map((art, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]"
                                >
                                  {art}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Action Button in History Card */}
                          {actionLabel && msg.suggestedAction && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[11px] text-slate-500">
                                Rekomendasi tindakan sistem yang dapat dieksekusi:
                              </span>
                              <button
                                type="button"
                                onClick={() => handleExecuteSuggestedAction(msg.suggestedAction!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                {actionLabel}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* History Footer Bar */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span className="font-mono tabular-nums text-[11px]">
                  Menampilkan {filteredHistoryMessages.length} dari {messages.length} riwayat percakapan
                </span>
                <button
                  type="button"
                  onClick={() => setBotTab('chat')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Kembali ke Obrolan Aktif</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Company Knowledge Base Repository */}
        <div className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-900" />
              <h2 className="text-sm font-semibold text-slate-900">
                Basis Pengetahuan Perusahaan (Knowledge Base)
              </h2>
            </div>
            <span className="font-mono tabular-nums text-xs text-slate-500">
              {filteredKnowledge.length} Dokumen
            </span>
          </div>

          {/* Search & Category Filter */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={kbSearch}
                onChange={(e) => setKbSearch(e.target.value)}
                placeholder="Cari SOP, K3L, PLTU Jeranjang, rumus lembur, 2FA..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  'ALL',
                  'Profil & Unit Pembangkit',
                  'SOP Absensi & Geofence',
                  'HR & Penggajian',
                  'K3L & Teknis Pembangkit',
                  'Keamanan & 2FA',
                ] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setKbCategoryFilter(cat)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                    kbCategoryFilter === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? 'Semua Topik' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Knowledge Articles List */}
          <div className="space-y-3 max-h-[510px] overflow-y-auto pr-1">
            {filteredKnowledge.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Tidak ada dokumen pengetahuan yang cocok dengan pencarian Anda.
              </div>
            ) : (
              filteredKnowledge.map((article) => (
                <div
                  key={article.id}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] text-slate-500">
                      <span className="font-medium text-emerald-700">{article.category}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono tabular-nums">Diperbarui {article.updatedDate}</span>
                      {article.isCustom && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="font-semibold text-slate-900">Dokumen Internal Baru</span>
                        </>
                      )}
                    </div>
                    {article.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomKnowledge(article.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Hapus dokumen pengetahuan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="text-xs font-semibold text-slate-900">{article.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {article.content}
                  </p>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-400 truncate">
                      Kata kunci: {article.tags.join(' · ')}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        sendQuestionToBot(
                          `Jelaskan secara lengkap mengenai "${article.title}" beserta penerapannya di operasional perusahaan.`
                        )
                      }
                      className="font-semibold text-slate-900 underline hover:text-emerald-700 whitespace-nowrap shrink-0"
                    >
                      Tanyakan ke Bot
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Tambah Dokumen Pengetahuan Perusahaan */}
      {showAddKbModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Tambah Pengetahuan Perusahaan ke Bot HADIROT
              </h3>
              <button
                type="button"
                onClick={() => setShowAddKbModal(false)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleAddCustomKnowledge} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Judul SOP / Pengetahuan Perusahaan
                </label>
                <input
                  type="text"
                  required
                  value={newKbForm.title}
                  onChange={(e) => setNewKbForm({ ...newKbForm, title: e.target.value })}
                  placeholder="Contoh: Prosedur Tanggap Darurat Gangguan Transmisi Lombok"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Kategori Topik</label>
                <select
                  value={newKbForm.category}
                  onChange={(e) =>
                    setNewKbForm({
                      ...newKbForm,
                      category: e.target.value as CompanyKnowledgeArticle['category'],
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Profil & Unit Pembangkit">Profil & Unit Pembangkit</option>
                  <option value="SOP Absensi & Geofence">SOP Absensi & Geofence</option>
                  <option value="HR & Penggajian">HR & Penggajian</option>
                  <option value="K3L & Teknis Pembangkit">K3L & Teknis Pembangkit</option>
                  <option value="Keamanan & 2FA">Keamanan & 2FA</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Isi Lengkap SOP / Materi Pengetahuan (Akan dipelajari otomatis oleh Bot)
                </label>
                <textarea
                  rows={5}
                  required
                  value={newKbForm.content}
                  onChange={(e) => setNewKbForm({ ...newKbForm, content: e.target.value })}
                  placeholder="Tuliskan rincian aturan perusahaan, prosedur teknis pembangkit, atau kebijakan kepegawaian..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Kata Kunci Pencarian (Pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={newKbForm.tagsInput}
                  onChange={(e) => setNewKbForm({ ...newKbForm, tagsInput: e.target.value })}
                  placeholder="Contoh: transmisi, darurat, gardu induk, sop"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddKbModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Simpan & Latih Bot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear Chat History */}
      {showClearHistoryConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Bersihkan Riwayat Percakapan?
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5 bg-slate-50 p-3 rounded-lg border border-slate-200">
              Seluruh <strong>{messages.length} riwayat pesan</strong> (pertanyaan Anda dan jawaban agen) akan dihapus dari penyimpanan sesi lokal. Sesi obrolan baru akan dimulai dari awal.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearHistoryConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Semua Riwayat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {agentToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-slate-700 pointer-events-none animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{agentToast}</span>
        </div>
      )}
    </div>
  );
};
