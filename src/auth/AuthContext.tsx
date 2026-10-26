import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler } from "@/api/client";
import type { Profile } from "@/api/types";

interface AuthState {
  profile: Profile | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<Profile>;
  loginWithStudentId: (scId: number, studentId: number, password: string) => Promise<Profile>;
  logout: () => Promise<void>;
  refresh: () => Promise<Profile | null>;
  setProfile: (p: Profile) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  // 세션이 끝났을 때(갱신 실패) 화면 상태만 비웁니다. 쿠키는 서버가 이미 지웠습니다.
  const clear = useCallback(() => setProfile(null), []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* 네트워크 오류여도 화면에서는 로그아웃합니다. */ }
    setProfile(null);
  }, []);

  // 자동 로그인: 쿠키가 살아 있으면 /me가 성공하고, 액세스 토큰이 만료됐으면 클라이언트가 리프레시 후 재시도합니다.
  const refresh = useCallback(async () => {
    try {
      const me = await api.get<Profile>("/me");
      setProfile(me);
      return me;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.post("/auth/login", { email, password });
    const me = await api.get<Profile>("/me");
    setProfile(me);
    return me;
  }, []);

  // 임시 계정 로그인 (POST /auth/login/student-id): 학교 + 학번 + 비밀번호
  const loginWithStudentId = useCallback(async (scId: number, studentId: number, password: string) => {
    await api.post("/auth/login/student-id", { scId, studentId, password });
    const me = await api.get<Profile>("/me");
    setProfile(me);
    return me;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    refresh().finally(() => setReady(true));
  }, [clear, refresh]);

  const value = useMemo(() => ({ profile, ready, login, loginWithStudentId, logout, refresh, setProfile }), [profile, ready, login, loginWithStudentId, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function homePath(role: Profile["role"]) {
  return role === "STUDENT" ? "/student" : role === "TEACHER" ? "/teacher" : "/admin";
}
