import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AttendanceLog, UserProfile } from '../types';

interface DepartmentDisciplineChartProps {
  logs: AttendanceLog[];
  allUsers: UserProfile[];
  selectedDate: string;
}

interface DepartmentStat {
  department: string;
  totalStaff: number;
  hadir: number;
  tepatWaktu: number;
  terlambat: number;
  belumAbsen: number;
  izinSakit: number;
  persentaseDisiplin: number;
  persentaseKehadiran: number;
  avgLateMinutes: number;
}

export const DepartmentDisciplineChart: React.FC<DepartmentDisciplineChartProps> = ({
  logs,
  allUsers,
  selectedDate,
}) => {
  const [viewMode, setViewMode] = useState<'selected_date' | 'all_accumulated'>('selected_date');
  const [chartLayout, setChartLayout] = useState<'grouped' | 'stacked'>('grouped');

  // Compute departmental attendance breakdown
  const departmentStats: DepartmentStat[] = useMemo(() => {
    // 1. Gather all unique departments from user profiles and logs
    const deptSet = new Set<string>();
    allUsers.forEach((u) => {
      if (u.department) deptSet.add(u.department.trim());
    });
    logs.forEach((l) => {
      if (l.department) deptSet.add(l.department.trim());
    });

    const activeLogs =
      viewMode === 'selected_date'
        ? logs.filter((l) => l.dateStr === selectedDate)
        : logs;

    const results: DepartmentStat[] = [];

    deptSet.forEach((dept) => {
      const deptUsers = allUsers.filter((u) => u.department?.trim() === dept);
      const totalStaff = Math.max(1, deptUsers.length);

      const deptLogs = activeLogs.filter((l) => l.department?.trim() === dept);

      const tepatWaktuLogs = deptLogs.filter(
        (l) =>
          l.status === 'hadir_tepat_waktu' ||
          (l.status === 'selesai_shift' && (!l.lateMinutes || l.lateMinutes === 0))
      );
      const tepatWaktu = tepatWaktuLogs.length;

      const terlambatLogs = deptLogs.filter(
        (l) => l.status === 'terlambat' || (l.lateMinutes && l.lateMinutes > 0)
      );
      const terlambat = terlambatLogs.length;

      const izinSakitLogs = deptLogs.filter(
        (l) => l.status === 'izin' || l.status === 'sakit'
      );
      const izinSakit = izinSakitLogs.length;

      const hadir = tepatWaktu + terlambat;
      const loggedUserIds = new Set(deptLogs.map((l) => l.userId));
      const belumAbsen = Math.max(
        0,
        deptUsers.filter((u) => !loggedUserIds.has(u.uid)).length
      );

      const totalLateMinutes = terlambatLogs.reduce(
        (acc, l) => acc + (l.lateMinutes || 0),
        0
      );
      const avgLateMinutes =
        terlambat > 0 ? Math.round(totalLateMinutes / terlambat) : 0;

      // Disiplin: % tepat waktu dari total hadir aktual (atau 0 jika belum ada yg hadir)
      const persentaseDisiplin =
        hadir > 0 ? Math.round((tepatWaktu / hadir) * 100) : 0;
      const persentaseKehadiran = Math.round((hadir / totalStaff) * 100);

      results.push({
        department: dept,
        totalStaff,
        hadir,
        tepatWaktu,
        terlambat,
        belumAbsen,
        izinSakit,
        persentaseDisiplin,
        persentaseKehadiran,
        avgLateMinutes,
      });
    });

    // Sort by discipline percentage ascending so lowest discipline department is immediately highlighted
    return results.sort((a, b) => {
      if (a.persentaseDisiplin !== b.persentaseDisiplin) {
        return a.persentaseDisiplin - b.persentaseDisiplin;
      }
      return b.terlambat - a.terlambat;
    });
  }, [allUsers, logs, selectedDate, viewMode]);

  // Identify department with lowest and highest discipline performance
  const lowestDisciplineDept = useMemo(() => {
    if (departmentStats.length === 0) return null;
    // Prefer departments that have actual attendance logs or tardiness
    const withActivity = departmentStats.filter((d) => d.hadir > 0);
    if (withActivity.length > 0) {
      return withActivity[0];
    }
    return departmentStats[0];
  }, [departmentStats]);

  const highestDisciplineDept = useMemo(() => {
    if (departmentStats.length === 0) return null;
    const withActivity = departmentStats.filter((d) => d.hadir > 0);
    if (withActivity.length > 0) {
      return withActivity[withActivity.length - 1];
    }
    return departmentStats[departmentStats.length - 1];
  }, [departmentStats]);

  const totalLateAllDepts = useMemo(() => {
    return departmentStats.reduce((acc, d) => acc + d.terlambat, 0);
  }, [departmentStats]);

  // Custom tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = departmentStats.find((d) => d.department === label);
    if (!item) return null;

    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[230px] space-y-2 animate-in fade-in zoom-in-95 duration-100">
        <div className="border-b border-slate-700/80 pb-2">
          <div className="font-semibold text-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              {item.department}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                item.persentaseDisiplin >= 85
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : item.persentaseDisiplin >= 60
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-red-500/20 text-red-300'
              }`}
            >
              Disiplin: {item.persentaseDisiplin}%
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            Total Anggota: {item.totalStaff} staf
          </div>
        </div>

        <div className="space-y-1.5 font-mono tabular-nums text-[11px]">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Tepat Waktu:
            </span>
            <span className="font-bold">{item.tepatWaktu} staf</span>
          </div>

          <div className="flex items-center justify-between text-amber-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              Terlambat:
            </span>
            <span className="font-bold">
              {item.terlambat} staf{' '}
              {item.avgLateMinutes > 0 && (
                <span className="text-[10px] text-amber-400 font-normal">
                  (Rata-rata {item.avgLateMinutes}m)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />
              Belum Absen:
            </span>
            <span>{item.belumAbsen} staf</span>
          </div>

          <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-slate-300 font-sans">
            <span>Rasio Ketepatan Hadir:</span>
            <span className="font-mono font-bold text-slate-100">
              {item.tepatWaktu} / {item.hadir} ({item.persentaseDisiplin}%)
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border border-slate-200 bg-white rounded-xl p-5 space-y-5 shadow-xs">
      {/* Section Header & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              Distribusi Status Kehadiran per Departemen (Tepat Waktu vs Terlambat)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Komparasi tingkat disiplin kerja antar departemen unit pembangkit untuk identifikasi cepat unit dengan performa kedisiplinan terendah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Filter Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('selected_date')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'selected_date'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tanggal {selectedDate}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all_accumulated')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'all_accumulated'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Log
            </button>
          </div>

          {/* Chart Layout Toggle: Grouped vs Stacked */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setChartLayout('grouped')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                chartLayout === 'grouped'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Batang Bersisian"
            >
              Grup
            </button>
            <button
              type="button"
              onClick={() => setChartLayout('stacked')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                chartLayout === 'stacked'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Batang Bertumpuk"
            >
              Tumpuk
            </button>
          </div>
        </div>
      </div>

      {/* Immediate Admin Insight: Highlight Lowest Discipline Unit */}
      {lowestDisciplineDept && lowestDisciplineDept.terlambat > 0 ? (
        <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-amber-950 flex items-center gap-2">
                <span>Unit Disiplin Terendah: <strong>{lowestDisciplineDept.department}</strong></span>
                <span className="font-mono text-[11px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                  {lowestDisciplineDept.persentaseDisiplin}% Ketepatan
                </span>
              </div>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Tercatat <strong>{lowestDisciplineDept.terlambat} staf terlambat</strong> dari total {lowestDisciplineDept.hadir} staf hadir (Rata-rata telat: {lowestDisciplineDept.avgLateMinutes} menit).
              </p>
            </div>
          </div>

          {highestDisciplineDept && highestDisciplineDept.department !== lowestDisciplineDept.department && (
            <div className="flex items-center gap-2 bg-white/80 border border-emerald-200 px-3 py-1.5 rounded-lg text-[11px] text-emerald-900">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Disiplin Terbaik: <strong>{highestDisciplineDept.department}</strong> ({highestDisciplineDept.persentaseDisiplin}%)
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Seluruh departemen beroperasi dengan kepatuhan jam kerja prima (100% tepat waktu pada data yang dipilih).
          </span>
        </div>
      )}

      {/* Main Bar Chart */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={departmentStats}
            margin={{ top: 10, right: 15, left: -15, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="department"
              tick={{ fontSize: 11, fill: '#475569' }}
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
              interval={0}
              angle={-15}
              textAnchor="end"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
              formatter={(value) => {
                if (value === 'tepatWaktu')
                  return <span className="text-emerald-800 font-medium">Tepat Waktu</span>;
                if (value === 'terlambat')
                  return <span className="text-amber-800 font-medium">Terlambat</span>;
                return value;
              }}
            />
            <Bar
              dataKey="tepatWaktu"
              name="tepatWaktu"
              fill="#059669"
              radius={chartLayout === 'stacked' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
              stackId={chartLayout === 'stacked' ? 'a' : undefined}
              maxBarSize={44}
            />
            <Bar
              dataKey="terlambat"
              name="terlambat"
              fill="#D97706"
              radius={[6, 6, 0, 0]}
              stackId={chartLayout === 'stacked' ? 'a' : undefined}
              maxBarSize={44}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Department Discipline Ranking Summary Table */}
      <div className="pt-2 border-t border-slate-100">
        <div className="text-xs font-semibold text-slate-800 mb-2.5 flex items-center justify-between">
          <span>Tabel Evaluasi Kedisiplinan per Departemen</span>
          <span className="text-[11px] font-normal text-slate-500">
            Diurutkan dari performa disiplin terendah ke tertinggi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {departmentStats.map((dept, idx) => {
            const isLowest = idx === 0 && dept.terlambat > 0;
            return (
              <div
                key={dept.department}
                className={`p-3 rounded-lg border transition-all ${
                  isLowest
                    ? 'border-amber-300 bg-amber-50/50 shadow-xs'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-slate-900 truncate" title={dept.department}>
                    {dept.department}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      dept.persentaseDisiplin >= 85
                        ? 'bg-emerald-100 text-emerald-800'
                        : dept.persentaseDisiplin >= 60
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {dept.persentaseDisiplin}%
                  </span>
                </div>

                <div className="mt-2 space-y-1 text-[11px] font-mono tabular-nums text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700">✓ Tepat Waktu:</span>
                    <strong className="text-slate-900">{dept.tepatWaktu} orang</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700">⚠ Terlambat:</span>
                    <strong className={dept.terlambat > 0 ? 'text-amber-800' : 'text-slate-700'}>
                      {dept.terlambat} orang
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-200/60">
                    <span>Total Hadir / Staf:</span>
                    <span>
                      {dept.hadir} / {dept.totalStaff}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
