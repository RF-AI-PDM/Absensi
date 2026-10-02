import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AttendanceLog, MonthlyRecapItem, PayrollRecord } from '../types';
import { formatCurrencyIDR, formatDurationHoursMinutes } from './geo';
import {
  getDanantaraIndonesiaLogoDataUrl,
  getPlnIndonesiaPowerLogoDataUrl,
} from '../components/CorporateLogos';

const STATUS_LABELS: Record<string, string> = {
  hadir_tepat_waktu: 'Hadir Tepat Waktu',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  lembur: 'Lembur',
  selesai_shift: 'Selesai Shift',
};

/**
 * Draws the official dual-logo corporate header (PLN Indonesia Power on left, Danantara Indonesia on right)
 * on any jsPDF document (portrait or landscape) and returns the starting Y coordinate for content below it.
 */
function drawCorporatePdfHeader(
  doc: jsPDF,
  title: string,
  subtitle: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  try {
    const plnLogoUrl = getPlnIndonesiaPowerLogoDataUrl();
    const danantaraLogoUrl = getDanantaraIndonesiaLogoDataUrl();

    if (plnLogoUrl) {
      doc.addImage(plnLogoUrl, 'PNG', 14, 10, 46, 14);
    }
    if (danantaraLogoUrl) {
      doc.addImage(danantaraLogoUrl, 'PNG', pageWidth - 62, 10, 48, 14);
    }
  } catch {
    // Fallback text if canvas is unavailable
    doc.setFontSize(11);
    doc.setTextColor(0, 147, 208);
    doc.text('PLN Indonesia Power', 14, 18);
    doc.setTextColor(15, 23, 42);
    doc.text('Danantara Indonesia', pageWidth - 60, 18);
  }

  // Corporate Divider Line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, 27, pageWidth - 14, 27);

  // Document Title & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, 14, 41);

  return 46;
}

