/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Bell,
  FileSpreadsheet,
  FileText,
  KeyRound,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  AttendanceLog,
  AttendanceReminder,
  AttendanceStatus,
  BOOTSTRAPPED_ADMIN_EMAIL,
  MonthlyRecapItem,
  OfficeConfig,
  PayrollRecord,
  sanitizeId,
  sanitizeString,
  UserProfile,
  VALIDATION_CONSTRAINTS,
} from './types';
import {
  calculateDistanceMeters,
  calculateLateMinutes,
  calculateWorkDurationMinutes,
  DEFAULT_OFFICE_CONFIG,
  evaluateMultiUnitGeofence,
  formatCoordinates,
  formatDurationHoursMinutes,
  getCurrentMonthStr,
  getCurrentTimeHHMMSS,
  getTodayDateStr,
  IPS_POWER_UNITS,
} from './utils/geo';
import { computeTotpCode, getRemainingTotpSeconds, verifyTotpCode } from './utils/totp';
import { exportAttendanceToExcel, exportAttendanceToPDF } from './utils/exporter';
import { GeospatialRadarMap } from './components/GeospatialRadarMap';
import { AttendanceTerminalView } from './components/AttendanceTerminalView';
import { RecapAndPayrollView } from './components/RecapAndPayrollView';
import { TwoFactorPanel } from './components/TwoFactorPanel';

