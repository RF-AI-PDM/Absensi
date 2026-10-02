import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AttendanceLog, MonthlyRecapItem, PayrollRecord } from '../types';
import { formatCurrencyIDR, formatDurationHoursMinutes } from './geo';

const STATUS_LABELS: Record<string, string> = {
  hadir_tepat_waktu: 'Hadir Tepat Waktu',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  lembur: 'Lembur',
  selesai_shift: 'Selesai Shift',
};

export function exportAttendanceToPDF(logs: AttendanceLog[], periodLabel: string) {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.text('HadirPro — Laporan Kehadiran & Geolokasi Real-Time', 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Periode: ${periodLabel}  |  Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 23);

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
    startY: 28,
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

  doc.save(`HadirPro_Absensi_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}

export function exportAttendanceToExcel(logs: AttendanceLog[], periodLabel: string) {
  const data = logs.map((log, idx) => ({
    No: idx + 1,
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
  XLSX.writeFile(workbook, `HadirPro_Absensi_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`);
}

export function exportMonthlyRecapToPDF(recaps: MonthlyRecapItem[], monthStr: string) {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.text(`HadirPro — Rekapitulasi Kehadiran & Kinerja Bulanan (${monthStr})`, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Otomatisasi Rekapitulasi Bulanan & Estimasi Penggajian  |  Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 23);

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
    startY: 28,
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

  doc.save(`HadirPro_Rekap_Bulanan_${monthStr}.pdf`);
}

export function exportPayrollToPDF(records: PayrollRecord[], monthStr: string) {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.text(`HadirPro — Laporan Penggajian Karyawan Terintegrasi (${monthStr})`, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Integrasi Absensi & Slip Gaji Bulanan  |  Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 23);

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
    startY: 28,
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

  doc.save(`HadirPro_Payroll_${monthStr}.pdf`);
}

export function exportPayrollToExcel(records: PayrollRecord[], monthStr: string) {
  const data = records.map((r, idx) => ({
    No: idx + 1,
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
  XLSX.writeFile(workbook, `HadirPro_Payroll_${monthStr}.xlsx`);
}
