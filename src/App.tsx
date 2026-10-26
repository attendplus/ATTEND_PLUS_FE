import { motion } from "framer-motion";
import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import type { Role } from "@/api/types";
import { homePath, useAuth } from "@/auth/AuthContext";
import AppShell from "@/layout/AppShell";
import { RequireSubscription } from "@/billing/SubscriptionGate";
import Landing from "@/pages/Landing";

// 화면별 코드 분할: 랜딩·로그인 첫 화면에는 로그인 후 화면(차트·QR 스캐너 등) 코드를 내려받지 않습니다.
const ChangePassword = lazy(() => import("@/pages/auth/ChangePassword"));
const FindPassword = lazy(() => import("@/pages/auth/FindPassword"));
const Login = lazy(() => import("@/pages/auth/Login"));
const Signup = lazy(() => import("@/pages/auth/Signup"));
const Profile = lazy(() => import("@/pages/common/Profile"));
const Timetable = lazy(() => import("@/pages/common/Timetable"));
const StudentDashboard = lazy(() => import("@/pages/student/Dashboard"));
const StudentHistory = lazy(() => import("@/pages/student/History"));
const TeacherBoard = lazy(() => import("@/pages/teacher/Board"));
const ClassSettings = lazy(() => import("@/pages/teacher/ClassSettings"));
const JoinClass = lazy(() => import("@/pages/teacher/JoinClass"));
const TeacherMembers = lazy(() => import("@/pages/teacher/Members"));
const TeacherQr = lazy(() => import("@/pages/teacher/Qr"));
const TeacherElectives = lazy(() => import("@/pages/teacher/Electives"));
const TeacherSchedules = lazy(() => import("@/pages/teacher/Schedules"));
const TeacherStats = lazy(() => import("@/pages/teacher/Stats"));
const TeacherLessons = lazy(() => import("@/pages/teacher/Lessons"));
const AdminSubjectSpaces = lazy(() => import("@/pages/admin/SubjectSpaces"));
const AdminElectives = lazy(() => import("@/pages/admin/Electives"));
const AdminClasses = lazy(() => import("@/pages/admin/Classes"));
const AdminLayout = lazy(() => import("@/pages/admin/Layout"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminSchedules = lazy(() => import("@/pages/admin/Schedules"));
const AdminSchool = lazy(() => import("@/pages/admin/School"));
const AdminBilling = lazy(() => import("@/pages/admin/Billing"));
const AdminSubscription = lazy(() => import("@/pages/admin/Subscription"));
const AdminTeachers = lazy(() => import("@/pages/admin/Teachers"));
const AdminTimetableSync = lazy(() => import("@/pages/admin/TimetableSync"));

function Splash() {
  return (
    <div className="mesh-bg grid min-h-screen place-items-center">
      <motion.img src="/logo-160.png" alt="출결플러스" className="h-20 w-20" initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [1, 1.06, 1], opacity: 1 }} transition={{ scale: { duration: 1.2, repeat: Infinity }, opacity: { duration: 0.3 } }} />
    </div>
  );
}

function RequireAuth({ roles }: { roles?: Role[] }) {
  const { profile, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Splash />;
  if (!profile) return <Navigate to="/login" replace state={{ from: location }} />;
  if (profile.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to={homePath(profile.role)} replace />;
  return <Outlet />;
}

// 비활성 교사는 출결 보관(조회·처리) 화면만 사용할 수 있습니다. 서버도 같은 기능을 403으로 막습니다.
function RequireActive() {
  const { profile } = useAuth();
  if (profile && !profile.active) return <Navigate to={homePath(profile.role)} replace />;
  return <Outlet />;
}

function GuestOnly() {
  const { profile, ready } = useAuth();
  if (!ready) return <Splash />;
  if (profile) return <Navigate to={profile.mustChangePassword ? "/change-password" : homePath(profile.role)} replace />;
  return <Outlet />;
}

function Home() {
  const { profile, ready } = useAuth();
  if (!ready) return <Splash />;
  // 로그인 전에는 랜딩 페이지, 로그인 후에는 역할별 첫 화면
  return profile ? <Navigate to={homePath(profile.role)} replace /> : <Landing />;
}

export default function App() {
  const { profile } = useAuth();
  return (
    <Suspense fallback={<Splash />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/find-password" element={<FindPassword />} />
      </Route>
      <Route path="/change-password" element={profile ? <ChangePassword /> : <Navigate to="/login" replace />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/profile" element={<Profile />} />
          <Route element={<RequireSubscription />}>
            <Route path="/timetable" element={<Timetable />} />
          </Route>
          <Route element={<RequireAuth roles={["STUDENT"]} />}>
            {/* 오늘 출석은 학급 가입(구독 없이 가능)을 함께 다루므로 화면 안에서 구독을 확인 */}
            <Route path="/student" element={<StudentDashboard />} />
            <Route element={<RequireSubscription />}>
              <Route path="/student/history" element={<StudentHistory />} />
            </Route>
          </Route>
          <Route element={<RequireAuth roles={["TEACHER"]} />}>
            <Route element={<RequireSubscription />}>
              <Route path="/teacher" element={<TeacherBoard />} />
              <Route path="/teacher/stats" element={<TeacherStats />} />
              <Route path="/teacher/lessons" element={<TeacherLessons />} />
              <Route path="/teacher/members" element={<TeacherMembers />} />
              <Route path="/teacher/schedules" element={<TeacherSchedules />} />
              <Route element={<RequireActive />}>
                <Route path="/teacher/join" element={<JoinClass />} />
                <Route path="/teacher/qr" element={<TeacherQr />} />
                <Route path="/teacher/electives" element={<TeacherElectives />} />
                <Route path="/teacher/class" element={<ClassSettings />} />
              </Route>
            </Route>
          </Route>
          <Route element={<RequireAuth roles={["SCHOOL_ADMIN"]} />}>
            {/* 관리자 기능은 학교 구독이 있어야 열립니다. 구독 전에는 화면 대신 결제 안내(잠금)가 보여요. 서버도 같은 조건으로 막습니다. */}
            <Route element={<RequireSubscription />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/teachers" element={<AdminTeachers />} />
              <Route path="/admin/classes" element={<AdminClasses />} />
              <Route path="/admin/timetable" element={<AdminTimetableSync />} />
              <Route path="/admin/electives" element={<AdminElectives />} />
              <Route path="/admin/schedules" element={<AdminSchedules />} />
              <Route path="/admin/school" element={<AdminSchool />} />
            </Route>
            {/* GPS 출결용 기능은 QR + GPS 요금제 */}
            <Route element={<RequireSubscription gps />}>
              <Route path="/admin/layout" element={<AdminLayout />} />
              <Route path="/admin/subject-spaces" element={<AdminSubjectSpaces />} />
            </Route>
            {/* 구독 없이도 열림: 요금제 · 결제, 구독 관리 (미구독·미납 학교도 결제·상태 확인·출결 기록 확보 가능) */}
            <Route path="/admin/billing" element={<AdminBilling />} />
            <Route path="/admin/subscription" element={<AdminSubscription />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
    </Suspense>
  );
}
