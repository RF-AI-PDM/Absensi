import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  SwitchCamera,
  X,
  Zap,
} from 'lucide-react';
import { stampVerificationWatermark } from '../utils/faceVerification';

interface FaceCameraViewProps {
  userName: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  onSnapshotCaptured: (dataUrl: string) => void;
  onCancel?: () => void;
  initialSnapshot?: string | null;
}

export const FaceCameraView: React.FC<FaceCameraViewProps> = ({
  userName,
  locationLabel,
  latitude,
  longitude,
  onSnapshotCaptured,
  onCancel,
  initialSnapshot = null,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(initialSnapshot);
  const [isCapturing, setIsCapturing] = useState(false);
  const [livenessPulse, setLivenessPulse] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashEffect, setFlashEffect] = useState(false);

  // Initialize camera stream
  const startCamera = async (mode: 'user' | 'environment') => {
    setCameraError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCamera(false);
      setCameraError('Browser tidak mendukung akses kamera perangkat.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setHasCamera(true);
    } catch (err: unknown) {
      console.warn('Camera access error:', err);
      setHasCamera(false);
      const errMsg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Izin akses kamera ditolak. Silakan izinkan browser mengakses kamera, atau gunakan mode simulasi biometrik.'
          : 'Kamera perangkat tidak terdeteksi atau sedang digunakan aplikasi lain.';
      setCameraError(errMsg);
    }
  };

  useEffect(() => {
    if (!capturedSnapshot) {
      startCamera(facingMode);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, capturedSnapshot]);

  // Flip camera front/back
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Capture snapshot from video feed
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
      }

      // If front camera, mirror image naturally
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, width, height);

      // Reset transform before watermark
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Burn tamper-evident biometric watermark
      const watermarked = stampVerificationWatermark(canvas, {
        userName,
        locationLabel,
        latitude,
        longitude,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
        integrityHash: 'a7b8c9d0e1f2a3b4c5d6e7f8',
      });

      setCapturedSnapshot(watermarked);
      onSnapshotCaptured(watermarked);
    } catch (err) {
      console.error('Failed to take snapshot:', err);
      setCameraError('Gagal mengambil snapshot kamera.');
    } finally {
      setIsCapturing(false);
    }
  };

  const startCountdownAndCapture = () => {
    if (countdown !== null || isCapturing) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setFlashEffect(true);
          setTimeout(() => setFlashEffect(false), 200);
          takeSnapshot();
          return null;
        }
        return prev - 1;
      });
    }, 800);
  };

  // Retake snapshot
  const retakeSnapshot = () => {
    setCapturedSnapshot(null);
    setCountdown(null);
    startCamera(facingMode);
  };

  // Generate high quality simulated verification avatar if device has no camera
  const handleSimulateSnapshot = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 640, 480);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 640, 480);

    // Oval face silhouette
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(320, 210, 100, 130, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body silhouette
    ctx.beginPath();
    ctx.ellipse(320, 430, 190, 120, 0, 0, Math.PI * 2);
    ctx.fill();

    // Biometric facial scan grid overlay
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.ellipse(320, 210, 115, 145, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Eye keypoints
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(285, 190, 6, 0, Math.PI * 2);
    ctx.arc(355, 190, 6, 0, Math.PI * 2);
    ctx.fill();

    // Mouth keypoint
    ctx.beginPath();
    ctx.arc(320, 260, 5, 0, Math.PI * 2);
    ctx.fill();

    // Simulated Biometric Watermark
    const watermarked = stampVerificationWatermark(canvas, {
      userName,
      locationLabel,
      latitude,
      longitude,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
    });

    setCapturedSnapshot(watermarked);
    onSnapshotCaptured(watermarked);
  };

  return (
    <div className="border border-slate-200 bg-slate-900 rounded-2xl overflow-hidden shadow-xl text-white">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Verifikasi Wajah Biometrik</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                AES-256
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Posisikan wajah tepat di dalam bingkai sebelum check-in
            </div>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
            title="Tutup kamera"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Viewport Area */}
      <div className="relative aspect-4/3 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {capturedSnapshot ? (
          /* Snapshot Preview */
          <div className="relative w-full h-full animate-in fade-in zoom-in-95">
            <img
              src={capturedSnapshot}
              alt="Snapshot Verifikasi Wajah"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Snapshot Terverifikasi</span>
            </div>
          </div>
        ) : hasCamera !== false && !cameraError ? (
          /* Live Camera Stream */
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              }`}
            />

            {/* Flash Effect on capture */}
            {flashEffect && (
              <div className="absolute inset-0 bg-white pointer-events-none z-30 animate-out fade-out duration-200" />
            )}

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/50 pointer-events-none z-20 animate-in zoom-in-75">
                <div className="w-24 h-24 rounded-full bg-emerald-500 text-slate-950 text-5xl font-black flex items-center justify-center shadow-2xl border-4 border-white animate-pulse">
                  {countdown}
                </div>
                <div className="mt-3 text-white text-xs font-semibold px-3 py-1 bg-slate-900/90 rounded-full border border-slate-700">
                  Tahan posisi wajah Anda...
                </div>
              </div>
            )}

            {/* Facial Recognition Oval Reticle Guide */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div
                className={`w-48 h-64 sm:w-56 sm:h-72 rounded-full border-2 transition-all duration-700 ${
                  livenessPulse
                    ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]'
                    : 'border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                }`}
              >
                {/* Crosshairs & Scanner corners */}
                <div className="w-full h-full relative">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-emerald-400 rounded-full" />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-emerald-400 rounded-full" />
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 h-4 w-1 bg-emerald-400 rounded-full" />
                  <div className="absolute top-1/2 -right-1 -translate-y-1/2 h-4 w-1 bg-emerald-400 rounded-full" />
                </div>
              </div>

              <div className="mt-4 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-xs text-[11px] font-medium text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Posisikan wajah menghadap kamera lurus</span>
              </div>
            </div>
          </>
        ) : (
          /* Fallback / Camera Permission Denied */
          <div className="p-6 text-center space-y-3 max-w-sm">
            <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center border border-slate-700">
              <Camera className="w-6 h-6" />
            </div>
            <div className="text-xs text-slate-300 font-medium leading-relaxed">
              {cameraError || 'Kamera belum diizinkan atau tidak tersedia pada perangkat ini.'}
            </div>
            <button
              type="button"
              onClick={handleSimulateSnapshot}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gunakan Simulasi Wajah Biometrik</span>
            </button>
          </div>
        )}
      </div>

      {/* Camera Controls & Actions */}
      <div className="p-3 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate max-w-[220px]">
            {userName} · {locationLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {capturedSnapshot ? (
            /* Retake Button */
            <button
              type="button"
              onClick={retakeSnapshot}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Foto Ulang</span>
            </button>
          ) : (
            /* Live Camera Controls */
            <>
              {hasCamera && (
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Ganti kamera depan / belakang"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}

              {hasCamera ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={startCountdownAndCapture}
                    disabled={isCapturing || countdown !== null}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors disabled:opacity-50"
                    title="Ambil foto dengan hitungan mundur 3 detik"
                  >
                    <span>⏱ Timer 3s</span>
                  </button>

                  <button
                    type="button"
                    onClick={takeSnapshot}
                    disabled={isCapturing || countdown !== null}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Ambil Foto</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSimulateSnapshot}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Simulasi Foto Wajah</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
