import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  MapPin,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallBannerProps {
  variant?: 'banner' | 'button' | 'compact';
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ variant = 'banner' }) => {
  const { isInstallable, isInstalled, isAndroid, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running in standalone mode (installed app), do not show install prompt
  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      await install();
      setInstalling(false);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Fallback instruction for browsers where beforeinstallprompt is handled via browser menu
      alert(
        'Untuk memasang aplikasi HADIROT di Android: Buka menu Chrome (titik 3 di kanan atas) lalu pilih "Tambahkan ke Layar Utama" / "Instal Aplikasi".'
      );
    }
  };

  if (variant === 'button') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg shadow-sm transition-colors whitespace-nowrap"
          title="Pasang aplikasi HADIROT ke beranda HP Android"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-200" />
          <span>Pasang App Android</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-xs space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Pasang di Layar Utama HP</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-slate-600">
                <p>Ikuti langkah mudah berikut:</p>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>
                    Tekan tombol <strong>Bagikan / Share</strong> (ikon kotak tanda panah atas) di bilah navigasi Safari / browser.
                  </li>
                  <li>
                    Gulir ke bawah dan pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    Tekan <strong>Tambah (Add)</strong> di pojok kanan atas.
                  </li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white border-b border-emerald-500/30 px-4 py-3 sm:px-6 shadow-md">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 p-0.5 shadow-md shrink-0 flex items-center justify-center">
              <img
                src="/icon.svg"
                alt="HADIROT Android"
                className="w-full h-full rounded-[10px] object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-white">
                  Aplikasi Mobile Android HADIROT
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-semibold">
                  PWA / APK Siap Pasang
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">
                Akses instan absensi GPS 4 unit pembangkit, radar geofence, dan slip gaji langsung dari beranda HP tanpa browser.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={installing}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{installing ? 'Memasang...' : 'Pasang di HP Android'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-slate-400 hover:text-white p-2 rounded-lg transition-colors"
              title="Tutup pemberitahuan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-xs space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>Pasang di Layar Utama HP</span>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-slate-600">
              <p>Ikuti langkah mudah berikut:</p>
              <ol className="list-decimal pl-4 space-y-1.5">
                <li>
                  Tekan tombol <strong>Bagikan / Share</strong> di bilah navigasi peramban browser.
                </li>
                <li>
                  Pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                </li>
                <li>
                  Tekan <strong>Tambah</strong> untuk menyelesaikan.
                </li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
