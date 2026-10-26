export type Role = "STUDENT" | "TEACHER" | "SCHOOL_ADMIN";
export type Gender = "MALE" | "FEMALE";
export type AttStatus = "PRESENT" | "ABSENT" | "LATE" | "EARLY_LEAVE" | "PENDING";

export interface ClassSummary {
  clsId: number; schoolYear: number; grade: number; number: number; label: string; isActive: boolean;
  teacherName?: string | null; classroomName?: string | null;
  membershipStatus?: "PENDING" | "APPROVED" | "REJECTED" | "LEFT" | "KICKED" | null; studentId?: number | null; studentNumber?: number | null;
}

export interface Profile {
  usId: number; role: Role; name: string; email: string; gender: Gender; isForeign: boolean;
  profileImageUrl: string | null; active: boolean; deactivateReason?: string | null; employmentStatus?: string | null;
  mustChangePassword: boolean; alarmEnabled: boolean;
  isTempAccount?: boolean;   // 담임이 만든 학번 로그인 계정 (email은 빈 값)
  school: { scId: number; name: string; address?: string | null; accessCodeMasked?: string | null };
  schoolClass?: ClassSummary | null; createdAt?: string;
}

export interface Attendance {
  attId: number; date: string; perNo: number; status: AttStatus; statusLabel: string; method: "GPS" | "QR" | "MANUAL";
  methodLabel: string; isConfirmed: boolean; checkedAt: string | null; receivedAt?: string | null; reasonType?: string | null; reasonTypeLabel?: string | null; reason?: string | null;
  // checkedAt: 출석 확인 시각(판정 기준) · receivedAt: 서버 수신 시각 (전송이 늦으면 확인 시각보다 늦음)
  // 수업 유형과 출결 담당 교사 (HOMEROOM: 담임, MOVING: 이동수업 교사)
  lessonType?: "HOMEROOM" | "MOVING" | null; lessonSubject?: string | null; lessonRoom?: string | null; lessonTeacherName?: string | null; ownerUsId?: number | null;
}

export interface Summary {
  present: number; late: number; absent: number; earlyLeave: number; pending: number; total: number;
  confirmed: number; unconfirmed: number; gps: number; qr: number; manual: number; rate: number;
}

export interface WeekTimetable {
  // 기준일(weekStart)부터 일주일(weekEnd까지 7일). days는 그중 수업일(월~금)
  weekStart: string;
  weekEnd: string;
  days: string[];
  periods: { perNo: number; start: string; end: string }[];
  cells: {
    date: string; weekday: number; perNo: number; subject?: string | null; classroom?: string | null; teacher?: string | null;
    classLabel?: string | null; isChanged: boolean; isMoving: boolean; groupLabel?: string | null; special?: string | null;
  }[];
}

export interface Notification {
  notiId: number; type: "LATE" | "QR" | "SUMMARY"; title: string; body: string | null; refDate: string | null; sentAt: string; readAt: string | null;
}

export interface Homeroom {
  clsId: number; schoolYear: number; grade: number; number: number; label: string; description: string | null; isActive: boolean;
  accessCode: string; teacherUsId: number | null; teacherName: string | null; clrId: number | null; classroomName: string | null;
  studentCount: number; pendingCount: number;
  deactivatedAt?: string | null;   // 비활성화 시각 (비활성 학급) — 학생 소속·출결 기록은 그대로 보관
}

export interface ScheduleItem {
  schId: number; scope: "SCHOOL" | "GRADE" | "CLASS" | "STUDENT"; scopeLabel: string; title: string; reason: string | null; note: string | null;
  grade: number | null; date: string | null; allDay: boolean; perNos: number[]; students: { usId: number; name: string }[];
  createdBy: string | null; editable: boolean; isEnded: boolean;
  // 서버가 시작·종료 일시(KST)와 현재 시각으로 판별한 상태
  status: "UPCOMING" | "ONGOING" | "ENDED"; statusLabel: string; startAt: string | null; endAt: string | null;
}

