import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";

// 비동기 데이터 로딩 훅 (loading / error / reload)
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  // 날짜·주·반을 빠르게 바꾸면 응답이 요청 순서와 다르게 올 수 있습니다. 마지막 요청의 응답만 화면에 반영하고,
  // 화면을 떠난 뒤 도착한 응답은 버립니다. (언마운트 후 상태 갱신 방지)
  const seq = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const reload = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const result = await fnRef.current();
      if (id !== seq.current || !alive.current) return result;
      setData(result);
      setError(null);
      return result;
    } catch (e) {
      if (id === seq.current && alive.current) setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", "알 수 없는 오류가 발생했습니다.", -1));
      return null;
    } finally {
      if (id === seq.current && alive.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { data, error, loading, reload, setData };
}

// 요청 실행 + 토스트 메시지 처리
export function useAction() {
  const [pending, setPending] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setPending(true);
    try {
      const result = await fn();
      if (success) toast.success(success);
      return result;
    } catch (e) {
      // 연결·서버 오류는 해결 방법을 함께 안내합니다. (업무 규칙 오류는 서버 메시지 자체가 안내)
      const hint = e instanceof ApiError && (e.status === 0 || e.status >= 500)
        ? (e.status === 0 ? "인터넷 연결을 확인한 뒤 다시 시도해 주세요." : "잠시 후 다시 시도해 주세요. 계속되면 서비스 관리자에게 문의해 주세요.") : undefined;
      toast.error(e instanceof ApiError ? e.message : "요청을 처리하지 못했습니다.", hint ? { description: hint } : undefined);
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);
  return { run, pending };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// 브라우저 Geolocation 1회 측정 (고정밀)
export function measurePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("이 기기에서는 위치 정보를 사용할 수 없습니다."));
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      reject(new Error(err.code === err.PERMISSION_DENIED ? "위치 권한을 항상 허용해주세요." : "GPS 위치를 확인할 수 없습니다."));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}