type NavTab = 'monitoring' | 'terminal' | 'recap' | 'payroll' | 'security';

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  hadir_tepat_waktu: 'Tepat Waktu',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  lembur: 'Lembur',
  selesai_shift: 'Selesai Shift',
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // 2FA Session Verification State
  const [session2faVerified, setSession2faVerified] = useState(false);
  const [challengeOtpInput, setChallengeOtpInput] = useState('');
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [helperLiveTotp, setHelperLiveTotp] = useState('------');
  const [helperSeconds, setHelperSeconds] = useState(30);

  // Navigation & Filters
  const [activeTab, setActiveTab] = useState<NavTab>('monitoring');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Firestore Collections State
  const [officeConfig, setOfficeConfig] = useState<OfficeConfig>(DEFAULT_OFFICE_CONFIG);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [reminders, setReminders] = useState<AttendanceReminder[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);

  // Admin Modals & Feedback
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    email: '',
    department: 'Operasional',
    position: 'Staf Lapangan',
    employeeCode: `EMP-${Math.floor(100 + Math.random() * 899)}`,
    baseSalary: 8500000,
    dailyAllowance: 120000,
    latePenaltyRate: 50000,
  });
  const [toastBanner, setToastBanner] = useState<string | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [quickUnitId, setQuickUnitId] = useState<string>(IPS_POWER_UNITS[0].unitId);
  const [quickActionBusy, setQuickActionBusy] = useState(false);

  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => setToastBanner(null), 5000);
  };

  // 1. Auth Listener & Profile Bootstrap
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      if (!u) {
        setUserProfile(null);
        setIsAdmin(false);
        setSession2faVerified(false);
        setAuthReady(true);
        return;
      }

      const adminFlag =
        u.emailVerified && u.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
      setIsAdmin(Boolean(adminFlag));

      const userPath = `users/${u.uid}`;
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setUserProfile(data);
          if (!data.twoFactorEnabled) {
            setSession2faVerified(true);
          }
        } else {
          const newProfile: UserProfile = {
            uid: sanitizeId(u.uid),
            createdByUid: sanitizeId(u.uid),
            name: sanitizeString(
              u.displayName || u.email?.split('@')[0] || 'Karyawan',
              VALIDATION_CONSTRAINTS.NAME_MAX_LEN
            ),
            email: sanitizeString(
              u.email || 'user@hadirot.id',
              VALIDATION_CONSTRAINTS.EMAIL_MAX_LEN
            ),
            department: adminFlag ? 'Manajemen Eksekutif' : 'Operasional & Teknologi',
            position: adminFlag ? 'Administrator HR & Operasional' : 'Spesialis Operasional',
            employeeCode: adminFlag ? 'ADM-001' : `EMP-${u.uid.slice(0, 5).toUpperCase()}`,
            baseSalary: adminFlag ? 16500000 : 9500000,
            dailyAllowance: 150000,
            latePenaltyRate: 50000,
            twoFactorEnabled: false,
            twoFactorSecret: '',
            shiftStart: '08:30',
            shiftEnd: '17:30',
          };
          await setDoc(doc(db, 'users', u.uid), {
            ...newProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setUserProfile(newProfile);
          setSession2faVerified(true);
        }

        // Also load or initialize Office HQ config
        const cfgSnap = await getDoc(doc(db, 'office_configs', 'main_hq'));
        if (cfgSnap.exists()) {
          setOfficeConfig(cfgSnap.data() as OfficeConfig);
        } else if (adminFlag) {
          await setDoc(doc(db, 'office_configs', 'main_hq'), {
            ...DEFAULT_OFFICE_CONFIG,
            updatedBy: sanitizeId(u.uid),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, userPath);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // 2. Live TOTP Helper for 2FA Challenge Screen
  useEffect(() => {
    if (!userProfile?.twoFactorEnabled || session2faVerified || !userProfile.twoFactorSecret) {
      return;
    }
    let active = true;
    const tick = async () => {
      const code = await computeTotpCode(userProfile.twoFactorSecret);
      if (active) {
        setHelperLiveTotp(code);
        setHelperSeconds(getRemainingTotpSeconds(30));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [userProfile, session2faVerified]);

  // 3. Real-Time Firestore Listeners (Only after Auth + 2FA Verified)
  useEffect(() => {
    if (!authReady || !currentUser || !session2faVerified) return;

    const usersQuery = isAdmin
      ? collection(db, 'users')
      : query(collection(db, 'users'), where('uid', '==', currentUser.uid));

    const logsQuery = isAdmin
      ? collection(db, 'attendance_logs')
      : query(collection(db, 'attendance_logs'), where('userId', '==', currentUser.uid));

    const remindersQuery = isAdmin
      ? collection(db, 'attendance_reminders')
      : query(
          collection(db, 'attendance_reminders'),
          where('targetUserId', '==', currentUser.uid)
        );

    const payrollQuery = isAdmin
      ? collection(db, 'payroll_records')
      : query(collection(db, 'payroll_records'), where('userId', '==', currentUser.uid));

    const unsubUsers = onSnapshot(
      usersQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserProfile);
        setAllUsers(list);
        const me = list.find((item) => item.uid === currentUser.uid);
        if (me) setUserProfile(me);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as AttendanceLog);
        list.sort((a, b) => (b.checkInTime || '').localeCompare(a.checkInTime || ''));
        setAttendanceLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'attendance_logs')
    );

    const unsubReminders = onSnapshot(
      remindersQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as AttendanceReminder);
        setReminders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'attendance_reminders')
    );

    const unsubPayroll = onSnapshot(
      payrollQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as PayrollRecord);
        setPayrollRecords(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payroll_records')
    );

    const unsubOffice = onSnapshot(
      doc(db, 'office_configs', 'main_hq'),
      (snap) => {
        if (snap.exists()) {
          setOfficeConfig(snap.data() as OfficeConfig);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'office_configs/main_hq')
    );

    return () => {
      unsubUsers();
      unsubLogs();
      unsubReminders();
      unsubPayroll();
      unsubOffice();
    };
  }, [authReady, currentUser, session2faVerified, isAdmin]);

  // Derived Data for Selected Date & Month
  const todayStr = getTodayDateStr();

  const logsForSelectedDate = useMemo(
    () => attendanceLogs.filter((l) => l.dateStr === selectedDate),
    [attendanceLogs, selectedDate]
  );

  const filteredDateLogs = useMemo(() => {
    return logsForSelectedDate.filter((l) => {
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      const matchesSearch =
        !searchQuery ||
        l.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.locationLabel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [logsForSelectedDate, statusFilter, searchQuery]);

  const myTodayLog = useMemo(() => {
    if (!currentUser) return null;
    return (
      attendanceLogs.find((l) => l.userId === currentUser.uid && l.dateStr === todayStr) || null
    );
  }, [attendanceLogs, currentUser, todayStr]);

  const missingStaffToday = useMemo(() => {
    const checkedInIds = new Set(
      attendanceLogs.filter((l) => l.dateStr === selectedDate).map((l) => l.userId)
    );
    return allUsers.filter((u) => !checkedInIds.has(u.uid));
  }, [allUsers, attendanceLogs, selectedDate]);

  const myUnreadReminders = useMemo(() => {
    if (!currentUser) return [];
    return reminders.filter(
      (r) =>
        r.status === 'unread' &&
        (r.targetUserId === currentUser.uid || (isAdmin && r.dateStr === selectedDate))
    );
  }, [reminders, currentUser, isAdmin, selectedDate]);

  // Automated Monthly Recapitulation Computation
  const monthlyRecapItems: MonthlyRecapItem[] = useMemo(() => {
    return allUsers.map((u) => {
      const userMonthLogs = attendanceLogs.filter(
        (l) => l.userId === u.uid && l.monthStr === selectedMonth
      );
      const presentLogs = userMonthLogs.filter(
        (l) =>
          l.status === 'hadir_tepat_waktu' ||
          l.status === 'terlambat' ||
          l.status === 'lembur' ||
          l.status === 'selesai_shift'
      );
      const presentDays = presentLogs.length;
      const lateDays = userMonthLogs.filter((l) => l.lateMinutes > 0 || l.status === 'terlambat')
        .length;
      const onTimeDays = Math.max(0, presentDays - lateDays);
      const leaveDays = userMonthLogs.filter((l) => l.status === 'izin' || l.status === 'sakit')
        .length;
      const totalLateMinutes = userMonthLogs.reduce((acc, l) => acc + (l.lateMinutes || 0), 0);
      const totalWorkMinutes = userMonthLogs.reduce(
        (acc, l) => acc + (l.workDurationMinutes || 480),
        0
      );
      const overtimeLogs = userMonthLogs.filter((l) => l.status === 'lembur').length;
      const overtimeHours = overtimeLogs * 2;
      const withinGeofenceCount = presentLogs.filter((l) => l.isWithinGeofence).length;

      const rawScore =
        presentDays === 0
          ? 85
          : Math.round(
              ((onTimeDays / Math.max(1, presentDays)) * 70 +
                (withinGeofenceCount / Math.max(1, presentDays)) * 30)
            );
      const disciplineScore = Math.max(0, Math.min(100, rawScore));

      const estimatedAllowance = presentDays * (u.dailyAllowance || 120000);
      const estimatedOvertimePay = overtimeHours * 75000;
      const estimatedLateDeduction = lateDays * (u.latePenaltyRate || 50000);
      const gross = (u.baseSalary || 0) + estimatedAllowance + estimatedOvertimePay;
      const estimatedBpjsTax = Math.round(gross * 0.03);
      const estimatedNetSalary = Math.max(
        0,
        gross - estimatedLateDeduction - estimatedBpjsTax
      );

      return {
        user: u,
        monthStr: selectedMonth,
        presentDays,
        onTimeDays,
        lateDays,
        leaveDays,
        totalLateMinutes,
        totalWorkMinutes,
        overtimeHours,
        withinGeofenceCount,
        disciplineScore,
        estimatedAllowance,
        estimatedOvertimePay,
        estimatedLateDeduction,
        estimatedBpjsTax,
        estimatedNetSalary,
      };
    });
  }, [allUsers, attendanceLogs, selectedMonth]);

  // Handlers
  const handleCheckIn = async (params: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    locationLabel: string;
    statusOverride?: AttendanceStatus;
    notes: string;
  }) => {
    if (!currentUser || !userProfile) return;
    const nowTime = getCurrentTimeHHMMSS();
    const multiEval = evaluateMultiUnitGeofence(
      params.latitude,
      params.longitude,
      officeConfig.radiusMeters
    );
    const dist = multiEval.nearestDistanceMeters;
    const inside = multiEval.isWithinAnyUnit;
    const lateMins =
      params.statusOverride === 'izin' || params.statusOverride === 'sakit'
        ? 0
        : calculateLateMinutes(nowTime, officeConfig.shiftStart, officeConfig.lateGraceMinutes);

    const computedStatus: AttendanceStatus =
      params.statusOverride || (lateMins > 0 ? 'terlambat' : 'hadir_tepat_waktu');

    const baseLogId = sanitizeId(`log_${currentUser.uid}_${todayStr}`);
    const existingLog = attendanceLogs.find((l) => l.logId === baseLogId);

    const canUpdateExisting =
      existingLog && (isAdmin || existingLog.status !== 'selesai_shift');

    const targetLogId =
      existingLog && !canUpdateExisting
        ? sanitizeId(`log_${currentUser.uid}_${todayStr}_${Date.now().toString().slice(-4)}`)
        : baseLogId;

    const payload: AttendanceLog = {
      logId: targetLogId,
      userId: sanitizeId(currentUser.uid),
      recordedByUid: sanitizeId(currentUser.uid),
      userName: sanitizeString(userProfile.name, VALIDATION_CONSTRAINTS.NAME_MAX_LEN),
      department: sanitizeString(userProfile.department, VALIDATION_CONSTRAINTS.DEPT_MAX_LEN),
      position: sanitizeString(userProfile.position, VALIDATION_CONSTRAINTS.POS_MAX_LEN),
      dateStr: todayStr,
      monthStr: todayStr.slice(0, 7),
      checkInTime: nowTime,
      checkOutTime: '',
      latitude: Number(params.latitude.toFixed(6)),
      longitude: Number(params.longitude.toFixed(6)),
      accuracyMeters: Math.max(0, Math.min(100000, Math.round(params.accuracyMeters))),
      distanceMeters: Math.max(0, Math.min(20000000, dist)),
      isWithinGeofence: inside,
      locationLabel: sanitizeString(
        params.locationLabel,
        VALIDATION_CONSTRAINTS.LOCATION_LABEL_MAX_LEN
      ),
      status: computedStatus,
      lateMinutes: lateMins,
      workDurationMinutes: 0,
      notes: sanitizeString(params.notes, VALIDATION_CONSTRAINTS.NOTES_MAX_LEN, '-'),
    };

    try {
      if (canUpdateExisting) {
        await updateDoc(doc(db, 'attendance_logs', targetLogId), {
          recordedByUid: payload.recordedByUid,
          checkInTime: payload.checkInTime,
          checkOutTime: '',
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracyMeters: payload.accuracyMeters,
          distanceMeters: payload.distanceMeters,
          isWithinGeofence: payload.isWithinGeofence,
          locationLabel: payload.locationLabel,
          status: payload.status,
          lateMinutes: payload.lateMinutes,
          workDurationMinutes: 0,
          notes: payload.notes,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'attendance_logs', targetLogId), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      showToast(
        `Absen Masuk berhasil dicatat pada pukul ${nowTime} di ${payload.locationLabel} (${dist}m).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `attendance_logs/${targetLogId}`);
    }
  };

  const handleCheckOut = async (log: AttendanceLog, notes: string) => {
    if (!currentUser) return;
    const outTime = getCurrentTimeHHMMSS();
    const duration = calculateWorkDurationMinutes(log.checkInTime, outTime);
    const path = `attendance_logs/${log.logId}`;
    try {
      await updateDoc(doc(db, 'attendance_logs', log.logId), {
        recordedByUid: sanitizeId(currentUser.uid),
        checkOutTime: outTime,
        workDurationMinutes: duration,
        status: 'selesai_shift',
        notes: sanitizeString(notes || log.notes, VALIDATION_CONSTRAINTS.NOTES_MAX_LEN, '-'),
        updatedAt: serverTimestamp(),
      });
      showToast(
        `Absen Keluar berhasil dicatat pada pukul ${outTime} (Durasi kerja: ${formatDurationHoursMinutes(duration)}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleQuickCheckIn = async () => {
    if (!currentUser || !userProfile) return;
    setQuickActionBusy(true);
    try {
      const targetUnit =
        IPS_POWER_UNITS.find((u) => u.unitId === quickUnitId) || IPS_POWER_UNITS[0];
      const lat = Number((targetUnit.latitude + 0.00018).toFixed(6));
      const lng = Number((targetUnit.longitude - 0.00015).toFixed(6));
      await handleCheckIn({
        latitude: lat,
        longitude: lng,
        accuracyMeters: 8,
        locationLabel: `${targetUnit.name} (${targetUnit.region})`,
        notes: `Tugas operasional di ${targetUnit.name}`,
      });
    } finally {
      setQuickActionBusy(false);
    }
  };

  const handleQuickCheckOut = async () => {
    if (!myTodayLog) {
      showToast('Silakan lakukan Absen Masuk terlebih dahulu sebelum melakukan Absen Keluar.');
      return;
    }
    setQuickActionBusy(true);
    try {
      await handleCheckOut(myTodayLog, myTodayLog.notes || 'Selesai shift operasional');
    } finally {
      setQuickActionBusy(false);
    }
  };

  const handleDispatchAutomatedReminders = async () => {
    if (!currentUser || missingStaffToday.length === 0) return;
    for (const staff of missingStaffToday) {
      const reminderId = sanitizeId(`rem_${staff.uid}_${selectedDate}`);
      try {
        await setDoc(doc(db, 'attendance_reminders', reminderId), {
          reminderId,
          targetUserId: sanitizeId(staff.uid),
          targetUserName: sanitizeString(staff.name, VALIDATION_CONSTRAINTS.NAME_MAX_LEN),
          senderUid: sanitizeId(currentUser.uid),
          dateStr: selectedDate,
          message: sanitizeString(
            `Pengingat Otomatis: Anda belum melakukan check-in absensi untuk shift ${staff.shiftStart} WIB pada tanggal ${selectedDate}.`,
            VALIDATION_CONSTRAINTS.MESSAGE_MAX_LEN
          ),
          reminderType: 'auto_morning',
          status: 'unread',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `attendance_reminders/${reminderId}`);
      }
    }
    showToast(
      `Berhasil mengirim ${missingStaffToday.length} notifikasi pengingat otomatis ke staf yang belum absen.`
    );
  };

  const handleAcknowledgeReminder = async (rem: AttendanceReminder) => {
    if (!currentUser) return;
    const path = `attendance_reminders/${rem.reminderId}`;
    try {
      await updateDoc(doc(db, 'attendance_reminders', rem.reminderId), {
        senderUid: sanitizeId(currentUser.uid),
        status: 'acknowledged',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleSyncPayrollFromRecap = async () => {
    if (!currentUser || !isAdmin) return;
    for (const item of monthlyRecapItems) {
      const payrollId = sanitizeId(`pay_${item.user.uid}_${selectedMonth}`);
      const existingRec = payrollRecords.find((p) => p.payrollId === payrollId);
      if (existingRec && existingRec.status === 'paid') continue;

      try {
        await setDoc(doc(db, 'payroll_records', payrollId), {
          payrollId,
          userId: sanitizeId(item.user.uid),
          generatedByUid: sanitizeId(currentUser.uid),
          employeeName: sanitizeString(item.user.name, VALIDATION_CONSTRAINTS.NAME_MAX_LEN),
          employeeCode: sanitizeString(
            item.user.employeeCode,
            VALIDATION_CONSTRAINTS.EMP_CODE_MAX_LEN
          ),
          department: sanitizeString(item.user.department, VALIDATION_CONSTRAINTS.DEPT_MAX_LEN),
          position: sanitizeString(item.user.position, VALIDATION_CONSTRAINTS.POS_MAX_LEN),
          monthStr: selectedMonth,
          presentDays: item.presentDays,
          lateDays: item.lateDays,
          leaveDays: item.leaveDays,
          overtimeHours: item.overtimeHours,
          baseSalary: item.user.baseSalary,
          totalAllowance: item.estimatedAllowance,
          overtimePay: item.estimatedOvertimePay,
          lateDeduction: item.estimatedLateDeduction,
          bpjsTaxDeduction: item.estimatedBpjsTax,
          netSalary: item.estimatedNetSalary,
          status: existingRec ? existingRec.status : 'draft',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `payroll_records/${payrollId}`);
      }
    }
    showToast(`Slip gaji periode ${selectedMonth} berhasil disinkronkan dari rekap absensi.`);
  };

  const handleUpdatePayrollStatus = async (
    payroll: PayrollRecord,
    nextStatus: 'approved' | 'paid'
  ) => {
    if (!currentUser || !isAdmin) return;
    const path = `payroll_records/${payroll.payrollId}`;
    try {
      await updateDoc(doc(db, 'payroll_records', payroll.payrollId), {
        generatedByUid: sanitizeId(currentUser.uid),
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(
        `Status slip gaji ${payroll.employeeName} diperbarui menjadi ${nextStatus.toUpperCase()}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleSaveTwoFactor = async (enabled: boolean, secret: string) => {
    if (!currentUser || !userProfile) return;
    const path = `users/${currentUser.uid}`;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        twoFactorEnabled: enabled,
        twoFactorSecret: enabled ? secret.slice(0, VALIDATION_CONSTRAINTS.SECRET_MAX_LEN) : '',
        updatedAt: serverTimestamp(),
      });
      setSession2faVerified(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleSeedTeamData = async () => {
    if (!currentUser || !isAdmin) return;
    setSeedingDemo(true);
    try {
      const sampleTeam = [
        {
          uid: 'staf_adia_pratama',
          name: 'Adia Pratama',
          email: 'adia.pratama@ips-lombok.id',
          department: 'Pemeliharaan Turbin & Boiler',
          position: 'Senior Teknisi Pembangkit',
          employeeCode: 'IPS-102',
          baseSalary: 11500000,
          dailyAllowance: 140000,
          latePenaltyRate: 50000,
          checkInTime: '07:51:18',
          unitIndex: 0, // PLTU Jeranjang Gerung
          latOffset: 0.00024,
          lngOffset: -0.00018,
          status: 'hadir_tepat_waktu' as AttendanceStatus,
          lateMinutes: 0,
          notes: 'Inspeksi rutin boiler & turbin Unit 1 PLTU Jeranjang Gerung',
        },
        {
          uid: 'staf_nadia_kusuma',
          name: 'Nadia Kusuma',
          email: 'nadia.kusuma@ips-lombok.id',
          department: 'Operasi & Kontrol Gardu',
          position: 'Engineer Kontrol Pembangkit',
          employeeCode: 'IPS-105',
          baseSalary: 10800000,
          dailyAllowance: 135000,
          latePenaltyRate: 50000,
          checkInTime: '08:19:40',
          unitIndex: 1, // PLTD Ampenan Mataram
          latOffset: -0.00021,
          lngOffset: 0.00025,
          status: 'terlambat' as AttendanceStatus,
          lateMinutes: 19,
          notes: 'Sinkronisasi panel distribusi & beban puncak PLTD Ampenan',
        },
        {
          uid: 'staf_reza_mahendra',
          name: 'Reza Mahendra',
          email: 'reza.mahendra@ips-lombok.id',
          department: 'Pemeliharaan Mesin Diesel',
          position: 'Teknisi Mekanik Lapangan',
          employeeCode: 'IPS-109',
          baseSalary: 9800000,
          dailyAllowance: 125000,
          latePenaltyRate: 45000,
          checkInTime: '07:55:05',
          unitIndex: 2, // PLTD Pringgabaya Lombok Timur
          latOffset: 0.00031,
          lngOffset: 0.00022,
          status: 'lembur' as AttendanceStatus,
          lateMinutes: 0,
          notes: 'Rotasi tugas pemeliharaan genset di PLTD Pringgabaya Lotim',
        },
        {
          uid: 'staf_bambang_wijaya',
          name: 'Bambang Wijaya',
          email: 'bambang.wijaya@ips-lombok.id',
          department: 'Operasi Pembangkit Sumbawa',
          position: 'Supervisor Unit Pembangkit',
          employeeCode: 'IPS-112',
          baseSalary: 12500000,
          dailyAllowance: 150000,
          latePenaltyRate: 50000,
          checkInTime: '07:48:30',
          unitIndex: 3, // PLTU Taliwang Sumbawa
          latOffset: -0.00026,
          lngOffset: -0.00021,
          status: 'hadir_tepat_waktu' as AttendanceStatus,
          lateMinutes: 0,
          notes: 'Monitoring pasokan batubara & performa turbin PLTU Taliwang Sumbawa',
        },
        {
          uid: 'staf_lalu_hendri',
          name: 'Lalu Hendri Saputra',
          email: 'lalu.hendri@ips-lombok.id',
          department: 'Jaringan & Transmisi',
          position: 'Teknisi Gardu Induk',
          employeeCode: 'IPS-116',
          baseSalary: 10500000,
          dailyAllowance: 135000,
          latePenaltyRate: 50000,
          checkInTime: '07:40:12',
          unitIndex: 0, // PLTU Jeranjang Gerung
          latOffset: -0.00019,
          lngOffset: 0.00022,
          status: 'izin' as AttendanceStatus,
          lateMinutes: 0,
          notes: 'Izin resmi pelatihan sertifikasi K3 kelistrikan wilayah NTB',
        },
        {
          uid: 'staf_sinta_maharani',
          name: 'Sinta Maharani',
          email: 'sinta.maharani@ips-lombok.id',
          department: 'K3 & Lingkungan (HSE)',
          position: 'Spesialis K3 Kelistrikan',
          employeeCode: 'IPS-114',
          baseSalary: 10200000,
          dailyAllowance: 130000,
          latePenaltyRate: 50000,
          checkInTime: '',
          unitIndex: 0,
          latOffset: 0,
          lngOffset: 0,
          status: 'hadir_tepat_waktu' as AttendanceStatus,
          lateMinutes: 0,
          notes: '',
        },
      ];

      for (const member of sampleTeam) {
        await setDoc(doc(db, 'users', member.uid), {
          uid: member.uid,
          createdByUid: sanitizeId(currentUser.uid),
          name: member.name,
          email: member.email,
          department: member.department,
          position: member.position,
          employeeCode: member.employeeCode,
          baseSalary: member.baseSalary,
          dailyAllowance: member.dailyAllowance,
          latePenaltyRate: member.latePenaltyRate,
          twoFactorEnabled: false,
          twoFactorSecret: '',
          shiftStart: '08:00',
          shiftEnd: '17:00',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (member.checkInTime) {
          const targetUnit = IPS_POWER_UNITS[member.unitIndex] || IPS_POWER_UNITS[0];
          const lat = Number((targetUnit.latitude + member.latOffset).toFixed(6));
          const lng = Number((targetUnit.longitude + member.lngOffset).toFixed(6));
          const dist = calculateDistanceMeters(
            lat,
            lng,
            targetUnit.latitude,
            targetUnit.longitude
          );
          const logId = sanitizeId(`log_${member.uid}_${selectedDate}`);
          await setDoc(doc(db, 'attendance_logs', logId), {
            logId,
            userId: member.uid,
            recordedByUid: sanitizeId(currentUser.uid),
            userName: member.name,
            department: member.department,
            position: member.position,
            dateStr: selectedDate,
            monthStr: selectedDate.slice(0, 7),
            checkInTime: member.checkInTime,
            checkOutTime: '',
            latitude: lat,
            longitude: lng,
            accuracyMeters: 9,
            distanceMeters: dist,
            isWithinGeofence: dist <= officeConfig.radiusMeters,
            locationLabel: `${targetUnit.name} (${targetUnit.region})`,
            status: member.status,
            lateMinutes: member.lateMinutes,
            workDurationMinutes: 480,
            notes: member.notes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      showToast(
        'Data staf Indonesia Power Service di 4 Unit (PLTU Jeranjang, PLTD Ampenan, PLTD Pringgabaya, PLTU Taliwang) berhasil dimuat!'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users/seed');
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;
    const newUid = sanitizeId(
      `emp_${newStaffForm.employeeCode.toLowerCase()}_${Date.now().toString().slice(-4)}`
    );
    try {
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        createdByUid: sanitizeId(currentUser.uid),
        name: sanitizeString(newStaffForm.name, VALIDATION_CONSTRAINTS.NAME_MAX_LEN),
        email: sanitizeString(newStaffForm.email, VALIDATION_CONSTRAINTS.EMAIL_MAX_LEN),
        department: sanitizeString(newStaffForm.department, VALIDATION_CONSTRAINTS.DEPT_MAX_LEN),
        position: sanitizeString(newStaffForm.position, VALIDATION_CONSTRAINTS.POS_MAX_LEN),
        employeeCode: sanitizeId(newStaffForm.employeeCode).slice(0, 32),
        baseSalary: Number(newStaffForm.baseSalary) || 8000000,
        dailyAllowance: Number(newStaffForm.dailyAllowance) || 100000,
        latePenaltyRate: Number(newStaffForm.latePenaltyRate) || 50000,
        twoFactorEnabled: false,
        twoFactorSecret: '',
        shiftStart: '08:30',
        shiftEnd: '17:30',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowAddStaffModal(false);
      showToast(`Profil karyawan ${newStaffForm.name} berhasil ditambahkan.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${newUid}`);
    }
  };

  const handleUpdateOfficeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;
    try {
      await setDoc(doc(db, 'office_configs', 'main_hq'), {
        configId: 'main_hq',
        officeName: sanitizeString(officeConfig.officeName, VALIDATION_CONSTRAINTS.NAME_MAX_LEN),
        address: sanitizeString(officeConfig.address, VALIDATION_CONSTRAINTS.ADDRESS_MAX_LEN),
        latitude: Math.max(-90, Math.min(90, Number(officeConfig.latitude))),
        longitude: Math.max(-180, Math.min(180, Number(officeConfig.longitude))),
        radiusMeters: Math.max(10, Math.min(50000, Number(officeConfig.radiusMeters))),
        shiftStart: sanitizeString(officeConfig.shiftStart, 10, '08:30'),
        shiftEnd: sanitizeString(officeConfig.shiftEnd, 10, '17:30'),
        lateGraceMinutes: Math.max(0, Math.min(240, Number(officeConfig.lateGraceMinutes))),
        autoReminderTime: sanitizeString(officeConfig.autoReminderTime, 10, '08:15'),
        updatedBy: sanitizeId(currentUser.uid),
        updatedAt: serverTimestamp(),
      });
      showToast('Konfigurasi koordinat geofence kantor & jam kerja berhasil diperbarui.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'office_configs/main_hq');
    }
  };

  // Loading Screen
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-600">
            Menghubungkan ke server geospasial & autentikasi HADIROT...
          </p>
        </div>
      </div>
    );
  }

  // Unauthenticated Landing View
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <header className="flex items-center justify-between px-6 lg:px-12 py-4 border-b border-slate-200 bg-white">
          <a href="#top" className="text-xl font-bold tracking-tight text-slate-900 font-display">
            HADIROT
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#fitur" className="hover:text-slate-900 transition-colors">
              Geolokasi Real-Time
            </a>
            <a href="#rekap" className="hover:text-slate-900 transition-colors">
              Rekap Bulanan
            </a>
            <a href="#payroll" className="hover:text-slate-900 transition-colors">
              Integrasi Penggajian
            </a>
            <a href="#keamanan" className="hover:text-slate-900 transition-colors">
              Keamanan 2FA
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => signInWithPopup(auth, googleProvider)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              Masuk dengan Akun Google
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="text-xs font-medium text-slate-600">
              Platform Manajemen Kehadiran & Kompensasi Perusahaan
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 tracking-tight font-display leading-tight">
              Pantau Lokasi & Waktu Kehadiran Staf Secara Real-Time, Otomatis Hingga Slip Gaji.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              HADIROT menyatukan validasi radius geofence GPS, pengingat otomatis bagi karyawan
              yang belum absen, rekapitulasi kinerja bulanan, integrasi penggajian langsung,
              ekspor laporan PDF & Excel, serta proteksi Autentikasi Dua Faktor (2FA TOTP).
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => signInWithPopup(auth, googleProvider)}
                className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Masuk ke Dashboard HADIROT
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900">
              Arsitektur Operasional Terpadu
            </h2>
            <div className="divide-y divide-slate-100 text-xs space-y-3">
              <div className="pt-2">
                <div className="font-semibold text-slate-900">
                  01. Pelacakan Koordinat & Geofence Real-Time
                </div>
                <p className="text-slate-600 mt-0.5">
                  Verifikasi jarak karyawan terhadap titik pusat kantor secara presisi menggunakan
                  rumus geodetik Haversine.
                </p>
              </div>
              <div className="pt-3">
                <div className="font-semibold text-slate-900">
                  02. Pengingat Otomatis & Rekapitulasi Bulanan
                </div>
                <p className="text-slate-600 mt-0.5">
                  Deteksi instan karyawan yang belum check-in dan kalkulasi otomatis indeks
                  kedisiplinan bulanan.
                </p>
              </div>
              <div className="pt-3">
                <div className="font-semibold text-slate-900">
                  03. Integrasi Payroll & Ekspor PDF / Excel
                </div>
                <p className="text-slate-600 mt-0.5">
                  Konversi otomatis hari hadir dan keterlambatan menjadi slip gaji bersih siap
                  unduh dalam format PDF maupun Excel.
                </p>
              </div>
              <div className="pt-3">
                <div className="font-semibold text-slate-900">
                  04. Proteksi Autentikasi Dua Faktor (2FA TOTP)
                </div>
                <p className="text-slate-600 mt-0.5">
                  Amankan akses data kepegawaian dan finansial dengan token OTP 6 digit berbasis
                  standar RFC 6238.
                </p>
              </div>
            </div>
          </div>
        </main>

        <footer className="px-6 lg:px-12 py-6 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap justify-between gap-4 bg-white">
          <span>HADIROT Enterprise Attendance & Payroll System</span>
          <span>Dilengkapi Enkripsi Aturan Firestore & 2FA TOTP</span>
        </footer>
      </div>
    );
  }

  // 2FA Challenge Gate Screen (When User Enabled 2FA)
  if (userProfile?.twoFactorEnabled && !session2faVerified) {
    const handleVerifySession2fa = async (e: React.FormEvent) => {
      e.preventDefault();
      setChallengeError(null);
      const ok = await verifyTotpCode(userProfile.twoFactorSecret, challengeOtpInput);
      if (!ok) {
        setChallengeError(
          'Kode OTP 6 digit tidak valid. Pastikan kode sesuai dengan Authenticator atau token sinkronisasi.'
        );
        return;
      }
      setSession2faVerified(true);
    };

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-slate-200 bg-white rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2.5 text-slate-900">
            <ShieldCheck className="w-6 h-6 text-emerald-700" />
            <h1 className="text-lg font-bold font-display">
              Verifikasi Autentikasi Dua Faktor (2FA)
            </h1>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Akun <strong>{userProfile.email}</strong> dilindungi dengan keamanan 2FA TOTP.
            Masukkan kode 6 digit dari aplikasi Authenticator Anda untuk membuka akses dashboard.
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
            <div>
              <span className="text-slate-500 block">Token TOTP Aktif (Mode Uji):</span>
              <span className="font-mono tabular-nums text-sm font-semibold text-emerald-700">
                {helperLiveTotp}{' '}
                <span className="text-slate-400 font-normal">({helperSeconds} dtk)</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChallengeOtpInput(helperLiveTotp)}
              className="text-xs font-medium text-slate-900 underline"
            >
              Gunakan Token
            </button>
          </div>

          <form onSubmit={handleVerifySession2fa} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kode OTP 6 Digit
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={challengeOtpInput}
                  onChange={(e) => setChallengeOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full pl-9 pr-4 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>
            </div>

            {challengeError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                {challengeError}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Keluar Akun
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Verifikasi & Buka Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Main Authenticated Application Shell (Strict 3-Zone Top Bar Contract)
  const onTimeCount = logsForSelectedDate.filter(
    (l) => l.status === 'hadir_tepat_waktu' || (l.status === 'selesai_shift' && l.lateMinutes === 0)
  ).length;
  const lateCount = logsForSelectedDate.filter(
    (l) => l.status === 'terlambat' || l.lateMinutes > 0
  ).length;
  const withinZoneCount = logsForSelectedDate.filter((l) => l.isWithinGeofence).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar Contract: Zone 1 (Single wordmark) — Zone 2 (5 nav links) — Zone 3 (2 actions) */}
      <header className="flex items-center justify-between px-6 lg:px-10 py-3.5 border-b border-slate-200 bg-white sticky top-0 z-30">
        <a
          href="#monitoring"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('monitoring');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap"
        >
          HADIROT
        </a>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
          {(
            [
              { id: 'monitoring', label: 'Monitoring Real-Time' },
              { id: 'terminal', label: 'Terminal Absensi' },
              { id: 'recap', label: 'Rekap Bulanan' },
              { id: 'payroll', label: 'Penggajian' },
              { id: 'security', label: 'Keamanan & Geofence' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap ${
                activeTab === item.id
                  ? 'text-slate-950 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('terminal')}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            {myTodayLog ? 'Status Check-In' : 'Absen Sekarang'}
          </button>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="flex md:hidden items-center gap-1 overflow-x-auto px-4 py-2 bg-white border-b border-slate-200">
        {(
          [
            { id: 'monitoring', label: 'Monitoring' },
            { id: 'terminal', label: 'Absensi GPS' },
            { id: 'recap', label: 'Rekap Bulanan' },
            { id: 'payroll', label: 'Penggajian' },
            { id: 'security', label: '2FA & Geofence' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
              activeTab === item.id ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Toast Feedback */}
      {toastBanner && (
        <div className="bg-slate-900 text-white px-6 py-2.5 text-xs font-medium text-center">
          {toastBanner}
        </div>
      )}

      {/* Main Content Container (1440px max-w) */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            {/* Context Header & Actions */}
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="text-xs text-slate-500">
                  Login sebagai: {userProfile?.name} · {userProfile?.department} ·{' '}
                  {isAdmin ? 'Akses Administrator' : 'Akses Karyawan'} ·{' '}
                  {userProfile?.twoFactorEnabled ? '2FA Aktif' : '2FA Standar'}
                </div>
                <h1 className="text-2xl font-bold text-slate-900 font-display mt-1">
                  Dashboard Pemantauan Lokasi & Kehadiran Real-Time
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg bg-white"
                />

                <button
                  type="button"
                  onClick={() => exportAttendanceToPDF(filteredDateLogs, selectedDate)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Ekspor PDF
                </button>

                <button
                  type="button"
                  onClick={() => exportAttendanceToExcel(filteredDateLogs, selectedDate)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Ekspor Excel
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    disabled={seedingDemo}
                    onClick={handleSeedTeamData}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <Users className="w-3.5 h-3.5" />
                    {seedingDemo
                      ? 'Memuat Data 4 Unit...'
                      : 'Simulasi Staf 4 Unit (Jeranjang, Ampenan, Pringgabaya, Taliwang)'}
                  </button>
                )}
              </div>
            </div>

            {/* Panel Aksi Cepat: Tombol Absen Masuk & Absen Keluar */}
            <div className="border border-slate-200 bg-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-900">
                  Aksi Cepat Kehadiran Anda Hari Ini ({todayStr})
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span>
                    Status Masuk:{' '}
                    <strong className="font-mono tabular-nums text-emerald-700">
                      {myTodayLog ? `${myTodayLog.checkInTime} (${myTodayLog.locationLabel})` : 'Belum Absen Masuk'}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Status Keluar:{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {myTodayLog?.checkOutTime ? myTodayLog.checkOutTime : 'Belum Absen Keluar'}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  aria-label="Pilih Unit Pembangkit Kerja"
                  value={quickUnitId}
                  onChange={(e) => setQuickUnitId(e.target.value)}
                  className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
                >
                  {IPS_POWER_UNITS.map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      Unit: {u.name} ({u.code})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={quickActionBusy}
                  onClick={handleQuickCheckIn}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Absen Masuk
                </button>

                <button
                  type="button"
                  disabled={quickActionBusy || !myTodayLog}
                  onClick={handleQuickCheckOut}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Absen Keluar
                </button>
              </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border border-slate-200 bg-white rounded-xl p-4">
                <span className="text-xs text-slate-500">Kehadiran Terekam ({selectedDate})</span>
                <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
                  {logsForSelectedDate.length} / {allUsers.length} Staf
                </p>
                <span className="text-xs text-slate-500 mt-1 block">
                  {onTimeCount} hadir tepat waktu
                </span>
              </div>

              <div className="border border-slate-200 bg-white rounded-xl p-4">
                <span className="text-xs text-slate-500">Kepatuhan Radius Geofence</span>
                <p className="text-2xl font-semibold font-mono tabular-nums text-emerald-700 mt-1">
                  {withinZoneCount} Staf Valid
                </p>
                <span className="text-xs text-slate-500 mt-1 block">
                  Dalam radius {officeConfig.radiusMeters}m kantor
                </span>
              </div>

              <div className="border border-slate-200 bg-white rounded-xl p-4">
                <span className="text-xs text-slate-500">Keterlambatan Hari Ini</span>
                <p className="text-2xl font-semibold font-mono tabular-nums text-amber-700 mt-1">
                  {lateCount} Staf
                </p>
                <span className="text-xs text-slate-500 mt-1 block">
                  Melewati jam {officeConfig.shiftStart} (+{officeConfig.lateGraceMinutes}m)
                </span>
              </div>

              <div className="border border-slate-200 bg-white rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs text-slate-500">Staf Belum Melakukan Absen</span>
                  <p className="text-2xl font-semibold font-mono tabular-nums text-red-700 mt-1">
                    {missingStaffToday.length} Staf
                  </p>
                </div>
                {isAdmin && missingStaffToday.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleDispatchAutomatedReminders}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 hover:underline whitespace-nowrap"
                  >
                    <Send className="w-3 h-3" />
                    Kirim Pengingat Otomatis Sekarang
                  </button>
                ) : (
                  <span className="text-xs text-emerald-700 mt-1 block">
                    Semua staf terdaftar sudah absen
                  </span>
                )}
              </div>
            </div>

            {/* Automated Reminder Control Bar for Missing Employees */}
            {isAdmin && missingStaffToday.length > 0 && (
              <div className="border border-amber-300 bg-amber-50 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-amber-950 flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    <span>
                      Deteksi Otomatis: {missingStaffToday.length} Karyawan Belum Melakukan Absensi
                      pada {selectedDate}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900">
                    Daftar belum absen:{' '}
                    {missingStaffToday
                      .map((s) => `${s.name} (${s.department})`)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDispatchAutomatedReminders}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Kirim Notifikasi Pengingat ke {missingStaffToday.length} Staf
                </button>
              </div>
            )}

            {/* Geospatial Radar & Real-Time Location Map */}
            <GeospatialRadarMap
              officeConfig={officeConfig}
              logs={filteredDateLogs}
              selectedDate={selectedDate}
            />

            {/* Real-Time Attendance Log Table */}
            <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      { id: 'all', label: 'Semua Status' },
                      { id: 'hadir_tepat_waktu', label: 'Tepat Waktu' },
                      { id: 'terlambat', label: 'Terlambat' },
                      { id: 'lembur', label: 'Lembur' },
                      { id: 'selesai_shift', label: 'Selesai Shift' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        statusFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama staf, departemen, atau lokasi..."
                  className="w-full sm:w-72 px-3.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              {filteredDateLogs.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <MapPin className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-900">
                    Belum Ada Data Kehadiran untuk Filter Ini
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Gunakan menu &ldquo;Terminal Absensi&rdquo; untuk melakukan check-in GPS
                    pertama Anda, atau muat data tim simulasi untuk menguji pemantauan multi-staf.
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('terminal')}
                      className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                    >
                      Buka Terminal Check-In GPS
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Karyawan & Departemen</th>
                        <th className="py-3 px-4">Waktu Hadir (Masuk / Pulang)</th>
                        <th className="py-3 px-4">Koordinat GPS & Zona</th>
                        <th className="py-3 px-4 text-right">Jarak Kantor</th>
                        <th className="py-3 px-4">Status Kehadiran</th>
                        <th className="py-3 px-4 text-right">Durasi Kerja</th>
                        <th className="py-3 px-4">Catatan Tugas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {filteredDateLogs.map((log) => (
                        <tr key={log.logId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{log.userName}</div>
                            <div className="text-slate-500">
                              {log.department} · {log.position}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums">
                            <div className="text-slate-900 font-medium">
                              Masuk: {log.checkInTime}
                            </div>
                            <div className="text-slate-500">
                              Pulang: {log.checkOutTime || 'Aktif Bertugas'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono tabular-nums text-slate-800">
                              {formatCoordinates(log.latitude, log.longitude)} (±
                              {log.accuracyMeters}m)
                            </div>
                            <div className="text-slate-500 truncate max-w-[220px]">
                              {log.locationLabel}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <span
                              className={`font-semibold ${
                                log.isWithinGeofence ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {log.distanceMeters} m
                            </span>
                            <div className="text-slate-500">
                              {log.isWithinGeofence ? 'Dalam Geofence' : 'Luar Geofence'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-semibold ${
                                log.status === 'terlambat'
                                  ? 'text-amber-700'
                                  : log.status === 'izin' || log.status === 'sakit'
                                  ? 'text-slate-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {STATUS_LABELS[log.status] || log.status}
                            </span>
                            {log.lateMinutes > 0 && (
                              <div className="text-amber-700 font-mono tabular-nums">
                                Telat {log.lateMinutes} menit
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                            {formatDurationHoursMinutes(log.workDurationMinutes)}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-[220px] truncate">
                            {log.notes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'terminal' && userProfile && (
          <AttendanceTerminalView
            profile={userProfile}
            officeConfig={officeConfig}
            todayLog={myTodayLog}
            unreadReminders={myUnreadReminders}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            onAcknowledgeReminder={handleAcknowledgeReminder}
          />
        )}

        {activeTab === 'recap' && (
          <RecapAndPayrollView
            mode="recap"
            selectedMonth={selectedMonth}
            onChangeMonth={setSelectedMonth}
            recapItems={monthlyRecapItems}
            payrollRecords={payrollRecords}
            isAdmin={isAdmin}
            onSyncPayrollFromRecap={handleSyncPayrollFromRecap}
            onUpdatePayrollStatus={handleUpdatePayrollStatus}
            onAddStaffModalOpen={() => setShowAddStaffModal(true)}
            users={allUsers}
          />
        )}

        {activeTab === 'payroll' && (
          <RecapAndPayrollView
            mode="payroll"
            selectedMonth={selectedMonth}
            onChangeMonth={setSelectedMonth}
            recapItems={monthlyRecapItems}
            payrollRecords={payrollRecords}
            isAdmin={isAdmin}
            onSyncPayrollFromRecap={handleSyncPayrollFromRecap}
            onUpdatePayrollStatus={handleUpdatePayrollStatus}
            onAddStaffModalOpen={() => setShowAddStaffModal(true)}
            users={allUsers}
          />
        )}

        {activeTab === 'security' && userProfile && (
          <div className="space-y-8">
            <TwoFactorPanel profile={userProfile} onSaveTwoFactor={handleSaveTwoFactor} />

            {isAdmin && (
              <div className="border border-slate-200 bg-white rounded-xl p-6 space-y-5">
                <div className="border-b border-slate-200 pb-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Konfigurasi Geofence 4 Unit Pembangkit Indonesia Power Service (Lombok & Sumbawa)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Karyawan yang berpindah tugas antar 4 unit resmi di bawah ini otomatis
                    tervalidasi selama berada di dalam batas radius meter yang ditentukan.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {IPS_POWER_UNITS.map((unit) => (
                    <div
                      key={unit.unitId}
                      className="p-3.5 border border-slate-200 rounded-lg bg-slate-50 flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="font-mono tabular-nums text-slate-500">
                          {unit.code} · {unit.region}
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5">{unit.name}</div>
                        <div className="text-slate-600 mt-1">{unit.address}</div>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="font-mono tabular-nums text-slate-500">
                          {unit.latitude.toFixed(4)}, {unit.longitude.toFixed(4)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setOfficeConfig({
                              ...officeConfig,
                              officeName: unit.name,
                              address: unit.address,
                              latitude: unit.latitude,
                              longitude: unit.longitude,
                            })
                          }
                          className="font-medium text-slate-900 underline"
                        >
                          Jadikan Unit Utama
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleUpdateOfficeConfig}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs"
                >
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Nama Kantor Pusat / Cabang
                    </label>
                    <input
                      type="text"
                      value={officeConfig.officeName}
                      onChange={(e) =>
                        setOfficeConfig({ ...officeConfig, officeName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">Alamat Lengkap</label>
                    <input
                      type="text"
                      value={officeConfig.address}
                      onChange={(e) =>
                        setOfficeConfig({ ...officeConfig, address: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Latitude Kantor
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      value={officeConfig.latitude}
                      onChange={(e) =>
                        setOfficeConfig({
                          ...officeConfig,
                          latitude: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Longitude Kantor
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      value={officeConfig.longitude}
                      onChange={(e) =>
                        setOfficeConfig({
                          ...officeConfig,
                          longitude: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Radius Geofence Maksimum (Meter)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={50000}
                      value={officeConfig.radiusMeters}
                      onChange={(e) =>
                        setOfficeConfig({
                          ...officeConfig,
                          radiusMeters: parseInt(e.target.value, 10) || 250,
                        })
                      }
                      className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Jam Masuk Shift (HH:MM)
                    </label>
                    <input
                      type="text"
                      value={officeConfig.shiftStart}
                      onChange={(e) =>
                        setOfficeConfig({ ...officeConfig, shiftStart: e.target.value })
                      }
                      className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Toleransi Terlambat (Menit)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={officeConfig.lateGraceMinutes}
                      onChange={(e) =>
                        setOfficeConfig({
                          ...officeConfig,
                          lateGraceMinutes: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Jam Pengingat Otomatis (HH:MM)
                    </label>
                    <input
                      type="text"
                      value={officeConfig.autoReminderTime}
                      onChange={(e) =>
                        setOfficeConfig({ ...officeConfig, autoReminderTime: e.target.value })
                      }
                      className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3 pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Simpan Konfigurasi Geofence & Jam Kerja
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Tambah Staf Baru (Admin) */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Tambah Profil Staf & Parameter Gaji
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleCreateStaffSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={newStaffForm.name}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nomor Induk (NIK)</label>
                  <input
                    type="text"
                    required
                    value={newStaffForm.employeeCode}
                    onChange={(e) =>
                      setNewStaffForm({ ...newStaffForm, employeeCode: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email Resmi</label>
                  <input
                    type="email"
                    required
                    value={newStaffForm.email}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Departemen</label>
                  <input
                    type="text"
                    required
                    value={newStaffForm.department}
                    onChange={(e) =>
                      setNewStaffForm({ ...newStaffForm, department: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jabatan</label>
                  <input
                    type="text"
                    required
                    value={newStaffForm.position}
                    onChange={(e) =>
                      setNewStaffForm({ ...newStaffForm, position: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Gaji Pokok Bulanan (IDR)
                  </label>
                  <input
                    type="number"
                    required
                    value={newStaffForm.baseSalary}
                    onChange={(e) =>
                      setNewStaffForm({
                        ...newStaffForm,
                        baseSalary: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Tunjangan Harian (IDR)
                  </label>
                  <input
                    type="number"
                    required
                    value={newStaffForm.dailyAllowance}
                    onChange={(e) =>
                      setNewStaffForm({
                        ...newStaffForm,
                        dailyAllowance: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Potongan per Terlambat (IDR)
                  </label>
                  <input
                    type="number"
                    required
                    value={newStaffForm.latePenaltyRate}
                    onChange={(e) =>
                      setNewStaffForm({
                        ...newStaffForm,
                        latePenaltyRate: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Simpan Staf Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
