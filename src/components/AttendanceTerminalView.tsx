import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  Bell,
  CheckCircle2,
  LocateFixed,
  LogOut,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import {
  AttendanceLog,
  AttendanceReminder,
  AttendanceStatus,
  OfficeConfig,
  ShiftSwapRequest,
  UserProfile,
} from '../types';
import {
  evaluateMultiUnitGeofence,
  formatCoordinates,
  formatDurationHoursMinutes,
  getRegisteredPowerUnits,
  IPS_POWER_UNITS,
  PowerPlantUnit,
} from '../utils/geo';
import { ShiftSwapManager } from './ShiftSwapManager';

interface AttendanceTerminalViewProps {
  profile: UserProfile;
  officeConfig: OfficeConfig;
  todayLog: AttendanceLog | null;
  unreadReminders: AttendanceReminder[];
  onCheckIn: (params: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    locationLabel: string;
    statusOverride?: AttendanceStatus;
    notes: string;
  }) => Promise<void>;
  onCheckOut: (log: AttendanceLog, notes: string) => Promise<void>;
  onAcknowledgeReminder: (reminder: AttendanceReminder) => Promise<void>;
  isAdmin?: boolean;
  allUsers?: UserProfile[];
  shiftSwaps?: ShiftSwapRequest[];
  powerUnits?: PowerPlantUnit[];
  onRequestShiftSwap?: (
    data: Omit<ShiftSwapRequest, 'swapId' | 'status' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onReviewShiftSwap?: (
    swapId: string,
    status: 'approved' | 'rejected',
    adminNotes: string
  ) => Promise<void>;
  onCancelShiftSwap?: (swapId: string) => Promise<void>;
}

