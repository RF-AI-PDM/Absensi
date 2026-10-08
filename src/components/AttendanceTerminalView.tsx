import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  Bell,
  Camera,
  CheckCircle2,
  Eye,
  LocateFixed,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
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
import { FaceCameraView } from './FaceCameraView';
import { FaceVerificationDetailModal } from './FaceVerificationDetailModal';
import { uploadFaceVerificationSnapshot } from '../utils/faceVerification';

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
    faceVerificationUrl?: string;
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

  // Face Verification State
  const [faceSnapshot, setFaceSnapshot] = useState<string | null>(null);
  const [showCameraView, setShowCameraView] = useState<boolean>(false);
  const [inspectingModalLog, setInspectingModalLog] = useState<AttendanceLog | null>(null);
  const [uploadingFace, setUploadingFace] = useState<boolean>(false);

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

    if ((selectedMode === 'izin' || selectedMode === 'sakit') && !notes.trim()) {
      setFeedback({
        type: 'error',
        text: `Mohon cantumkan teks alasan atau keterangan ${
          selectedMode === 'sakit' ? 'sakit & rujukan surat dokter' : 'keperluan izin resmi'
        } sebelum mengirim absensi.`,
      });
      return;
    }

    // Biometric face verification requirement for physical attendance
    if (requiresPhysicalPresence && !faceSnapshot && !todayLog?.faceVerificationUrl) {
      setShowCameraView(true);
      setFeedback({
        type: 'error',
        text: 'Verifikasi wajah wajib dilakukan untuk absensi Hadir & Lembur. Silakan ambil foto wajah Anda pada bingkai kamera di bawah.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const resolvedLocationLabel = isWithinAnyUnit
        ? `${nearestUnit.name} (${nearestUnit.region})`
        : selectedMode === 'sakit'
        ? `Laporan Sakit Mandiri (Terdekat: ${nearestUnit.code})`
        : selectedMode === 'izin'
        ? `Izin Resmi Tercatat (Terdekat: ${nearestUnit.code})`
        : `Luar Unit Resmi (Terdekat: ${nearestUnit.code})`;

      let finalFaceUrl: string | undefined = todayLog?.faceVerificationUrl;

      // Upload snapshot to Firebase Storage with AES-256 client-side packaging
      if (faceSnapshot) {
        setUploadingFace(true);
        const uploadResult = await uploadFaceVerificationSnapshot({
          imageDataUrl: faceSnapshot,
          userId: profile.uid,
          userName: profile.name,
          locationLabel: resolvedLocationLabel,
          latitude: coords.lat,
          longitude: coords.lng,
          logId: `log_${profile.uid}_${new Date().toISOString().slice(0, 10)}`,
        });
        finalFaceUrl = uploadResult.faceVerificationUrl;
        setUploadingFace(false);
      }

      await onCheckIn({
        latitude: coords.lat,
        longitude: coords.lng,
        accuracyMeters: coords.accuracy,
        locationLabel: resolvedLocationLabel,
        statusOverride:
          selectedMode === 'hadir' ? undefined : (selectedMode as AttendanceStatus),
        notes: notes.trim(),
        faceVerificationUrl: finalFaceUrl,
      });

      setFeedback({
        type: 'success',
        text:
          selectedMode === 'sakit'
            ? `Absensi Sakit berhasil disimpan ke sistem dengan alasan: "${notes.trim()}". Semoga lekas pulih!`
            : selectedMode === 'izin'
            ? `Pengajuan Izin Resmi berhasil dicatat di Firestore dengan alasan: "${notes.trim()}".`
            : `Absensi & Verifikasi Wajah berhasil dikunci di ${nearestUnit.name} (Jarak ${nearestDistanceMeters}m — Tersimpan di Firebase Storage).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mencatat absensi.',
      });
    } finally {
      setSubmitting(false);
      setUploadingFace(false);
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
                      : selectedMode === 'sakit' || selectedMode === 'izin'
                      ? `Dispensasi Luar Unit (${selectedMode === 'sakit' ? 'Sakit' : 'Izin'})`
                      : `Di Luar Zona (${nearestDistanceMeters}m dari ${nearestUnit.code})`
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-100 text-slate-700 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {selectedMode === 'sakit' ? (
                    <span className="text-rose-700 font-semibold flex items-center gap-1">
                      <span>Alasan Diagnosa Sakit & No. Surat Dokter</span>
                      <span className="text-rose-500">*wajib</span>
                    </span>
                  ) : selectedMode === 'izin' ? (
                    <span className="text-amber-800 font-semibold flex items-center gap-1">
                      <span>Alasan & Keperluan Izin Resmi</span>
                      <span className="text-rose-500">*wajib</span>
                    </span>
                  ) : (
                    <span>Catatan Pekerjaan / Laporan Shift</span>
                  )}
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    selectedMode === 'sakit'
                      ? 'Contoh: Demam berdarah dan istirahat dokter (Surat No: SKD-891/2026)...'
                      : selectedMode === 'izin'
                      ? 'Contoh: Urusan keluarga mendesak / penugasan koordinasi luar kota...'
                      : 'Contoh: Pemeliharaan turbin / inspeksi panel unit...'
                  }
                  className={`w-full px-3 py-2 text-xs border rounded-lg transition-colors ${
                    (selectedMode === 'sakit' || selectedMode === 'izin') && !notes.trim()
                      ? 'border-amber-400 bg-amber-50/40 focus:border-amber-600 focus:ring-amber-500'
                      : 'border-slate-300 focus:ring-slate-900'
                  }`}
                  required={selectedMode === 'sakit' || selectedMode === 'izin'}
                />
                {(selectedMode === 'sakit' || selectedMode === 'izin') && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Teks alasan ini akan disimpan langsung ke database Firestore dan terlampir pada log absensi.
                  </p>
                )}
              </div>
            </div>

            {/* Bagian Verifikasi Wajah Biometrik Menggunakan Kamera Perangkat */}
            <div className="border border-slate-200 bg-slate-50/80 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200 shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Verifikasi Wajah Biometrik (Kamera Perangkat)</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                        Firebase Storage
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Pengambilan snapshot wajah terenkripsi AES-256 untuk validasi kehadiran fisik anti-manipulasi
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {faceSnapshot ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Foto Wajah Siap</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCameraView(true)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-2xs"
                      >
                        Foto Ulang
                      </button>
                    </div>
                  ) : todayLog?.faceVerificationUrl ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Wajah Terverifikasi Hari Ini</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setInspectingModalLog(todayLog)}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-200 rounded-lg hover:bg-emerald-200 transition-colors shadow-2xs"
                      >
                        Lihat Snapshot
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCameraView(true)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-2xs"
                      >
                        Ambil Ulang
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCameraView(!showCameraView)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{showCameraView ? 'Tutup Kamera' : 'Buka Kamera Wajah'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Live Camera Viewfinder or Preview */}
              {showCameraView && (
                <div className="pt-2 animate-in fade-in">
                  <FaceCameraView
                    userName={profile.name}
                    locationLabel={nearestUnit.name}
                    latitude={coords.lat}
                    longitude={coords.lng}
                    initialSnapshot={faceSnapshot}
                    onSnapshotCaptured={(dataUrl) => {
                      setFaceSnapshot(dataUrl);
                      setShowCameraView(false);
                      setFeedback({
                        type: 'success',
                        text: 'Snapshot wajah biometrik berhasil diambil dan siap diunggah ke Firebase Storage saat check-in!',
                      });
                    }}
                    onCancel={() => setShowCameraView(false)}
                  />
                </div>
              )}

              {/* Thumbnail preview if snapshot captured */}
              {faceSnapshot && !showCameraView && (
                <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                  <img
                    src={faceSnapshot}
                    alt="Foto Verifikasi"
                    className="w-14 h-14 rounded-lg object-cover border border-slate-300 shadow-2xs cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      setInspectingModalLog({
                        logId: `temp_preview_${Date.now()}`,
                        userId: profile.uid,
                        recordedByUid: profile.uid,
                        userName: profile.name,
                        department: profile.department,
                        position: profile.position,
                        dateStr: new Date().toISOString().slice(0, 10),
                        monthStr: new Date().toISOString().slice(0, 7),
                        checkInTime: new Date().toLocaleTimeString('id-ID', { hour12: false }),
                        checkOutTime: '',
                        latitude: coords.lat,
                        longitude: coords.lng,
                        accuracyMeters: coords.accuracy,
                        distanceMeters: nearestDistanceMeters,
                        isWithinGeofence: isWithinAnyUnit,
                        locationLabel: nearestUnit.name,
                        status: 'hadir_tepat_waktu',
                        lateMinutes: 0,
                        workDurationMinutes: 0,
                        notes: notes || '-',
                        faceVerificationUrl: faceSnapshot,
                      });
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Snapshot Wajah Siap Diunggah</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded">
                        Terenkripsi
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Snapshot akan dikirim ke Cloud Storage Firebase & dikaitkan dengan log absensi ini.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFaceSnapshot(null)}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:underline p-1 font-medium"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>

            {/* Dua Tombol Utama: Absen Masuk & Absen Keluar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting || isBlockedByAntiFraud}
                className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                  selectedMode === 'sakit'
                    ? 'bg-rose-700 hover:bg-rose-600'
                    : selectedMode === 'izin'
                    ? 'bg-amber-700 hover:bg-amber-600'
                    : 'bg-emerald-700 hover:bg-emerald-600'
                }`}
              >
                <MapPin className="w-4 h-4" />
                {submitting
                  ? 'Memproses Absen...'
                  : isBlockedByAntiFraud
                  ? 'Absen Masuk Dikunci (Luar Radius)'
                  : selectedMode === 'sakit'
                  ? 'Simpan Laporan Sakit & Alasan Dokter'
                  : selectedMode === 'izin'
                  ? 'Kirim Pengajuan Izin Resmi'
                  : todayLog
                  ? `Absen Masuk Ulang / Pindah Unit (${nearestUnit.code})`
                  : `Absen Masuk (Check-In) — ${nearestUnit.code}`}
              </button>

              <button
                type="button"
                disabled={submitting || !todayLog || selectedMode === 'sakit' || selectedMode === 'izin'}
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

      {/* Face Verification Detail Inspection Modal */}
      <FaceVerificationDetailModal
        log={inspectingModalLog}
        onClose={() => setInspectingModalLog(null)}
      />
    </div>
  );
};
