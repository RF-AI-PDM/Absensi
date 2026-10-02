/**
 * Verification test suite for Firestore Security Rules ("Dirty Dozen" Payloads)
 * Validates that all 12 adversarial payloads return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on User Profile',
    collection: 'users/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'budi@company.id', email_verified: true },
    payload: {
      uid: 'user_1',
      name: 'Budi Santoso',
      email: 'budi@company.id',
      department: 'Engineering',
      position: 'Backend Engineer',
      employeeCode: 'EMP-001',
      baseSalary: 12000000,
      dailyAllowance: 100000,
      latePenaltyRate: 50000,
      twoFactorEnabled: false,
      twoFactorSecret: '',
      shiftStart: '08:30',
      shiftEnd: '17:30',
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Attendance Check-In',
    collection: 'attendance_logs/log_1',
    operation: 'create',
    auth: { uid: 'attacker_uid', email: 'attacker@company.id', email_verified: true },
    payload: {
      logId: 'log_1',
      userId: 'victim_uid',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Orphaned Attendance Creation without User Profile',
    collection: 'attendance_logs/log_orphan',
    operation: 'create',
    auth: { uid: 'ghost_uid', email: 'ghost@company.id', email_verified: true },
    payload: {
      logId: 'log_orphan',
      userId: 'ghost_uid',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unverified Admin Email Spoofing',
    collection: 'office_configs/main_hq',
    operation: 'update',
    auth: { uid: 'spoof_admin', email: 'firmansyahrizki141@gmail.com', email_verified: false },
    payload: {
      radiusMeters: 99999,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'PII Cross-User Read on UserProfile',
    collection: 'users/employee_b',
    operation: 'get',
    auth: { uid: 'employee_a', email: 'a@company.id', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Blanket List Query Scraping on AttendanceLogs',
    collection: 'attendance_logs',
    operation: 'list',
    auth: { uid: 'employee_a', email: 'a@company.id', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Terminal State Bypass on Completed Attendance Shift',
    collection: 'attendance_logs/log_completed',
    operation: 'update',
    auth: { uid: 'user_1', email: 'budi@company.id', email_verified: true },
    payload: {
      status: 'hadir_tepat_waktu',
      notes: 'Reopened shift illegally',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Self-Service Salary Escalation via Profile Update',
    collection: 'users/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'budi@company.id', email_verified: true },
    payload: {
      baseSalary: 999999999,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Resource Exhaustion via Oversized Notes String',
    collection: 'attendance_logs/log_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'budi@company.id', email_verified: true },
    payload: {
      notes: 'A'.repeat(5000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Path ID Poisoning / Mismatched Document ID',
    collection: 'attendance_logs/log_valid_id',
    operation: 'create',
    auth: { uid: 'user_1', email: 'budi@company.id', email_verified: true },
    payload: {
      logId: 'different_id_payload',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Forged Client Timestamp on Check-In',
    collection: 'attendance_logs/log_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'budi@company.id', email_verified: true },
    payload: {
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Immutable Field Mutation on Update',
    collection: 'attendance_logs/log_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'budi@company.id', email_verified: true },
    payload: {
      dateStr: '2025-12-31',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
