import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  LineChart as LineChartIcon,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AttendanceLog, UserProfile } from '../types';

interface AttendanceTrendChartProps {
  logs: AttendanceLog[];
  allUsers: UserProfile[];
  selectedDate: string;
  onSelectDate?: (dateStr: string) => void;
}

interface DayTrendData {
  dateStr: string;
  shortLabel: string;
  fullLabel: string;
  dayName: string;
  hadir: number;
  terlambat: number;
  tepatWaktu: number;
  totalKaryawan: number;
  persentaseKetepatan: number;
  tingkatKehadiran: number;
  isSelected: boolean;
}

export const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({
  logs,
  allUsers,
  selectedDate,
  onSelectDate,
}) => {
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [anchorMode, setAnchorMode] = useState<'selected' | 'today'>('selected');

  // Compute 7 days series ending at anchor date
  const trendData: DayTrendData[] = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Reference date based on anchor
    let refDate = new Date();
    if (anchorMode === 'selected' && selectedDate) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        refDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
    }

    const days: DayTrendData[] = [];
    const totalStaffCount = Math.max(1, allUsers.length);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(refDate);
      d.setDate(refDate.getDate() - i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
      const shortLabel = `${dayName}, ${dd}/${mm}`;
      const fullLabel = d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      // Filter logs for this specific day
      const dayLogs = logs.filter((l) => l.dateStr === dateStr);

      // Present: any valid attendance status
      const presentLogs = dayLogs.filter((l) =>
        ['hadir_tepat_waktu', 'terlambat', 'lembur', 'selesai_shift'].includes(l.status)
      );
      const hadirCount = presentLogs.length;

      // Late count: status is terlambat or lateMinutes > 0
      const lateLogs = dayLogs.filter(
        (l) => l.status === 'terlambat' || (l.lateMinutes && l.lateMinutes > 0)
      );
      const terlambatCount = lateLogs.length;

      const tepatWaktuCount = Math.max(0, hadirCount - terlambatCount);
      const persentaseKetepatan =
        hadirCount > 0 ? Math.round((tepatWaktuCount / hadirCount) * 100) : 0;
      const tingkatKehadiran = Math.round((hadirCount / totalStaffCount) * 100);

      days.push({
        dateStr,
        shortLabel,
        fullLabel,
        dayName,
        hadir: hadirCount,
        terlambat: terlambatCount,
        tepatWaktu: tepatWaktuCount,
        totalKaryawan: totalStaffCount,
        persentaseKetepatan,
        tingkatKehadiran,
        isSelected: dateStr === selectedDate,
      });
    }

    return days;
  }, [allUsers.length, anchorMode, logs, selectedDate]);

  // Aggregate stats over the 7-day period
  const stats = useMemo(() => {
    const totalHadir = trendData.reduce((acc, d) => acc + d.hadir, 0);
    const totalTerlambat = trendData.reduce((acc, d) => acc + d.terlambat, 0);
    const totalTepatWaktu = trendData.reduce((acc, d) => acc + d.tepatWaktu, 0);
    const avgHadir = (totalHadir / trendData.length).toFixed(1);
    const avgTerlambat = (totalTerlambat / trendData.length).toFixed(1);

    const overallOnTimeRate =
      totalHadir > 0 ? Math.round((totalTepatWaktu / totalHadir) * 100) : 0;

    // Peak attendance day
    const peakDay = [...trendData].sort((a, b) => b.hadir - a.hadir)[0];

    // Trend direction comparing first 3 days vs last 3 days
    const firstHalfHadir = trendData.slice(0, 3).reduce((acc, d) => acc + d.hadir, 0) / 3;
    const lastHalfHadir = trendData.slice(-3).reduce((acc, d) => acc + d.hadir, 0) / 3;
    const isTrendingUp = lastHalfHadir >= firstHalfHadir;

    return {
      totalHadir,
      totalTerlambat,
      totalTepatWaktu,
      avgHadir,
      avgTerlambat,
      overallOnTimeRate,
      peakDay,
      isTrendingUp,
    };
  }, [trendData]);

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const currentItem = trendData.find((d) => d.shortLabel === label);
    if (!currentItem) return null;

    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[210px] space-y-2 animate-in fade-in zoom-in-95 duration-100">
        <div className="border-b border-slate-700/80 pb-2">
          <div className="font-semibold text-slate-100 flex items-center justify-between">
            <span>{currentItem.fullLabel}</span>
            {currentItem.isSelected && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                Hari Terpilih
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
            Total Staf Terdaftar: {currentItem.totalKaryawan} orang
          </div>
        </div>

        <div className="space-y-1.5 font-mono tabular-nums text-[11px]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-400 font-sans">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Total Staf Hadir:
            </span>
            <span className="font-bold text-slate-100 text-xs">
              {currentItem.hadir} staf ({currentItem.tingkatKehadiran}%)
            </span>
          </div>

          <div className="flex items-center justify-between pl-4 text-emerald-300/80">
            <span className="font-sans">↳ Tepat Waktu:</span>
            <span>{currentItem.tepatWaktu} staf</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-amber-400 font-sans">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              Staf Terlambat:
            </span>
            <span className="font-bold text-amber-300 text-xs">
              {currentItem.terlambat} staf
            </span>
          </div>

          <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-slate-300 font-sans">
            <span>Tingkat Ketepatan:</span>
            <span
              className={`font-mono font-bold ${
                currentItem.persentaseKetepatan >= 85
                  ? 'text-emerald-400'
                  : currentItem.persentaseKetepatan >= 70
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {currentItem.persentaseKetepatan}%
            </span>
          </div>
        </div>

        {onSelectDate && (
          <div className="pt-1.5 text-[10px] text-slate-400 italic text-center border-t border-slate-800">
            Klik bar untuk melihat detail tanggal ini
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border border-slate-200 bg-white rounded-xl p-5 space-y-5 shadow-xs">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              Tren Kehadiran Staf (7 Hari Terakhir)
            </h2>
            <span className="text-[11px] font-mono tabular-nums bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
              {trendData[0]?.shortLabel} – {trendData[trendData.length - 1]?.shortLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualisasi perbandingan jumlah staf hadir kerja vs keterlambatan harian di seluruh unit pembangkit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Anchor Range Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setAnchorMode('selected')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                anchorMode === 'selected'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="7 hari dihitung mundur dari tanggal yang dipilih di filter atas"
            >
              Sampai {selectedDate}
            </button>
            <button
              type="button"
              onClick={() => setAnchorMode('today')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                anchorMode === 'today'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="7 hari dihitung mundur dari hari ini"
            >
              7 Hari Terkini
            </button>
          </div>

          {/* Chart View Toggle: Bar vs Area */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                chartType === 'bar'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilan Diagram Batang"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Batang</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                chartType === 'area'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilan Diagram Area/Garis"
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span>Area</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Rata-rata Hadir / Hari</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {stats.avgHadir}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              / {allUsers.length} staf
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Rata-rata Terlambat</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tabular-nums text-amber-700">
              {stats.avgTerlambat}
            </span>
            <span className="text-xs text-slate-500">staf / hari</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Ketepatan Waktu 7 Hari</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tabular-nums text-emerald-700">
              {stats.overallOnTimeRate}%
            </span>
            <span className="text-[11px] text-slate-500">
              ({stats.totalTepatWaktu}/{stats.totalHadir})
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Puncak Kehadiran</span>
            {stats.isTrendingUp ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {stats.peakDay?.hadir ?? 0}
            </span>
            <span className="text-xs text-slate-500 truncate" title={stats.peakDay?.fullLabel}>
              ({stats.peakDay?.shortLabel})
            </span>
          </div>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart
              data={trendData}
              margin={{ top: 10, right: 15, left: -15, bottom: 5 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length && onSelectDate) {
                  const clickedDate = state.activePayload[0].payload?.dateStr;
                  if (clickedDate) onSelectDate(clickedDate);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1' }}
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
                  if (value === 'hadir') return <span className="text-slate-700 font-medium">Staf Hadir</span>;
                  if (value === 'terlambat') return <span className="text-amber-800 font-medium">Staf Terlambat</span>;
                  return value;
                }}
              />
              <Bar
                dataKey="hadir"
                name="hadir"
                fill="#059669"
                radius={[6, 6, 0, 0]}
                maxBarSize={42}
                cursor={onSelectDate ? 'pointer' : 'default'}
              />
              <Bar
                dataKey="terlambat"
                name="terlambat"
                fill="#D97706"
                radius={[6, 6, 0, 0]}
                maxBarSize={42}
                cursor={onSelectDate ? 'pointer' : 'default'}
              />
            </BarChart>
          ) : (
            <AreaChart
              data={trendData}
              margin={{ top: 10, right: 15, left: -15, bottom: 5 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length && onSelectDate) {
                  const clickedDate = state.activePayload[0].payload?.dateStr;
                  if (clickedDate) onSelectDate(clickedDate);
                }
              }}
            >
              <defs>
                <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorTerlambat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D97706" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1' }}
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
                  if (value === 'hadir') return <span className="text-slate-700 font-medium">Staf Hadir</span>;
                  if (value === 'terlambat') return <span className="text-amber-800 font-medium">Staf Terlambat</span>;
                  return value;
                }}
              />
              <Area
                type="monotone"
                dataKey="hadir"
                name="hadir"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorHadir)"
                cursor={onSelectDate ? 'pointer' : 'default'}
              />
              <Area
                type="monotone"
                dataKey="terlambat"
                name="terlambat"
                stroke="#D97706"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorTerlambat)"
                cursor={onSelectDate ? 'pointer' : 'default'}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer Navigation / Interactive Date Selection Pills */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>Klik tanggal pada grafik atau baris di bawah untuk mengganti fokus tanggal:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {trendData.map((d) => (
            <button
              key={d.dateStr}
              type="button"
              onClick={() => onSelectDate && onSelectDate(d.dateStr)}
              className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums transition-colors ${
                d.isSelected
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title={`${d.fullLabel}: ${d.hadir} hadir, ${d.terlambat} terlambat`}
            >
              {d.dayName} {d.dateStr.slice(-2)}
              <span
                className={`ml-1 font-bold ${
                  d.isSelected
                    ? 'text-emerald-300'
                    : d.terlambat > 0
                    ? 'text-amber-600'
                    : 'text-emerald-700'
                }`}
              >
                ({d.hadir})
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
