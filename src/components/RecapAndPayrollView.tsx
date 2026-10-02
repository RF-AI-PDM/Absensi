import React, { useState } from 'react';
import { FileSpreadsheet, FileText, RefreshCw, CheckCircle2, Banknote, Printer } from 'lucide-react';
import { MonthlyRecapItem, PayrollRecord, UserProfile } from '../types';
import { formatCurrencyIDR, formatDurationHoursMinutes } from '../utils/geo';
import {
  exportMonthlyRecapToPDF,
  exportPayrollToExcel,
  exportPayrollToPDF,
  exportSinglePayslipToPDF,
} from '../utils/exporter';
import {
  DanantaraIndonesiaLogo,
  PlnIndonesiaPowerLogo,
} from './CorporateLogos';

interface RecapAndPayrollViewProps {
  mode: 'recap' | 'payroll';
  selectedMonth: string;
  onChangeMonth: (m: string) => void;
  recapItems: MonthlyRecapItem[];
  payrollRecords: PayrollRecord[];
  isAdmin: boolean;
  onSyncPayrollFromRecap: () => Promise<void>;
  onUpdatePayrollStatus: (payroll: PayrollRecord, nextStatus: 'approved' | 'paid') => Promise<void>;
  onAddStaffModalOpen: () => void;
  users: UserProfile[];
}