export function exportAttendanceToPDF(logs: AttendanceLog[], periodLabel: string) {
  const doc = new jsPDF({ orientation: 'landscape' });

  const startY = drawCorporatePdfHeader(
    doc,
    'HADIROT — Laporan Kehadiran & Geolokasi Real-Time',
    `PT PLN Indonesia Power · Danantara Indonesia  |  Periode: ${periodLabel}  |  Dicetak: ${new Date().toLocaleString('id-ID')}`
  );

  const rows = logs.map((log, idx) => [
    String(idx + 1),
    log.dateStr,
    log.userName,
    log.department,
    log.checkInTime,
    log.checkOutTime || '-',
    `${log.latitude.toFixed(5)}, ${log.longitude.toFixed(5)}`,
    `${log.distanceMeters} m (${log.isWithinGeofence ? 'Dalam Zona' : 'Luar Zona'})`,
    STATUS_LABELS[log.status] || log.status,
    `${log.lateMinutes} mnt`,
    formatDurationHoursMinutes(log.workDurationMinutes),
  ]);

  autoTable(doc, {
    startY,
    head: [
      [
        'No',
        'Tanggal',
        'Nama Karyawan',
        'Departemen',
        'Check-In',
        'Check-Out',
        'Koordinat GPS',
        'Jarak Geofence',
        'Status',
        'Telat',
        'Durasi',
      ],
    ],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(`HADIROT_Absensi_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}

export function exportAttendanceToExcel(logs: AttendanceLog[], periodLabel: string) {
  const data = logs.map((log, idx) => ({
    No: idx + 1,
    Instansi: 'PT PLN Indonesia Power — Danantara Indonesia',
    Tanggal: log.dateStr,
    Bulan: log.monthStr,
    'Nama Karyawan': log.userName,
    Departemen: log.department,
    Jabatan: log.position,
    'Jam Masuk': log.checkInTime,
    'Jam Pulang': log.checkOutTime || '-',
    Latitude: log.latitude,
    Longitude: log.longitude,
    'Akurasi GPS (m)': log.accuracyMeters,
    'Jarak Kantor (m)': log.distanceMeters,
    'Status Geofence': log.isWithinGeofence ? 'Dalam Radius Kantor' : 'Di Luar Radius',
    'Lokasi / Zona': log.locationLabel,
    'Status Kehadiran': STATUS_LABELS[log.status] || log.status,
    'Keterlambatan (Menit)': log.lateMinutes,
    'Durasi Kerja (Menit)': log.workDurationMinutes,
    Catatan: log.notes,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Log_Absensi');
  XLSX.writeFile(workbook, `HADIROT_Absensi_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`);
}

export function exportMonthlyRecapToPDF(recaps: MonthlyRecapItem[], monthStr: string) {
  const doc = new jsPDF({ orientation: 'landscape' });

  const startY = drawCorporatePdfHeader(
    doc,
    `HADIROT — Rekapitulasi Kehadiran & Kinerja Bulanan (${monthStr})`,
    `PT PLN Indonesia Power · Danantara Indonesia  |  Otomatisasi Rekapitulasi & Estimasi Penggajian  |  Dicetak: ${new Date().toLocaleString('id-ID')}`
  );

  const rows = recaps.map((item, idx) => [
    String(idx + 1),
    item.user.employeeCode,
    item.user.name,
    item.user.department,
    String(item.presentDays),
    String(item.onTimeDays),
    String(item.lateDays),
    String(item.leaveDays),
    `${item.totalLateMinutes} mnt`,
    `${item.disciplineScore}%`,
    formatCurrencyIDR(item.estimatedNetSalary),
  ]);

  autoTable(doc, {
    startY,
    head: [
      [
        'No',
        'NIK',
        'Nama Staf',
        'Departemen',
        'Hadir',
        'Tepat Waktu',
        'Terlambat',
        'Izin/Sakit',
        'Total Telat',
        'Skor Disiplin',
        'Estimasi THP',
      ],
    ],
    body: rows,
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(`HADIROT_Rekap_Bulanan_${monthStr}.pdf`);
}

export function exportPayrollToPDF(records: PayrollRecord[], monthStr: string) {
  const doc = new jsPDF({ orientation: 'landscape' });

  const startY = drawCorporatePdfHeader(
    doc,
    `HADIROT — Laporan Penggajian Karyawan Terintegrasi (${monthStr})`,
    `PT PLN Indonesia Power · Danantara Indonesia  |  Integrasi Absensi & Slip Gaji Bulanan  |  Dicetak: ${new Date().toLocaleString('id-ID')}`
  );

  const rows = records.map((r, idx) => [
    String(idx + 1),
    r.employeeCode,
    r.employeeName,
    r.department,
    `${r.presentDays} hr (${r.lateDays} telat)`,
    formatCurrencyIDR(r.baseSalary),
    formatCurrencyIDR(r.totalAllowance),
    formatCurrencyIDR(r.overtimePay),
    formatCurrencyIDR(r.lateDeduction),
    formatCurrencyIDR(r.bpjsTaxDeduction),
    formatCurrencyIDR(r.netSalary),
    r.status.toUpperCase(),
  ]);

  autoTable(doc, {
    startY,
    head: [
      [
        'No',
        'NIK',
        'Nama Karyawan',
        'Departemen',
        'Kehadiran',
        'Gaji Pokok',
        'Tunjangan',
        'Lembur',
        'Pot. Telat',
        'BPJS/Pajak',
        'Take Home Pay',
        'Status',
      ],
    ],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(`HADIROT_Payroll_${monthStr}.pdf`);
}

/**
 * Generates an official, single-employee formatted Payslip PDF (Slip Gaji Elektronik)
 * with PLN Indonesia Power & Danantara Indonesia logos.
 */
export function exportSinglePayslipToPDF(slip: PayrollRecord) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const startY = drawCorporatePdfHeader(
    doc,
    'SLIP GAJI ELEKTRONIK KARYAWAN (OFFICIAL PAYSLIP)',
    `PT PLN Indonesia Power · Danantara Indonesia — Unit Operasional NTB (HADIROT)  |  Periode: ${slip.monthStr}`
  );

  // Employee Identity Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, startY, pageWidth - 28, 28, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Nama Karyawan', 18, startY + 7);
  doc.text('Nomor Induk (NIK)', 18, startY + 14);
  doc.text('Departemen / Jabatan', 18, startY + 21);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${slip.employeeName}`, 58, startY + 7);
  doc.text(`: ${slip.employeeCode}`, 58, startY + 14);
  doc.text(`: ${slip.department} / ${slip.position}`, 58, startY + 21);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Periode Gaji', 120, startY + 7);
  doc.text('Rekap Kehadiran', 120, startY + 14);
  doc.text('Status Pencairan', 120, startY + 21);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${slip.monthStr}`, 154, startY + 7);
  doc.text(
    `: ${slip.presentDays} Hari Hadir (${slip.lateDays} Telat, ${slip.leaveDays} Izin)`,
    154,
    startY + 14
  );
  doc.text(
    `: ${slip.status === 'paid' ? 'LUNAS DIBAYAR' : slip.status === 'approved' ? 'DISETUJUI' : 'DRAFT'}`,
    154,
    startY + 21
  );

  const grossIncome = slip.baseSalary + slip.totalAllowance + slip.overtimePay;
  const totalDeduction = slip.lateDeduction + slip.bpjsTaxDeduction;

  // Earnings & Deductions Table
  autoTable(doc, {
    startY: startY + 34,
    head: [['No', 'Komponen Remunerasi & Penggajian', 'Kategori', 'Nominal (IDR)']],
    body: [
      ['1', 'Gaji Pokok Bulanan (Base Salary)', 'Penerimaan (+)', formatCurrencyIDR(slip.baseSalary)],
      [
        '2',
        `Tunjangan Kehadiran Harian (${slip.presentDays} Hari Hadir Aktual)`,
        'Penerimaan (+)',
        `+${formatCurrencyIDR(slip.totalAllowance)}`,
      ],
      [
        '3',
        `Upah Lembur Operasional (${slip.overtimeHours} Jam Lembur)`,
        'Penerimaan (+)',
        `+${formatCurrencyIDR(slip.overtimePay)}`,
      ],
      [
        '',
        'TOTAL PENERIMAAN KOTOR (GROSS INCOME)',
        'Subtotal (+)',
        formatCurrencyIDR(grossIncome),
      ],
      [
        '4',
        `Potongan Kedisiplinan Keterlambatan (${slip.lateDays} Kejadian)`,
        'Potongan (-)',
        `-${formatCurrencyIDR(slip.lateDeduction)}`,
      ],
      [
        '5',
        'Potongan BPJS Kesehatan, Ketenagakerjaan & PPh21',
        'Potongan (-)',
        `-${formatCurrencyIDR(slip.bpjsTaxDeduction)}`,
      ],
      [
        '',
        'TOTAL POTONGAN (TOTAL DEDUCTIONS)',
        'Subtotal (-)',
        `-${formatCurrencyIDR(totalDeduction)}`,
      ],
    ],
    styles: { fontSize: 9, cellPadding: 3.5 },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: {
      0: { cellWidth: 12 },
      3: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || startY + 115;

  // Net Salary (Take Home Pay) Banner
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(14, finalY + 6, pageWidth - 28, 18, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('TAKE HOME PAY (GAJI BERSIH DITERIMA)', 20, finalY + 17);
  doc.setFontSize(13);
  doc.setTextColor(52, 211, 153);
  doc.text(formatCurrencyIDR(slip.netSalary), pageWidth - 20, finalY + 17, { align: 'right' });

  // Verification Footer & Signatures
  const sigY = finalY + 36;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Dokumen ini diterbitkan secara elektronik oleh Sistem Absensi Geospasial & Penggajian HADIROT.',
    14,
    sigY
  );
  doc.text(
    `Terverifikasi Otomatis pada: ${new Date().toLocaleString('id-ID')}  |  ID Dokumen: ${slip.payrollId}`,
    14,
    sigY + 5
  );

  doc.setTextColor(15, 23, 42);
  doc.text('Penerima,', 28, sigY + 16);
  doc.setFont('helvetica', 'bold');
  doc.text(slip.employeeName, 28, sigY + 34);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIK: ${slip.employeeCode}`, 28, sigY + 39);

  doc.text('Mengesahkan,', pageWidth - 70, sigY + 16);
  doc.setFont('helvetica', 'bold');
  doc.text('Divisi SDM & Keuangan', pageWidth - 70, sigY + 34);
  doc.setFont('helvetica', 'normal');
  doc.text('PT PLN Indonesia Power · Danantara Indonesia', pageWidth - 70, sigY + 39);

  doc.save(`Slip_Gaji_HADIROT_${slip.employeeCode}_${slip.monthStr}.pdf`);
}

export function exportPayrollToExcel(records: PayrollRecord[], monthStr: string) {
  const data = records.map((r, idx) => ({
    No: idx + 1,
    Instansi: 'PT PLN Indonesia Power — Danantara Indonesia',
    Periode: r.monthStr,
    NIK: r.employeeCode,
    'Nama Karyawan': r.employeeName,
    Departemen: r.department,
    Jabatan: r.position,
    'Hari Hadir': r.presentDays,
    'Hari Terlambat': r.lateDays,
    'Hari Izin/Sakit': r.leaveDays,
    'Jam Lembur': r.overtimeHours,
    'Gaji Pokok (IDR)': r.baseSalary,
    'Tunjangan Harian (IDR)': r.totalAllowance,
    'Upah Lembur (IDR)': r.overtimePay,
    'Potongan Terlambat (IDR)': r.lateDeduction,
    'Potongan BPJS & PPh21 (IDR)': r.bpjsTaxDeduction,
    'Take Home Pay / Gaji Bersih (IDR)': r.netSalary,
    'Status Pembayaran': r.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll_Bulanan');
  XLSX.writeFile(workbook, `HADIROT_Payroll_${monthStr}.xlsx`);
}
