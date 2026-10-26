// *
// 서비스 운영 정보 (푸터·고객지원)
// 문의는 이메일로 받습니다(기본 min0x08@naver.com, VITE_SUPPORT_EMAIL로 변경). 정해지지 않은 연락처·약관 페이지는 만들지 않고 '준비 중'으로 표시합니다.
// 정식 공개 때 frontend/.env.* 에 VITE_SUPPORT_EMAIL, VITE_TERMS_URL 등을 넣으면 바로 연결됩니다.
// *
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

export const SERVICE = {
  name: "출결플러스",
  enName: "ATTEND PLUS",
  tagline: "교실 배치도와 시간표로 학생마다 수업 교실을 판단하고, 출결을 담당 선생님께 자동으로 전달하는 학교 출결 서비스",
  support: {
    email: clean(import.meta.env.VITE_SUPPORT_EMAIL) ?? "min0x08@naver.com",   // 문의는 이메일로 (기본 주소)
    phone: clean(import.meta.env.VITE_SUPPORT_PHONE),
    hours: clean(import.meta.env.VITE_SUPPORT_HOURS),
  },
  policy: {
    terms: clean(import.meta.env.VITE_TERMS_URL),
    privacy: clean(import.meta.env.VITE_PRIVACY_URL),
  },
  operator: {
    name: clean(import.meta.env.VITE_OPERATOR_NAME),
    info: clean(import.meta.env.VITE_OPERATOR_INFO),   // 예: 사업자등록번호·주소 (한 줄)
  },
} as const;