export const RecapAndPayrollView: React.FC<RecapAndPayrollViewProps> = ({
  mode,
  selectedMonth,
  onChangeMonth,
  recapItems,
  payrollRecords,
  isAdmin,
  onSyncPayrollFromRecap,
  onUpdatePayrollStatus,
  onAddStaffModalOpen,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  const filteredRecaps = recapItems.filter(
    (item) =>
      item.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPayrolls = payrollRecords.filter(
    (r) =>
      r.monthStr === selectedMonth &&
      (r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSyncPayrollFromRecap();
    } finally {
      setSyncing(false);
    }
  };

  if (mode === 'recap') {
    const totalPresent = filteredRecaps.reduce((acc, r) => acc + r.presentDays, 0);
    const totalLate = filteredRecaps.reduce((acc, r) => acc + r.lateDays, 0);
    const avgDiscipline =
      filteredRecaps.length > 0
        ? Math.round(
            filteredRecaps.reduce((acc, r) => acc + r.disciplineScore, 0) / filteredRecaps.length
          )
        : 100;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 bg-white px-5 py-4 rounded-xl border">
          <div className="flex flex-wrap items-center gap-5">
            <PlnIndonesiaPowerLogo className="h-10 w-auto" />
            <div className="h-7 w-px bg-slate-200 hidden sm:block" />
            <DanantaraIndonesiaLogo className="h-10 w-auto" />
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Dokumen Resmi Rekapitulasi &amp; Penggajian · HADIROT NTB
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-display">
              Rekapitulasi Laporan Bulanan Otomatis
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Kalkulasi otomatis tingkat kehadiran, keterlambatan, kepatuhan geofence, dan
              estimasi kompensasi bulanan staf.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
              <span>Periode Bulan:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => onChangeMonth(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg bg-white"
              />
            </label>

            <button
              type="button"
              onClick={() => exportMonthlyRecapToPDF(filteredRecaps, selectedMonth)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              Ekspor Rekap PDF
            </button>

            {isAdmin && (
              <button
                type="button"
                disabled={syncing}
                onClick={handleSync}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Menyinkronkan...' : 'Sinkronkan ke Slip Penggajian'}
              </button>
            )}
          </div>
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-slate-200 bg-white rounded-xl p-4">
            <span className="text-xs text-slate-500">Total Karyawan Terdata</span>
            <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
              {filteredRecaps.length} Staf
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Periode {selectedMonth}</span>
          </div>
          <div className="border border-slate-200 bg-white rounded-xl p-4">
            <span className="text-xs text-slate-500">Akumulasi Kehadiran Bulan Ini</span>
            <p className="text-2xl font-semibold font-mono tabular-nums text-emerald-700 mt-1">
              {totalPresent} Hari Kerja
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Terekam via GPS Real-Time</span>
          </div>
          <div className="border border-slate-200 bg-white rounded-xl p-4">
            <span className="text-xs text-slate-500">Total Insiden Keterlambatan</span>
            <p className="text-2xl font-semibold font-mono tabular-nums text-amber-700 mt-1">
              {totalLate} Kejadian
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Otomatis memotong tunjangan</span>
          </div>
          <div className="border border-slate-200 bg-white rounded-xl p-4">
            <span className="text-xs text-slate-500">Rata-Rata Indeks Kedisiplinan</span>
            <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
              {avgDiscipline}%
            </p>
            <span className="text-xs text-slate-500 mt-1 block">Kepatuhan jam & geofence</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama karyawan, NIK, atau departemen..."
            className="w-full sm:w-80 px-3.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {isAdmin && (
            <button
              type="button"
              onClick={onAddStaffModalOpen}
              className="px-3.5 py-2 text-xs font-medium text-slate-800 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              + Tambah Profil Staf Baru
            </button>
          )}
        </div>

        {/* Recapitulation Table */}
        <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Karyawan & NIK</th>
                  <th className="py-3 px-4">Departemen</th>
                  <th className="py-3 px-4 text-right">Hadir</th>
                  <th className="py-3 px-4 text-right">Tepat Waktu</th>
                  <th className="py-3 px-4 text-right">Terlambat</th>
                  <th className="py-3 px-4 text-right">Izin / Sakit</th>
                  <th className="py-3 px-4 text-right">Total Durasi</th>
                  <th className="py-3 px-4 text-right">Skor Disiplin</th>
                  <th className="py-3 px-4 text-right">Estimasi Gaji Bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredRecaps.map((item) => (
                  <tr key={item.user.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.user.name}</div>
                      <div className="text-slate-500 font-mono tabular-nums">
                        {item.user.employeeCode} · {item.user.position}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{item.user.department}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {item.presentDays} hr
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                      {item.onTimeDays} hr
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                      {item.lateDays} hr ({item.totalLateMinutes}m)
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {item.leaveDays} hr
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatDurationHoursMinutes(item.totalWorkMinutes)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      <span
                        className={
                          item.disciplineScore >= 85
                            ? 'text-emerald-700'
                            : item.disciplineScore >= 70
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }
                      >
                        {item.disciplineScore}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrencyIDR(item.estimatedNetSalary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Payroll View
  const totalPayrollNet = filteredPayrolls.reduce((acc, r) => acc + r.netSalary, 0);
  const totalAllowances = filteredPayrolls.reduce((acc, r) => acc + r.totalAllowance, 0);
  const totalDeductions = filteredPayrolls.reduce(
    (acc, r) => acc + r.lateDeduction + r.bpjsTaxDeduction,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 bg-white px-5 py-4 rounded-xl border">
        <div className="flex flex-wrap items-center gap-5">
          <PlnIndonesiaPowerLogo className="h-10 w-auto" />
          <div className="h-7 w-px bg-slate-200 hidden sm:block" />
          <DanantaraIndonesiaLogo className="h-10 w-auto" />
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          Dokumen Output Resmi Slip Gaji &amp; Remunerasi · HADIROT NTB
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Sistem Penggajian Terintegrasi Absensi
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Perhitungan otomatis gaji pokok, tunjangan kehadiran harian, upah lembur, serta
            potongan keterlambatan & BPJS/PPh21.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => onChangeMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg bg-white"
          />

          <button
            type="button"
            onClick={() => exportPayrollToPDF(filteredPayrolls, selectedMonth)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" />
            Ekspor PDF
          </button>

          <button
            type="button"
            onClick={() => exportPayrollToExcel(filteredPayrolls, selectedMonth)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Ekspor Excel
          </button>

          {isAdmin && (
            <button
              type="button"
              disabled={syncing}
              onClick={handleSync}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Menghitung...' : 'Hitung & Terbitkan Slip Gaji Bulan Ini'}
            </button>
          )}
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-slate-200 bg-white rounded-xl p-4">
          <span className="text-xs text-slate-500">Total Anggaran Take Home Pay ({selectedMonth})</span>
          <p className="text-xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {formatCurrencyIDR(totalPayrollNet)}
          </p>
          <span className="text-xs text-slate-500 mt-1 block">
            {filteredPayrolls.length} slip gaji diterbitkan
          </span>
        </div>
        <div className="border border-slate-200 bg-white rounded-xl p-4">
          <span className="text-xs text-slate-500">Total Tunjangan Kehadiran & Lembur</span>
          <p className="text-xl font-semibold font-mono tabular-nums text-emerald-700 mt-1">
            {formatCurrencyIDR(totalAllowances)}
          </p>
          <span className="text-xs text-slate-500 mt-1 block">Berdasarkan hari hadir aktual</span>
        </div>
        <div className="border border-slate-200 bg-white rounded-xl p-4">
          <span className="text-xs text-slate-500">Total Potongan Keterlambatan & BPJS/Pajak</span>
          <p className="text-xl font-semibold font-mono tabular-nums text-amber-700 mt-1">
            {formatCurrencyIDR(totalDeductions)}
          </p>
          <span className="text-xs text-slate-500 mt-1 block">Potongan disiplin otomatis</span>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
        {filteredPayrolls.length === 0 ? (
          <div className="p-12 text-center">
            <Banknote className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-900">
              Belum Ada Slip Gaji Diterbitkan untuk Periode {selectedMonth}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Klik tombol &ldquo;Hitung &amp; Terbitkan Slip Gaji Bulan Ini&rdquo; untuk
              mengalkulasi slip gaji secara otomatis dari rekapitulasi absensi bulanan.
            </p>
            {isAdmin && (
              <button
                type="button"
                onClick={handleSync}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Terbitkan Slip Gaji Sekarang
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Karyawan</th>
                  <th className="py-3 px-4 text-right">Hadir / Telat</th>
                  <th className="py-3 px-4 text-right">Gaji Pokok</th>
                  <th className="py-3 px-4 text-right">Tunjangan + Lembur</th>
                  <th className="py-3 px-4 text-right">Pot. Telat</th>
                  <th className="py-3 px-4 text-right">BPJS & Pajak</th>
                  <th className="py-3 px-4 text-right">Gaji Bersih (THP)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredPayrolls.map((row) => (
                  <tr key={row.payrollId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{row.employeeName}</div>
                      <div className="text-slate-500 font-mono tabular-nums">
                        {row.employeeCode} · {row.department}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {row.presentDays} hr · {row.lateDays} telat
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                      {formatCurrencyIDR(row.baseSalary)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                      +{formatCurrencyIDR(row.totalAllowance + row.overtimePay)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700">
                      -{formatCurrencyIDR(row.lateDeduction)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      -{formatCurrencyIDR(row.bpjsTaxDeduction)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrencyIDR(row.netSalary)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-medium ${
                          row.status === 'paid'
                            ? 'text-emerald-700'
                            : row.status === 'approved'
                            ? 'text-blue-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {row.status === 'paid'
                          ? 'Lunas Dibayar'
                          : row.status === 'approved'
                          ? 'Disetujui'
                          : 'Draft'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSlip(row)}
                          className="text-xs font-medium text-slate-700 hover:text-slate-950 underline whitespace-nowrap"
                        >
                          Rincian Slip
                        </button>
                        <button
                          type="button"
                          onClick={() => exportSinglePayslipToPDF(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 whitespace-nowrap"
                        >
                          <Printer className="w-3 h-3" />
                          Slip PDF
                        </button>
                        {isAdmin && row.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => onUpdatePayrollStatus(row, 'approved')}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-slate-800 rounded hover:bg-slate-700 whitespace-nowrap"
                          >
                            Setujui
                          </button>
                        )}
                        {isAdmin && row.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => onUpdatePayrollStatus(row, 'paid')}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-700 rounded hover:bg-emerald-600 whitespace-nowrap"
                          >
                            Tandai Lunas
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Payslip Inspector Drawer/Panel */}
      {selectedSlip && (
        <div className="border border-slate-300 bg-white rounded-xl p-6 space-y-5">
          {/* Official Corporate Letterhead with PLN Indonesia Power & Danantara Indonesia Logos */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex flex-wrap items-center gap-6">
              <PlnIndonesiaPowerLogo className="h-11 w-auto" />
              <div className="h-8 w-px bg-slate-200 hidden sm:block" />
              <DanantaraIndonesiaLogo className="h-11 w-auto" />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportSinglePayslipToPDF(selectedSlip)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Unduh Slip Gaji Resmi (PDF)
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Tutup
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs text-slate-500">
                SLIP GAJI ELEKTRONIK TERINTEGRASI ABSENSI · PT PLN INDONESIA POWER — DANANTARA INDONESIA
              </span>
              <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                {selectedSlip.employeeName} ({selectedSlip.employeeCode})
              </h3>
              <p className="text-xs text-slate-600">
                {selectedSlip.department} · {selectedSlip.position} · Periode {selectedSlip.monthStr}
              </p>
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-500">
              ID Dokumen: {selectedSlip.payrollId}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-900">Komponen Penerimaan</h4>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Gaji Pokok Bulanan</span>
                <span className="font-mono tabular-nums font-medium">
                  {formatCurrencyIDR(selectedSlip.baseSalary)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">
                  Tunjangan Kehadiran ({selectedSlip.presentDays} hari hadir)
                </span>
                <span className="font-mono tabular-nums font-medium text-emerald-700">
                  +{formatCurrencyIDR(selectedSlip.totalAllowance)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">
                  Upah Lembur ({selectedSlip.overtimeHours} jam)
                </span>
                <span className="font-mono tabular-nums font-medium text-emerald-700">
                  +{formatCurrencyIDR(selectedSlip.overtimePay)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-900">Komponen Potongan</h4>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">
                  Potongan Keterlambatan ({selectedSlip.lateDays} kali terlambat)
                </span>
                <span className="font-mono tabular-nums font-medium text-red-700">
                  -{formatCurrencyIDR(selectedSlip.lateDeduction)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Potongan BPJS Kesehatan/TK & PPh21 (3%)</span>
                <span className="font-mono tabular-nums font-medium text-slate-700">
                  -{formatCurrencyIDR(selectedSlip.bpjsTaxDeduction)}
                </span>
              </div>
              <div className="flex justify-between py-2 pt-3 border-t border-slate-300 text-sm font-semibold text-slate-900">
                <span>Take Home Pay (Gaji Bersih)</span>
                <span className="font-mono tabular-nums">
                  {formatCurrencyIDR(selectedSlip.netSalary)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