export const AttendanceTerminalView: React.FC<AttendanceTerminalViewProps> = ({
  profile,
  officeConfig,
  todayLog,
  unreadReminders,
  onCheckIn,
  onCheckOut,
  onAcknowledgeReminder,
  isAdmin = false,
  allUsers = [],
  shiftSwaps = [],
  powerUnits,
  onRequestShiftSwap,
  onReviewShiftSwap,
  onCancelShiftSwap,
}) => {
  const activeUnits = powerUnits && powerUnits.length > 0 ? powerUnits : getRegisteredPowerUnits();
  // Local fallback state for Shift Swaps if parent handlers are not provided
  const [internalShiftSwaps, setInternalShiftSwaps] = useState<ShiftSwapRequest[]>([]);
  const effectiveShiftSwaps = shiftSwaps.length > 0 ? shiftSwaps : internalShiftSwaps;

  const handleRequestSwap = async (
    data: Omit<ShiftSwapRequest, 'swapId' | 'status' | 'createdAt' | 'updatedAt'>
  ) => {
    if (onRequestShiftSwap) {
      await onRequestShiftSwap(data);
      return;
    }
    const newSwap: ShiftSwapRequest = {
      ...data,
      swapId: `swap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: 'pending',
    };
    setInternalShiftSwaps((prev) => [newSwap, ...prev]);
  };

  const handleReviewSwap = async (
    swapId: string,
    status: 'approved' | 'rejected',
    adminNotes: string
  ) => {
    if (onReviewShiftSwap) {
      await onReviewShiftSwap(swapId, status, adminNotes);
      return;
    }
    setInternalShiftSwaps((prev) =>
      prev.map((s) =>
        s.swapId === swapId
          ? {
              ...s,
              status,
              adminNotes,
              reviewedByName: profile.name,
              reviewedByUid: profile.uid,
            }
          : s
      )
    );
  };

  const handleCancelSwap = async (swapId: string) => {
    if (onCancelShiftSwap) {
      await onCancelShiftSwap(swapId);
      return;
    }
    setInternalShiftSwaps((prev) =>
      prev.map((s) => (s.swapId === swapId ? { ...s, status: 'cancelled' } : s))
    );
  };
  // Default simulation starts at activeUnits[0]
  const defaultUnit = activeUnits[0] || IPS_POWER_UNITS[0];
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    source: 'gps' | 'unit_sim';
  }>({
    lat: defaultUnit.latitude + 0.00028,
    lng: defaultUnit.longitude - 0.00021,
    accuracy: 10,
    source: 'unit_sim',
  });
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState(todayLog?.notes || '');
  const [selectedMode, setSelectedMode] = useState<'hadir' | 'izin' | 'sakit' | 'lembur'>('hadir');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const multiUnitEval = evaluateMultiUnitGeofence(
    coords.lat,
    coords.lng,
    officeConfig.radiusMeters,
    activeUnits
  );
  const { nearestUnit, nearestDistanceMeters, isWithinAnyUnit, allUnitDistances } = multiUnitEval;

  const requiresPhysicalPresence = selectedMode === 'hadir' || selectedMode === 'lembur';
  const isBlockedByAntiFraud = requiresPhysicalPresence && !isWithinAnyUnit;

  const handleAcquireBrowserGPS = () => {
    if (!navigator.geolocation) {
      setFeedback({
        type: 'error',
        text: 'Perangkat tidak mendukung HTML5 Geolocation API.',
      });
      return;
    }
    setLocating(true);
    setFeedback(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 12),
          source: 'gps',
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setFeedback({
          type: 'error',
          text: 'Izin lokasi browser belum diaktifkan. Silakan izinkan akses GPS atau gunakan tombol uji lokasi 4 unit di bawah.',
        });
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (isBlockedByAntiFraud) {
      setFeedback({
        type: 'error',
        text: `DITOLAK (Proteksi Anti-Manipulasi): Jarak Anda saat ini ${nearestDistanceMeters}m dari unit terdekat (${nearestUnit.name}), melebihi batas maksimal ${officeConfig.radiusMeters}m. Anda wajib berada di dalam radius salah satu dari 4 unit resmi (PLTU Jeranjang, PLTD Ampenan, PLTD Pringgabaya, atau PLTU Taliwang).`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const resolvedLocationLabel = isWithinAnyUnit
        ? `${nearestUnit.name} (${nearestUnit.region})`
        : `Izin/Sakit di Luar Unit (Terdekat: ${nearestUnit.code})`;

      await onCheckIn({
        latitude: coords.lat,
        longitude: coords.lng,
        accuracyMeters: coords.accuracy,
        locationLabel: resolvedLocationLabel,
        statusOverride:
          selectedMode === 'hadir' ? undefined : (selectedMode as AttendanceStatus),
        notes,
      });
      setFeedback({
        type: 'success',
        text: `Absensi berhasil dikunci di ${nearestUnit.name} (Jarak ${nearestDistanceMeters}m — Valid di dalam radius ${officeConfig.radiusMeters}m).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mencatat absensi.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOutSubmit = async () => {
    if (!todayLog) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await onCheckOut(todayLog, notes);
      setFeedback({
        type: 'success',
        text: 'Check-out selesai shift berhasil disimpan. Terima kasih atas dedikasi Anda hari ini!',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal melakukan check-out.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Unread Automated Reminders Banner */}
      {unreadReminders.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
            <Bell className="w-4 h-4 shrink-0" />
            <span>Pengingat Kehadiran Otomatis ({unreadReminders.length} Pesan Belum Dibaca)</span>
          </div>
          <div className="space-y-2">
            {unreadReminders.map((rem) => (
              <div
                key={rem.reminderId}
                className="flex flex-wrap items-center justify-between gap-3 bg-white border border-amber-200 rounded-lg px-4 py-2.5 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900">{rem.targetUserName}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="text-slate-700">{rem.message}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="font-mono tabular-nums text-slate-500">{rem.dateStr}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onAcknowledgeReminder(rem)}
                  className="px-3 py-1 text-xs font-medium text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors whitespace-nowrap"
                >
                  Tandai Sudah Dibaca
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Multi-Unit GPS Telemetry & Check-In Form */}
        <div className="lg:col-span-7 border border-slate-200 bg-white rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Indonesia Power Service — Sistem Absensi Multi-Unit Lombok & Sumbawa</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 font-display mt-0.5">
                Terminal Check-In & Validasi Jarak 4 Unit Pembangkit
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {profile.name} · {profile.employeeCode} · Shift {officeConfig.shiftStart} –{' '}
                {officeConfig.shiftEnd} WITA
              </p>
            </div>
            <button
              type="button"
              disabled={locating}
              onClick={handleAcquireBrowserGPS}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              {locating ? 'Mengambil Sinyal GPS...' : 'Ambil Titik GPS Perangkat'}
            </button>
          </div>

          {/* Live Coordinate & Nearest Unit Readout */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-lg text-xs ${
              isWithinAnyUnit
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-red-50/70 border-red-200'
            }`}
          >
            <div>
              <span className="text-slate-600 block">Unit Pembangkit Terdekat</span>
              <span className="font-semibold text-slate-900 mt-0.5 block">
                {nearestUnit.name}
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                {formatCoordinates(coords.lat, coords.lng)}
              </span>
            </div>
            <div>
              <span className="text-slate-600 block">Jarak ke Titik Unit</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 text-sm mt-0.5 block">
                {nearestDistanceMeters} meter
              </span>
              <span className="text-slate-500">Batas Maksimal: {officeConfig.radiusMeters}m</span>
            </div>
            <div>
              <span className="text-slate-600 block">Status Validasi Lokasi</span>
              <span
                className={`font-semibold mt-0.5 block ${
                  isWithinAnyUnit ? 'text-emerald-800' : 'text-red-800'
                }`}
              >
                {isWithinAnyUnit
                  ? `SAH — Di Dalam Area ${nearestUnit.code}`
                  : 'DITOLAK — Di Luar 4 Unit Resmi'}
              </span>
              <span className="text-slate-500">
                {isWithinAnyUnit
                  ? 'Dapat melakukan check-in hadir'
                  : 'Absen hadir dikunci otomatis'}
              </span>
            </div>
          </div>

          {/* Simulasi Perpindahan Antar Unit Kerja (Untuk Pengujian Cepat) */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-700 block">
              Simulasi Posisi Staf Saat Bertugas / Pindah Unit Kerja ({activeUnits.length} Unit Terdaftar):
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {activeUnits.map((unit, idx) => {
                const offsets = [
                  { dLat: 0.00028, dLng: -0.00021 }, // ~38m
                  { dLat: -0.00022, dLng: 0.00025 }, // ~36m
                  { dLat: 0.00035, dLng: 0.00028 }, // ~49m
                  { dLat: -0.00031, dLng: -0.00029 }, // ~46m
                ][idx % 4];
                return (
                  <button
                    key={unit.unitId}
                    type="button"
                    onClick={() => {
                      setCoords({
                        lat: unit.latitude + offsets.dLat,
                        lng: unit.longitude + offsets.dLng,
                        accuracy: 9,
                        source: 'unit_sim',
                      });
                      setFeedback(null);
                    }}
                    className={`px-3 py-1.5 border rounded-lg transition-colors whitespace-nowrap ${
                      isWithinAnyUnit && nearestUnit.unitId === unit.unitId
                        ? 'bg-slate-900 text-white border-slate-900 font-medium'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Di {unit.name}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  // Simulate employee trying to check in from Mataram residential/cafe ~3.8km away from any unit
                  setCoords({
                    lat: -8.5985,
                    lng: 116.1185,
                    accuracy: 15,
                    source: 'unit_sim',
                  });
                  setFeedback(null);
                }}
                className={`px-3 py-1.5 border rounded-lg transition-colors whitespace-nowrap ${
                  !isWithinAnyUnit
                    ? 'bg-red-700 text-white border-red-700 font-medium'
                    : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                }`}
              >
                Simulasi di Luar Seluruh Unit (Uji Blokir Curang)
              </button>
            </div>
          </div>

          {/* Status Absen Masuk & Absen Keluar Hari Ini */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
            <div
              className={`p-3.5 rounded-lg border flex items-center justify-between ${
                todayLog
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div>
                <div className="text-[11px] font-medium text-slate-500">Status Absen Masuk</div>
                <div className="font-semibold text-sm mt-0.5">
                  {todayLog ? `Masuk Pukul ${todayLog.checkInTime}` : 'Belum Absen Masuk'}
                </div>
                {todayLog && (
                  <div className="font-mono tabular-nums text-[11px] text-emerald-800 mt-0.5">
                    {todayLog.locationLabel} ({todayLog.distanceMeters}m)
                  </div>
                )}
              </div>
              <CheckCircle2
                className={`w-5 h-5 shrink-0 ${
                  todayLog ? 'text-emerald-600' : 'text-slate-300'
                }`}
              />
            </div>

            <div
              className={`p-3.5 rounded-lg border flex items-center justify-between ${
                todayLog?.checkOutTime
                  ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div>
                <div className="text-[11px] font-medium text-slate-500">Status Absen Keluar</div>
                <div className="font-semibold text-sm mt-0.5">
                  {todayLog?.checkOutTime
                    ? `Keluar Pukul ${todayLog.checkOutTime}`
                    : 'Belum Absen Keluar'}
                </div>
                {todayLog?.checkOutTime && (
                  <div className="font-mono tabular-nums text-[11px] text-blue-800 mt-0.5">
                    Durasi Kerja: {formatDurationHoursMinutes(todayLog.workDurationMinutes)}
                  </div>
                )}
              </div>
              <LogOut
                className={`w-5 h-5 shrink-0 ${
                  todayLog?.checkOutTime ? 'text-blue-600' : 'text-slate-300'
                }`}
              />
            </div>
          </div>

          <form onSubmit={handleCheckInSubmit} className="space-y-4 pt-3 border-t border-slate-200">
            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1.5">
                Pilih Jenis Kehadiran Hari Ini
              </span>
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-lg w-fit">
                {(
                  [
                    { id: 'hadir', label: 'Hadir di Unit Kerja' },
                    { id: 'lembur', label: 'Shift Lembur Unit' },
                    { id: 'izin', label: 'Izin Resmi' },
                    { id: 'sakit', label: 'Sakit' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedMode(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      selectedMode === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {isBlockedByAntiFraud && (
              <div className="p-3.5 bg-red-50 border border-red-300 rounded-lg text-xs text-red-900 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">
                    Lokasi di Luar Radius 4 Unit Pembangkit — Tombol Absen Masuk Dikunci!
                  </div>
                  <p className="mt-0.5 text-red-800">
                    Posisi Anda berjarak <strong>{nearestDistanceMeters} meter</strong> dari{' '}
                    <strong>{nearestUnit.name}</strong> (batas maksimal{' '}
                    <strong>{officeConfig.radiusMeters} meter</strong>). Karyawan tidak dapat
                    melakukan absen hadir dari luar wilayah PLTU Jeranjang, PLTD Ampenan, PLTD
                    Pringgabaya, atau PLTU Taliwang.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Unit Pembangkit Terdeteksi Otomatis
                </label>
                <input
                  type="text"
                  readOnly
                  value={
                    isWithinAnyUnit
                      ? `${nearestUnit.name} (${nearestDistanceMeters}m)`
                      : `Di Luar Zona (${nearestDistanceMeters}m dari ${nearestUnit.code})`
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-100 text-slate-700 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Pekerjaan / Laporan Penyelesaian Shift
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Pemeliharaan turbin / inspeksi panel unit"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Dua Tombol Utama: Absen Masuk & Absen Keluar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting || isBlockedByAntiFraud}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MapPin className="w-4 h-4" />
                {submitting
                  ? 'Memproses Absen...'
                  : isBlockedByAntiFraud
                  ? 'Absen Masuk Dikunci (Luar Radius)'
                  : todayLog
                  ? `Absen Masuk Ulang / Pindah Unit (${nearestUnit.code})`
                  : `Absen Masuk (Check-In) — ${nearestUnit.code}`}
              </button>

              <button
                type="button"
                disabled={submitting || !todayLog}
                onClick={handleCheckOutSubmit}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {submitting
                  ? 'Memproses Check-Out...'
                  : !todayLog
                  ? 'Absen Keluar (Wajib Absen Masuk Dulu)'
                  : todayLog.checkOutTime
                  ? `Perbarui Absen Keluar (${todayLog.checkOutTime.slice(0, 5)})`
                  : 'Absen Keluar (Check-Out Selesai Shift)'}
              </button>
            </div>
          </form>

          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs font-medium ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>

        {/* Right: Live Distance Table to All Registered Indonesia Power Service Units */}
        <div className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <Clock className="w-4 h-4 text-slate-700" />
                <span>Radar Jarak ke {activeUnits.length} Unit Indonesia Power Service</span>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                Radius Sah: ≤ {officeConfig.radiusMeters}m
              </span>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden text-xs">
              {allUnitDistances.map(({ unit, distanceMeters, isInside }) => (
                <div
                  key={unit.unitId}
                  className={`p-3.5 flex items-center justify-between gap-3 ${
                    isInside ? 'bg-emerald-50/60' : 'bg-white'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {unit.name}
                    </div>
                    <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                      {unit.code} · {unit.region} · {unit.latitude.toFixed(4)},{' '}
                      {unit.longitude.toFixed(4)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums font-semibold text-slate-900">
                      {distanceMeters.toLocaleString('id-ID')} m
                    </div>
                    <div
                      className={`font-medium ${
                        isInside ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {isInside ? 'Di Dalam Zona' : 'Di Luar Radius'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-900">
              Fleksibel Pindah Unit, Ketat Anti-Titip Absen
            </div>
            <p>
              Teknisi yang ditugaskan berpindah antara <strong>PLTU Jeranjang Gerung</strong>,{' '}
              <strong>PLTD Ampenan</strong>, <strong>PLTD Pringgabaya</strong>, maupun{' '}
              <strong>PLTU Taliwang Sumbawa</strong> otomatis tervalidasi saat berada di dalam
              radius unit tersebut, namun tidak dapat melakukan absen hadir dari luar ke-4 titik
              pembangkit.
            </p>
          </div>
        </div>
      </div>

      {/* Shift Swap Management & Admin Approval Workflow */}
      <ShiftSwapManager
        currentUser={profile}
        isAdmin={isAdmin}
        allUsers={allUsers}
        shiftSwaps={effectiveShiftSwaps}
        onRequestSwap={handleRequestSwap}
        onReviewSwap={handleReviewSwap}
        onCancelSwap={handleCancelSwap}
      />
    </div>
  );
};
