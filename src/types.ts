import { Timestamp } from 'firebase/firestore';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'firmansyahrizki141@gmail.com';

export const VALIDATION_CONSTRAINTS = {
  ID_MAX_LEN: 128,
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  DATE_REGEX: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  MONTH_REGEX: /^[0-9]{4}-[0-9]{2}$/,
  NAME_MAX_LEN: 100,
  EMAIL_MAX_LEN: 120,
  DEPT_MAX_LEN: 60,
  POS_MAX_LEN: 80,
  EMP_CODE_MAX_LEN: 32,
  SECRET_MAX_LEN: 64,
  SHIFT_MAX_LEN: 10,
  ADDRESS_MAX_LEN: 250,
  LOCATION_LABEL_MAX_LEN: 180,
  NOTES_MAX_LEN: 300,
  MESSAGE_MAX_LEN: 300,
  FACE_URL_MAX_LEN: 2000,
} as const;

export function sanitizeString(input: string, maxLength: number, fallback = '-'): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

export function sanitizeId(input: string): string {
  const cleaned = (input || '').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, VALIDATION_CONSTRAINTS.ID_MAX_LEN);
  return cleaned || 'id_default';
}

export type AttendanceStatus =
  | 'hadir_tepat_waktu'
  | 'terlambat'
  | 'izin'
  | 'sakit'
  | 'lembur'
  | 'selesai_shift';

export interface UserProfile {
  uid: string;
  createdByUid: string;
  name: string;
  email: string;
  department: string;
  position: string;
  employeeCode: string;
  baseSalary: number;
  dailyAllowance: number;
  latePenaltyRate: number;
  twoFactorEnabled: boolean;
  twoFactorSecret: string;
  shiftStart: string;
  shiftEnd: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface OfficeConfig {
  configId: string;
  officeName: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  shiftStart: string;
  shiftEnd: string;
  lateGraceMinutes: number;
  autoReminderTime: string;
  updatedBy: string;
  updatedAt?: Timestamp;
}

export interface AttendanceLog {
  logId: string;
  userId: string;
  recordedByUid: string;
  userName: string;
  department: string;
  position: string;
  dateStr: string;
  monthStr: string;
  checkInTime: string;
  checkOutTime: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  distanceMeters: number;
  isWithinGeofence: boolean;
  locationLabel: string;
  status: AttendanceStatus;
  lateMinutes: number;
  workDurationMinutes: number;
  notes: string;
  faceVerificationUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AttendanceReminder {
  reminderId: string;
  targetUserId: string;
  targetUserName: string;
  senderUid: string;
  dateStr: string;
  message: string;
  reminderType: 'auto_morning' | 'admin_nudge' | 'checkout_reminder';
  status: 'unread' | 'acknowledged';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PayrollRecord {
  payrollId: string;
  userId: string;
  generatedByUid: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  position: string;
  monthStr: string;
  presentDays: number;
  lateDays: number;
  leaveDays: number;
  overtimeHours: number;
  baseSalary: number;
  totalAllowance: number;
  overtimePay: number;
  lateDeduction: number;
  bpjsTaxDeduction: number;
  netSalary: number;
  status: 'draft' | 'approved' | 'paid';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MonthlyRecapItem {
  user: UserProfile;
  monthStr: string;
  presentDays: number;
  onTimeDays: number;
  lateDays: number;
  leaveDays: number;
  totalLateMinutes: number;
  totalWorkMinutes: number;
  overtimeHours: number;
  withinGeofenceCount: number;
  disciplineScore: number;
  estimatedAllowance: number;
  estimatedOvertimePay: number;
  estimatedLateDeduction: number;
  estimatedBpjsTax: number;
  estimatedNetSalary: number;
}

export type ShiftSwapStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ShiftSwapRequest {
  swapId: string;
  requesterUid: string;
  requesterName: string;
  requesterDepartment: string;
  requesterPosition: string;
  requesterShiftDate: string;
  requesterShiftTime: string;
  requesterUnitName: string;
  colleagueUid: string;
  colleagueName: string;
  colleagueDepartment: string;
  colleaguePosition: string;
  targetShiftDate: string;
  targetShiftTime: string;
  targetUnitName: string;
  reason: string;
  status: ShiftSwapStatus;
  adminNotes?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
