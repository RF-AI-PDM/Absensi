# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Global Default-Deny Safety Net**: Every unmatched path is strictly denied (`allow read, write: if false;`).
2. **Verified Authentication**: All standard mutations and queries require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **PII Isolation & Zero Blanket Reads (`users/{userId}`)**:
   - Contains employee PII (`email`, `name`, `baseSalary`, `twoFactorSecret`).
   - `get` and `list` are strictly restricted to the document owner (`request.auth.uid == userId` / `resource.data.uid == request.auth.uid`) or verified `isAdmin()`.
   - Users can never self-assign admin privileges; admin status is determined strictly via `admins/{uid}` or verified bootstrapped admin email (`firmansyahrizki141@gmail.com`).
4. **Relational Existence & Ownership (`attendance_logs/{logId}`)**:
   - On creation, `incoming().userId == request.auth.uid`, `incoming().logId == logId`, and the user profile `users/$(incoming().userId)` MUST exist.
   - Once `status == 'selesai_shift'`, the attendance log is in a terminal state and cannot be modified by non-admins.
5. **Relational Existence & Terminal State (`attendance_reminders/{reminderId}`)**:
   - On creation, `incoming().senderUid == request.auth.uid`, `incoming().reminderId == reminderId`, and `users/$(incoming().targetUserId)` MUST exist.
   - Once `status == 'acknowledged'`, the reminder is in a terminal state.
6. **Admin-Controlled Payroll & Terminal State (`payroll_records/{payrollId}`)**:
   - On creation, `incoming().generatedByUid == request.auth.uid`, `incoming().payrollId == payrollId`, and `users/$(incoming().userId)` MUST exist.
   - Once `status == 'paid'`, the payroll record reaches a terminal state and is locked against non-admin updates.
7. **Temporal Integrity**:
   - Every `create` enforces `incoming().createdAt == request.time && incoming().updatedAt == request.time`.
   - Every `update` enforces `incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time`.

---

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection on User Profile (`users/{userId}`)**:
   ```json
   {
     "uid": "user_1",
     "name": "Budi Santoso",
     "email": "budi@company.id",
     "department": "Engineering",
     "position": "Backend Engineer",
     "employeeCode": "EMP-001",
     "baseSalary": 12000000,
     "dailyAllowance": 100000,
     "latePenaltyRate": 50000,
     "twoFactorEnabled": false,
     "twoFactorSecret": "",
     "shiftStart": "08:30",
     "shiftEnd": "17:30",
     "isAdmin": true
   }
   ```
   *Expected*: `PERMISSION_DENIED` (blocked by `hasOnly`).

2. **Identity Spoofing on Attendance Check-In (`attendance_logs/{logId}`)**:
   Authenticated as `attacker_uid`, attempting to log attendance with `"userId": "victim_uid"`.
   *Expected*: `PERMISSION_DENIED` (blocked by `data.userId == request.auth.uid`).

3. **Orphaned Attendance Creation (`attendance_logs/{logId}`)**:
   Authenticated as `ghost_uid` who has no document in `/users/ghost_uid`.
   *Expected*: `PERMISSION_DENIED` (blocked by `exists(/databases/$(database)/documents/users/$(incoming().userId))`).

4. **Unverified Admin Email Spoofing**:
   Authenticated with `email: "firmansyahrizki141@gmail.com"` but `email_verified: false`.
   *Expected*: `PERMISSION_DENIED` (blocked by `request.auth.token.email_verified == true`).

5. **PII Cross-User Read (`users/{otherUserId}`)**:
   Authenticated as `employee_a`, calling `get` on `/users/employee_b`.
   *Expected*: `PERMISSION_DENIED` (blocked by `request.auth.uid == userId || isAdmin()`).

6. **Blanket List Query Scraping (`attendance_logs`)**:
   Authenticated as non-admin `employee_a`, running an unconstrained `list` across all employees' `attendance_logs`.
   *Expected*: `PERMISSION_DENIED` (blocked by `resource.data.userId == request.auth.uid || isAdmin()`).

7. **Terminal State Bypass on Attendance (`attendance_logs/{logId}`)**:
   Attempting to update `checkOutTime` or `notes` on a log where `existing().status == 'selesai_shift'` as a regular employee.
   *Expected*: `PERMISSION_DENIED` (blocked by terminal state lock `existing().status != 'selesai_shift'`).

8. **Salary Escalation via Profile Update (`users/{userId}`)**:
   Regular employee attempting to update `baseSalary` from `8000000` to `99000000` on their own profile.
   *Expected*: `PERMISSION_DENIED` (employee update action only permits `['name', 'department', 'position', 'twoFactorEnabled', 'twoFactorSecret', 'shiftStart', 'shiftEnd', 'updatedAt']`, locking financial fields to admin).

9. **Resource Exhaustion / Oversized String (`attendance_logs/{logId}`)**:
   Sending a 5,000-character string in `notes` (limit 300).
   *Expected*: `PERMISSION_DENIED` (blocked by `data.notes.size() <= 300`).

10. **Path ID Poisoning (`attendance_logs/{logId}`)**:
    Creating a document with invalid characters or >128 chars in `{logId}` or mismatching `incoming().logId != logId`.
    *Expected*: `PERMISSION_DENIED` (blocked by `isValidId(logId)` and `incoming().logId == logId`).

11. **Forged Client Timestamp (`attendance_logs/{logId}`)**:
    Creating an attendance record with a backdated `createdAt` timestamp not equal to `request.time`.
    *Expected*: `PERMISSION_DENIED` (blocked by `incoming().createdAt == request.time`).

12. **Immutable Field Mutation (`attendance_logs/{logId}`)**:
    Updating an attendance record and changing `createdAt` or `dateStr`.
    *Expected*: `PERMISSION_DENIED` (blocked by `incoming().createdAt == existing().createdAt` and `affectedKeys().hasOnly(...)`).
