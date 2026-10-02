import React, { useEffect, useState } from 'react';
import { Shield, KeyRound, CheckCircle2, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';
import {
  buildOtpAuthUri,
  buildVisualMatrix,
  computeTotpCode,
  generateTotpSecret,
  getRemainingTotpSeconds,
  verifyTotpCode,
} from '../utils/totp';

interface TwoFactorPanelProps {
  profile: UserProfile;
  onSaveTwoFactor: (enabled: boolean, secret: string) => Promise<void>;
}

export const TwoFactorPanel: React.FC<TwoFactorPanelProps> = ({
  profile,
  onSaveTwoFactor,
}) => {
  const [draftSecret, setDraftSecret] = useState<string>(
    profile.twoFactorSecret || generateTotpSecret(16)
  );
  const [inputOtp, setInputOtp] = useState('');
  const [liveCode, setLiveCode] = useState('------');
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile.twoFactorSecret) {
      setDraftSecret(profile.twoFactorSecret);
    }
  }, [profile.twoFactorSecret]);

  useEffect(() => {
    let mounted = true;
    const updateOtp = async () => {
      const code = await computeTotpCode(draftSecret);
      if (mounted) {
        setLiveCode(code);
        setSecondsLeft(getRemainingTotpSeconds(30));
      }
    };
    updateOtp();
    const timer = setInterval(updateOtp, 1000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [draftSecret]);

  const handleRegenerateSecret = () => {
    const next = generateTotpSecret(16);
    setDraftSecret(next);
    setInputOtp('');
    setStatusMessage(null);
  };

  const handleVerifyAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const isValid = await verifyTotpCode(draftSecret, inputOtp);
    if (!isValid) {
      setStatusMessage({
        type: 'error',
        text: 'Kode OTP 6 digit tidak sesuai. Gunakan aplikasi Authenticator atau kode uji langsung di samping.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSaveTwoFactor(true, draftSecret);
      setInputOtp('');
      setStatusMessage({
        type: 'success',
        text: 'Autentikasi Dua Faktor (2FA TOTP) berhasil diaktifkan pada akun Anda.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan pengaturan 2FA.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable2FA = async () => {
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await onSaveTwoFactor(false, '');
      setStatusMessage({
        type: 'success',
        text: 'Autentikasi Dua Faktor (2FA) telah dinonaktifkan.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menonaktifkan 2FA.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const otpUri = buildOtpAuthUri(draftSecret, profile.email);
  const qrMatrix = buildVisualMatrix(otpUri);

  return (
    <div className="border border-slate-200 bg-white rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Sistem Autentikasi Dua Faktor (2FA — RFC 6238 TOTP)
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Tingkatkan keamanan akses data kehadiran dan slip penggajian menggunakan kode
            Time-Based One-Time Password (TOTP) 6 digit yang diperbarui setiap 30 detik.
          </p>
        </div>
        <div className="text-xs font-medium">
          {profile.twoFactorEnabled ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              Status 2FA: Aktif & Terlindungi
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <Shield className="w-4 h-4" />
              Status 2FA: Belum Diaktifkan
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
        {/* Left: Secret Key & Visual Matrix */}
        <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start gap-5">
          <div className="p-3 border border-slate-200 rounded-lg bg-white shrink-0">
            <svg
              viewBox="0 0 21 21"
              className="w-32 h-32"
              shapeRendering="crispEdges"
              aria-label="Matriks Kunci TOTP"
            >
              {qrMatrix.map((row, rIdx) =>
                row.map((cell, cIdx) =>
                  cell ? (
                    <rect
                      key={`${rIdx}-${cIdx}`}
                      x={cIdx}
                      y={rIdx}
                      width={1}
                      height={1}
                      fill="#0f172a"
                    />
                  ) : null
                )
              )}
            </svg>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block">Kunci Rahasia Base32 (Google Authenticator / Authy):</span>
              <code className="font-mono tabular-nums text-sm font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded mt-1 inline-block select-all">
                {draftSecret}
              </code>
            </div>

            <div>
              <span className="text-slate-500 block">
                Generator Token TOTP Saat Ini (Sinkronisasi Uji Cepat):
              </span>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono tabular-nums text-base font-semibold text-emerald-700">
                  {liveCode}
                </span>
                <span className="text-slate-500 font-mono tabular-nums">
                  (berlaku {secondsLeft} dtk)
                </span>
                <button
                  type="button"
                  onClick={() => setInputOtp(liveCode)}
                  className="text-xs font-medium text-slate-900 underline hover:text-slate-700 whitespace-nowrap"
                >
                  Salin ke Kolom Verifikasi
                </button>
              </div>
            </div>

            {!profile.twoFactorEnabled && (
              <button
                type="button"
                onClick={handleRegenerateSecret}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-950"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Buat Ulang Kunci Rahasia Baru
              </button>
            )}
          </div>
        </div>

        {/* Right: Verification Form */}
        <div className="lg:col-span-7 border-t lg:border-t-0 lg:border-l border-slate-200 lg:pl-8 pt-6 lg:pt-0 flex flex-col justify-between">
          <form onSubmit={handleVerifyAndActivate} className="space-y-4">
            <div>
              <label
                htmlFor="totp-verify-input"
                className="block text-xs font-medium text-slate-700"
              >
                Masukkan Kode Verifikasi 6 Digit untuk Mengaktifkan / Memperbarui 2FA
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="totp-verify-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={inputOtp}
                    onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 482910"
                    className="w-full pl-9 pr-4 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || inputOtp.length !== 6}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {submitting
                    ? 'Memverifikasi...'
                    : profile.twoFactorEnabled
                    ? 'Verifikasi Ulang 2FA'
                    : 'Aktifkan 2FA Sekarang'}
                </button>

                {profile.twoFactorEnabled && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleDisable2FA}
                    className="px-4 py-2 text-xs font-medium text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
                  >
                    Nonaktifkan 2FA
                  </button>
                )}
              </div>
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-lg text-xs font-medium ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {statusMessage.text}
              </div>
            )}
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
            Saat 2FA aktif, setiap sesi login baru akan meminta verifikasi kode OTP 6 digit
            sebelum mengizinkan akses ke data absensi maupun laporan penggajian.
          </div>
        </div>
      </div>
    </div>
  );
};
