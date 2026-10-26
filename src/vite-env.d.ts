/// <reference types="vite/client" />

// 서비스 운영 정보 (frontend/.env.local 등에서 설정, 비워 두면 '준비 중'으로 표시). 요금제 가격은 서버 공통 설정(GET /admin/billing/plans)
interface ImportMetaEnv {
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_SUPPORT_PHONE?: string;
  readonly VITE_SUPPORT_HOURS?: string;
  readonly VITE_TERMS_URL?: string;
  readonly VITE_PRIVACY_URL?: string;
  readonly VITE_OPERATOR_NAME?: string;
  readonly VITE_OPERATOR_INFO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
