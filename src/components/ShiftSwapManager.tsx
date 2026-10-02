import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  MessageSquare,
  Plus,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { ShiftSwapRequest, ShiftSwapStatus, UserProfile } from '../types';
import { IPS_POWER_UNITS } from '../utils/geo';

interface ShiftSwapManagerProps {
  currentUser: UserProfile;
  isAdmin: boolean;
  allUsers: UserProfile[];
  shiftSwaps: ShiftSwapRequest[];
  onRequestSwap: (
    data: Omit<ShiftSwapRequest, 'swapId' | 'status' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onReviewSwap: (
    swapId: string,
    status: 'approved' | 'rejected',
    adminNotes: string
  ) => Promise<void>;
  onCancelSwap: (swapId: string) => Promise<void>;
}

// Preset Shift Times for Indonesia Power Service
export const SHIFT_OPTIONS = [
  { id: 'pagi', label: 'Shift Pagi (07:00 – 15:00 WITA)' },
  { id: 'siang', label: 'Shift Siang (15:00 – 23:00 WITA)' },
  { id: 'malam', label: 'Shift Malam (23:00 – 07:00 WITA)' },
  { id: 'normal', label: 'Shift Kantor Normal (08:30 – 17:30 WITA)' },
];

export const ShiftSwapManager: React.FC<ShiftSwapManagerProps> = ({
  currentUser,
  isAdmin,
  allUsers,
  shiftSwaps,
  onRequestSwap,
  onReviewSwap,
  onCancelSwap,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'mine' | 'incoming' | 'approved' | 'rejected'>('all');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Review Dialog State for Admin
  const [reviewingSwap, setReviewingSwap] = useState<ShiftSwapRequest | null>(null);
  const [adminDecision, setAdminDecision] = useState<'approved' | 'rejected'>('approved');
  const [adminMemo, setAdminMemo] = useState('');

  // Form State for Requesting Shift Swap
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [formMyDate, setFormMyDate] = useState(todayStr);
  const [formMyShiftTime, setFormMyShiftTime] = useState(SHIFT_OPTIONS[0].label);
  const [formMyUnit, setFormMyUnit] = useState(IPS_POWER_UNITS[0].name);

  const [selectedColleagueUid, setSelectedColleagueUid] = useState<string>('');
  const [formTargetDate, setFormTargetDate] = useState(tomorrowStr);
  const [formTargetShiftTime, setFormTargetShiftTime] = useState(SHIFT_OPTIONS[1].label);
  const [formTargetUnit, setFormTargetUnit] = useState(IPS_POWER_UNITS[1].name);
  const [formReason, setFormReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Candidate colleagues list (excluding current user)
  const candidateColleagues = useMemo(() => {
    const list = allUsers.filter((u) => u.uid !== currentUser.uid);
    if (list.length > 0) return list;

    // Fallback standard IPS engineering team roster if users collection is sparse
    return [
      {
        uid: 'staf_adia_pratama',
        createdByUid: 'system',
        name: 'Adia Pratama',
        email: 'adia.pratama@ips-lombok.id',
        department: 'Pemeliharaan Turbin & Boiler',
        position: 'Senior Teknisi Pembangkit',
        employeeCode: 'IPS-102',
        baseSalary: 11500000,
        dailyAllowance: 140000,
        latePenaltyRate: 50000,
        twoFactorEnabled: false,
        twoFactorSecret: '',
        shiftStart: '07:00',
        shiftEnd: '15:00',
      },
      {
        uid: 'staf_nadia_kusuma',
        createdByUid: 'system',
        name: 'Nadia Kusuma',
        email: 'nadia.kusuma@ips-lombok.id',
        department: 'Operasi & Kontrol Gardu',
        position: 'Engineer Kontrol Pembangkit',
        employeeCode: 'IPS-105',
        baseSalary: 10800000,
        dailyAllowance: 135000,
        latePenaltyRate: 50000,
        twoFactorEnabled: false,
        twoFactorSecret: '',
        shiftStart: '07:00',
        shiftEnd: '15:00',
      },
      {
        uid: 'staf_reza_mahendra',
        createdByUid: 'system',
        name: 'Reza Mahendra',
        email: 'reza.mahendra@ips-lombok.id',
        department: 'Pemeliharaan Mesin Diesel',
        position: 'Teknisi Mekanik Lapangan',
        employeeCode: 'IPS-109',
        baseSalary: 9800000,
        dailyAllowance: 125000,
        latePenaltyRate: 45000,
        twoFactorEnabled: false,
        twoFactorSecret: '',
        shiftStart: '15:00',
        shiftEnd: '23:00',
      },
      {
        uid: 'staf_bambang_wijaya',
        createdByUid: 'system',
        name: 'Bambang Wijaya',
        email: 'bambang.wijaya@ips-lombok.id',
        department: 'Operasional Pembangkit Listrik',
        position: 'Operator Turbin Senior',
        employeeCode: 'IPS-111',
        baseSalary: 11200000,
        dailyAllowance: 140000,
        latePenaltyRate: 50000,
        twoFactorEnabled: false,
        twoFactorSecret: '',
        shiftStart: '23:00',
        shiftEnd: '07:00',
      },
    ] as UserProfile[];
  }, [allUsers, currentUser.uid]);

  // Set default colleague if not yet selected
  React.useEffect(() => {
    if (!selectedColleagueUid && candidateColleagues.length > 0) {
      setSelectedColleagueUid(candidateColleagues[0].uid);
    }
  }, [candidateColleagues, selectedColleagueUid]);

  const selectedColleague = useMemo(() => {
    return candidateColleagues.find((c) => c.uid === selectedColleagueUid) || candidateColleagues[0];
  }, [candidateColleagues, selectedColleagueUid]);

  // Metrics counts
  const pendingCount = useMemo(
    () => shiftSwaps.filter((s) => s.status === 'pending').length,
    [shiftSwaps]
  );
  const approvedCount = useMemo(
    () => shiftSwaps.filter((s) => s.status === 'approved').length,
    [shiftSwaps]
  );
  const rejectedOrCancelledCount = useMemo(
    () => shiftSwaps.filter((s) => s.status === 'rejected' || s.status === 'cancelled').length,
    [shiftSwaps]
  );
  const myRequestsCount = useMemo(
    () => shiftSwaps.filter((s) => s.requesterUid === currentUser.uid).length,
    [shiftSwaps, currentUser.uid]
  );
  const incomingRequestsCount = useMemo(
    () => shiftSwaps.filter((s) => s.colleagueUid === currentUser.uid).length,
    [shiftSwaps, currentUser.uid]
  );

  // Filtered shift swap list
  const filteredSwaps = useMemo(() => {
    return shiftSwaps.filter((swap) => {
      if (filterTab === 'pending') return swap.status === 'pending';
      if (filterTab === 'approved') return swap.status === 'approved';
      if (filterTab === 'rejected') return swap.status === 'rejected' || swap.status === 'cancelled';
      if (filterTab === 'mine') return swap.requesterUid === currentUser.uid;
      if (filterTab === 'incoming') return swap.colleagueUid === currentUser.uid;
      return true; // 'all'
    });
  }, [shiftSwaps, filterTab, currentUser.uid]);

  const handleOpenCreateModal = () => {
    setFormReason('');
    setFormError(null);
    setFormMyDate(todayStr);
    setFormTargetDate(tomorrowStr);
    setShowRequestModal(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColleague) {
      setFormError('Silakan pilih rekan staf pengganti.');
      return;
    }
    if (!formReason.trim()) {
      setFormError('Alasan / justifikasi pertukaran shift wajib diisi.');
      return;
    }
    if (formReason.trim().length < 8) {
      setFormError('Alasan permohonan terlalu singkat (minimal 8 karakter).');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await onRequestSwap({
        requesterUid: currentUser.uid,
        requesterName: currentUser.name,
        requesterDepartment: currentUser.department,
        requesterPosition: currentUser.position,
        requesterShiftDate: formMyDate,
        requesterShiftTime: formMyShiftTime,
        requesterUnitName: formMyUnit,
        colleagueUid: selectedColleague.uid,
        colleagueName: selectedColleague.name,
        colleagueDepartment: selectedColleague.department,
        colleaguePosition: selectedColleague.position,
        targetShiftDate: formTargetDate,
        targetShiftTime: formTargetShiftTime,
        targetUnitName: formTargetUnit,
        reason: formReason.trim(),
      });
      setShowRequestModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mengirim permohonan tukar shift.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAdminReview = (swap: ShiftSwapRequest, decision: 'approved' | 'rejected') => {
    setReviewingSwap(swap);
    setAdminDecision(decision);
    setAdminMemo(
      decision === 'approved'
        ? `Disetujui: Rotasi pertukaran shift telah diverifikasi dan dicatat pada jadwal operasional.`
        : `Ditolak: Kebutuhan personil teknisi pada shift tersebut tidak dapat ditinggalkan.`
    );
  };

  const handleExecuteAdminReview = async () => {
    if (!reviewingSwap) return;
    setActionInProgressId(reviewingSwap.swapId);
    try {
      await onReviewSwap(reviewingSwap.swapId, adminDecision, adminMemo.trim());
      setReviewingSwap(null);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleCancelMySwap = async (swapId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan permohonan tukar shift ini?')) {
      return;
    }
    setActionInProgressId(swapId);
    try {
      await onCancelSwap(swapId);
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div className="border border-slate-200 bg-white rounded-xl p-5 sm:p-6 space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
            <span>Manajemen Rotasi & Shift Kerja Karyawan</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-display mt-0.5">
            Pertukaran Shift & Jadwal Tim (Shift Swap)
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Fasilitas bagi karyawan untuk mengajukan pertukaran jadwal tugas antar rekan unit pembangkit,
            yang memerlukan peninjauan dan persetujuan resmi oleh Administrator HR & Operasional demi
            menjaga keandalan rotasi operasional.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ajukan Tukar Shift</span>
          </button>
        </div>
      </div>

      {/* KPI / Status Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <span className="text-slate-500 block">Total Pengajuan</span>
            <span className="font-bold text-base text-slate-900 mt-0.5 block font-mono tabular-nums">
              {shiftSwaps.length}
            </span>
          </div>
          <Users className="w-5 h-5 text-slate-400" />
        </div>

        <div
          className={`p-3.5 rounded-lg border flex items-center justify-between ${
            pendingCount > 0
              ? 'bg-amber-50/80 border-amber-300 text-amber-950'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div>
            <span className="text-amber-800 font-medium block">Menunggu Admin</span>
            <span className="font-bold text-base mt-0.5 block font-mono tabular-nums">
              {pendingCount} Permohonan
            </span>
          </div>
          <Clock className={`w-5 h-5 ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
        </div>

        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-950 flex items-center justify-between">
          <div>
            <span className="text-emerald-800 font-medium block">Disetujui Admin</span>
            <span className="font-bold text-base mt-0.5 block font-mono tabular-nums">
              {approvedCount}
            </span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-between">
          <div>
            <span className="text-slate-500 block">Ditolak / Batal</span>
            <span className="font-bold text-base mt-0.5 block font-mono tabular-nums text-slate-600">
              {rejectedOrCancelledCount}
            </span>
          </div>
          <XCircle className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      {/* Admin Action Notice Banner */}
      {isAdmin && pendingCount > 0 && (
        <div className="border border-amber-300 bg-amber-50/90 rounded-lg p-3.5 flex items-start gap-3 text-xs text-amber-950">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">
              Persetujuan Administrator Diperlukan ({pendingCount} Permohonan Tertunda)
            </span>
            <p className="text-amber-900 leading-relaxed">
              Sebagai Administrator HR & Operasional, Anda berwenang meninjau, menyetujui, atau menolak
              permohonan pertukaran shift di bawah ini. Pastikan tidak ada kekosongan staf di unit
              pembangkit yang bersangkutan sebelum menyetujui.
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({shiftSwaps.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              filterTab === 'pending'
                ? 'bg-white text-amber-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Menunggu Persetujuan</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('approved')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterTab === 'approved'
                ? 'bg-white text-emerald-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Disetujui ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('rejected')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterTab === 'rejected'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ditolak / Batal ({rejectedOrCancelledCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('mine')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterTab === 'mine'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pengajuan Saya ({myRequestsCount})
          </button>
          {incomingRequestsCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterTab('incoming')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterTab === 'incoming'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ditujukan ke Saya ({incomingRequestsCount})
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span>Menampilkan {filteredSwaps.length} permohonan</span>
        </div>
      </div>

      {/* List of Shift Swap Requests */}
      {filteredSwaps.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Tidak Ada Permohonan Pertukaran Shift
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {filterTab === 'pending'
                ? 'Semua permohonan pertukaran shift telah diproses oleh Administrator.'
                : 'Belum ada permohonan tukar shift pada kategori ini. Anda dapat mengajukan tukar jadwal tugas dengan rekan unit kapan saja.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Buat Permohonan Sekarang
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSwaps.map((swap) => {
            const isRequester = swap.requesterUid === currentUser.uid;
            const isColleague = swap.colleagueUid === currentUser.uid;
            const isPending = swap.status === 'pending';
            const isApproved = swap.status === 'approved';
            const isRejected = swap.status === 'rejected';
            const isCancelled = swap.status === 'cancelled';

            return (
              <div
                key={swap.swapId}
                className={`border rounded-xl p-4 sm:p-5 space-y-4 transition-all ${
                  isPending
                    ? 'border-amber-200 bg-white hover:border-amber-300 shadow-2xs'
                    : isApproved
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                {/* Header: ID, Badge, and Action buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      #{swap.swapId.slice(-8).toUpperCase()}
                    </span>

                    {/* Status Pill */}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                        <Clock className="w-3.5 h-3.5" />
                        Menunggu Persetujuan Admin
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        Disetujui Admin (Sah)
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-900 border border-red-300">
                        <XCircle className="w-3.5 h-3.5 text-red-700" />
                        Ditolak Admin
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        Dibatalkan Pengaju
                      </span>
                    )}

                    {(isRequester || isColleague) && (
                      <span className="text-[11px] font-medium text-slate-500">
                        {isRequester ? '· Pengajuan Anda' : '· Permintaan Ditujukan ke Anda'}
                      </span>
                    )}
                  </div>

                  {/* Requester cancel option or Admin direct review trigger */}
                  <div className="flex items-center gap-2">
                    {isPending && isRequester && !isAdmin && (
                      <button
                        type="button"
                        disabled={actionInProgressId === swap.swapId}
                        onClick={() => handleCancelMySwap(swap.swapId)}
                        className="px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 rounded-md border border-red-200 transition-colors"
                      >
                        Batalkan Permohonan
                      </button>
                    )}
                  </div>
                </div>

                {/* Two-Way Shift Comparison Visual */}
                <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                  {/* Left: Requester's Original Shift */}
                  <div className="md:col-span-5 border border-slate-200 rounded-lg p-3.5 bg-white space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Staf Pengaju Pertukaran</span>
                      <span className="font-mono text-[11px] text-slate-400">Shift Asal</span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0 mt-0.5">
                        {swap.requesterName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-900 truncate">
                          {swap.requesterName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {swap.requesterPosition} · {swap.requesterDepartment}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold">{swap.requesterShiftDate}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{swap.requesterShiftTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{swap.requesterUnitName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Reciprocal Swap Icon */}
                  <div className="md:col-span-1 flex justify-center py-1 md:py-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 shadow-2xs">
                      <ArrowLeftRight className="w-4 h-4 text-emerald-700" />
                    </div>
                  </div>

                  {/* Right: Colleague's Target Shift */}
                  <div className="md:col-span-5 border border-slate-200 rounded-lg p-3.5 bg-white space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Rekan Staf Ditukar</span>
                      <span className="font-mono text-[11px] text-slate-400">Shift Tujuan</span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center font-bold text-xs text-emerald-800 shrink-0 mt-0.5">
                        {swap.colleagueName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-900 truncate">
                          {swap.colleagueName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {swap.colleaguePosition} · {swap.colleagueDepartment}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold">{swap.targetShiftDate}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{swap.targetShiftTime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{swap.targetUnitName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason & Administrative Notes */}
                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700 mb-1">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>Alasan / Justifikasi Pengajuan:</span>
                    </div>
                    <p className="text-slate-800 italic leading-relaxed pl-5">
                      &ldquo;{swap.reason}&rdquo;
                    </p>
                  </div>

                  {/* If Reviewed by Admin: Display Admin Stamp & Notes */}
                  {swap.adminNotes && (
                    <div
                      className={`p-3 rounded-lg border ${
                        isApproved
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                          : 'bg-red-50/80 border-red-200 text-red-950'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                          {isApproved ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-700" />
                          )}
                          <span>
                            {isApproved ? 'Catatan Persetujuan Administrator:' : 'Catatan Penolakan Administrator:'}
                          </span>
                        </span>
                        {swap.reviewedByName && (
                          <span className="text-[11px] font-mono">
                            Oleh {swap.reviewedByName}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 pl-5.5 leading-relaxed text-xs">
                        {swap.adminNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Admin Workflow Action Panel (Only visible to Admin on Pending requests) */}
                {isAdmin && isPending && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-amber-950 font-medium">
                      <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Alur Persetujuan Admin: Silakan verifikasi permohonan rotasi ini.</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={actionInProgressId === swap.swapId}
                        onClick={() => handleOpenAdminReview(swap, 'approved')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-md transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Setujui (Approve)</span>
                      </button>

                      <button
                        type="button"
                        disabled={actionInProgressId === swap.swapId}
                        onClick={() => handleOpenAdminReview(swap, 'rejected')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-300 font-semibold rounded-md transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Tolak (Reject)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Ajukan Pertukaran Shift */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Formulir Permohonan Pertukaran Shift (Shift Swap)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitRequest} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Section 1: Shift Saya yang Ingin Ditukar */}
              <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/70 space-y-3">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-600" />
                  <span>1. Jadwal Shift Saya Saat Ini (Pengaju: {currentUser.name})</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Tanggal Shift Saya
                    </label>
                    <input
                      type="date"
                      required
                      value={formMyDate}
                      onChange={(e) => setFormMyDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Waktu Shift Saya
                    </label>
                    <select
                      value={formMyShiftTime}
                      onChange={(e) => setFormMyShiftTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {SHIFT_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.label}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Unit Kerja Saya
                    </label>
                    <select
                      value={formMyUnit}
                      onChange={(e) => setFormMyUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {IPS_POWER_UNITS.map((unit) => (
                        <option key={unit.unitId} value={unit.name}>
                          {unit.name} ({unit.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Rekan Staf & Shift Pengganti */}
              <div className="border border-slate-200 rounded-lg p-3.5 bg-emerald-50/30 space-y-3">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-700" />
                  <span>2. Rekan Kerja Pengganti & Shift yang Ditukar</span>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Pilih Rekan Staf Indonesia Power Service
                  </label>
                  <select
                    value={selectedColleagueUid}
                    onChange={(e) => setSelectedColleagueUid(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    {candidateColleagues.map((colleague) => (
                      <option key={colleague.uid} value={colleague.uid}>
                        {colleague.name} — {colleague.position} ({colleague.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Tanggal Shift Rekan
                    </label>
                    <input
                      type="date"
                      required
                      value={formTargetDate}
                      onChange={(e) => setFormTargetDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Waktu Shift Rekan
                    </label>
                    <select
                      value={formTargetShiftTime}
                      onChange={(e) => setFormTargetShiftTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {SHIFT_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.label}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Unit Kerja Rekan
                    </label>
                    <select
                      value={formTargetUnit}
                      onChange={(e) => setFormTargetUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      {IPS_POWER_UNITS.map((unit) => (
                        <option key={unit.unitId} value={unit.name}>
                          {unit.name} ({unit.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Alasan / Justifikasi */}
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Alasan & Justifikasi Pertukaran Shift (Wajib)
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={400}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Contoh: Keperluan keluarga mendesak / rotasi penugasan inspeksi boiler turbin / penyesuaian jadwal luar kota..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <span className="text-[11px] text-slate-400 block text-right">
                  {formReason.length}/400 karakter
                </span>
              </div>

              {/* Notice */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px] leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Aturan Operasional:</strong> Permohonan yang diajukan akan berstatus{' '}
                  <span className="text-amber-800 font-semibold">Menunggu Persetujuan Admin</span>{' '}
                  sampai diverifikasi oleh Admin HR & Operasional demi memastikan kontinuitas unit.
                </span>
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5"
                >
                  {submitting ? 'Mengirim...' : 'Kirim Permohonan ke Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Dialog: Admin Review Decision */}
      {reviewingSwap && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`px-5 py-4 border-b flex items-center justify-between ${
                adminDecision === 'approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {adminDecision === 'approved' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-700" />
                )}
                <h3 className="font-bold text-slate-900 text-sm">
                  {adminDecision === 'approved'
                    ? 'Konfirmasi Persetujuan Tukar Shift (Approval)'
                    : 'Konfirmasi Penolakan Tukar Shift (Rejection)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewingSwap(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-1">
                <div className="font-semibold text-slate-900">
                  Permohonan: {reviewingSwap.requesterName} ↔ {reviewingSwap.colleagueName}
                </div>
                <div className="text-slate-600">
                  Shift: {reviewingSwap.requesterShiftDate} ({reviewingSwap.requesterShiftTime}) di{' '}
                  {reviewingSwap.requesterUnitName}
                </div>
                <div className="text-slate-500 italic mt-1">
                  Alasan: &ldquo;{reviewingSwap.reason}&rdquo;
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Catatan / Memo Administrator ({adminDecision === 'approved' ? 'Disetujui' : 'Alasan Penolakan'}):
                </label>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={adminMemo}
                  onChange={(e) => setAdminMemo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Tuliskan catatan verifikasi untuk staf..."
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReviewingSwap(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium"
                >
                  Batal
                </button>

                <button
                  type="button"
                  disabled={actionInProgressId === reviewingSwap.swapId}
                  onClick={handleExecuteAdminReview}
                  className={`px-5 py-2 font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 ${
                    adminDecision === 'approved'
                      ? 'bg-emerald-700 hover:bg-emerald-600'
                      : 'bg-red-700 hover:bg-red-600'
                  }`}
                >
                  {actionInProgressId === reviewingSwap.swapId
                    ? 'Menyimpan...'
                    : adminDecision === 'approved'
                    ? 'Simpan Persetujuan (Approve)'
                    : 'Simpan Penolakan (Reject)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
