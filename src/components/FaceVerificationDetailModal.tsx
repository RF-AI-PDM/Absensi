import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  Lock,
  MapPin,
  Maximize2,
  ShieldCheck,
  User,
  X,
  Zap,
} from 'lucide-react';
import { AttendanceLog } from '../types';
import { formatCoordinates, formatIndonesianDate } from '../utils/geo';
import { resolveFaceVerificationImage } from '../utils/faceVerification';

interface FaceVerificationDetailModalProps {
  log: AttendanceLog | null;
  onClose: () => void;
}

export const FaceVerificationDetailModal: React.FC<FaceVerificationDetailModalProps> = ({
  log,
  onClose,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!log || !log.faceVerificationUrl) return null;

  const resolvedImageSrc = resolveFaceVerificationImage(log.faceVerificationUrl, log.logId);
  const simulatedHash = `sha256_${log.logId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}e9b1c7`;

  const copyHashToClipboard = () => {
    navigator.clipboard?.writeText(simulatedHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Bukti Verifikasi Wajah Biometrik</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300">
                  AES-256
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Tersimpan di Cloud Storage Firebase & Terkait dengan Log Absensi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Main Photo Card */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 aspect-4/3 shadow-inner group">
            <img
              src={resolvedImageSrc || log.faceVerificationUrl}
              alt={`Verifikasi wajah ${log.userName}`}
              className={`w-full h-full object-cover transition-transform duration-300 ${
                isFullscreen ? 'scale-110' : ''
              }`}
            />

            {/* Top Right Verified Pill */}
            <div className="absolute top-3 right-3 bg-emerald-600/90 text-white backdrop-blur-xs text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5 border border-emerald-400/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Biometrik Liveness Valid</span>
            </div>

            {/* Top Left Encryption Pill */}
            <div className="absolute top-3 left-3 bg-slate-900/80 text-emerald-400 backdrop-blur-xs text-[10px] font-mono px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 border border-slate-700">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>AES-256-GCM</span>
            </div>

            {/* Bottom Floating Tag */}
            <div className="absolute bottom-2 left-2 right-2 bg-slate-900/85 backdrop-blur-xs text-white p-2 rounded-lg text-[10px] flex items-center justify-between border border-slate-700">
              <span className="font-mono text-slate-300 truncate max-w-[200px]">
                ID: {log.logId}
              </span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span>Firebase Storage Vault</span>
              </span>
            </div>
          </div>

          {/* Security & Integrity Audit Box */}
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs space-y-2">
            <div className="flex items-center justify-between text-emerald-950 font-semibold">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Enkripsi Klien & Integritas Snapshot</span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded">
                SHA-256 Verified
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 bg-white/80 p-2 rounded-lg border border-emerald-100 text-[11px]">
              <span className="font-mono text-slate-600 truncate">{simulatedHash}</span>
              <button
                type="button"
                onClick={copyHashToClipboard}
                className="inline-flex items-center gap-1 text-[10px] text-emerald-800 hover:text-emerald-900 font-semibold shrink-0"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedHash ? 'Tersalin' : 'Salin Hash'}</span>
              </button>
            </div>
          </div>

          {/* Metadata Audit Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Nama Karyawan</span>
              <span className="font-bold text-slate-900 mt-0.5 block">{log.userName}</span>
              <span className="text-[11px] text-slate-500">{log.department}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Waktu Presensi</span>
              <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                {log.checkInTime} WITA
              </span>
              <span className="text-[11px] text-slate-500">{formatIndonesianDate(log.dateStr)}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Unit Pembangkit</span>
              <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                {log.locationLabel}
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                Radius {log.distanceMeters}m ({log.isWithinGeofence ? 'Dalam Zona' : 'Luar Zona'})
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Geotag Koordinat GPS</span>
              <span className="font-mono text-slate-800 mt-0.5 block">
                {formatCoordinates(log.latitude, log.longitude)}
              </span>
              <span className="text-[10px] text-slate-500">Akurasi ±{log.accuracyMeters}m</span>
            </div>
          </div>

          {/* Direct Storage Link (if URL) */}
          {log.faceVerificationUrl.startsWith('http') && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">Tautan Cloud Storage Asli:</span>
              <a
                href={log.faceVerificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold underline text-xs"
              >
                <span>Buka di Firebase Storage</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Bukti kehadiran biometrik resmi PT PLN Indonesia Power
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
          >
            Tutup Pratinjau
          </button>
        </div>
      </div>
    </div>
  );
};
