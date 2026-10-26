// *
// 결제 대행사(PG) 데모 샌드박스 — 카드·계좌 등록 화면 뒤에서 결제 대행사 역할을 흉내 냅니다.
//
// 실제 연동 때 이 파일만 결제 대행사 SDK(카드 등록창·계좌 자동이체 동의창)로 바꾸면 됩니다.
//   1) 화면은 대행사 SDK를 열어 카드번호·유효기간·CVC·비밀번호 앞 2자리·생년월일(사업자번호)·계좌번호를 대행사에 직접 입력
//   2) 대행사가 인증 키(authKey)를 돌려주면 → POST /admin/billing/payment-instruments 로 전달
//   3) 서버가 대행사에 빌링키를 발급받아 저장 (현재 서버는 실제 토큰이면 PG_NOT_CONNECTED로 거부)
//
// 지금(데모): 입력값 검사와 토큰 발급을 브라우저 안에서만 흉내 냅니다.
//   - 카드번호·CVC·계좌번호 등 원본 값은 출결플러스 서버로 보내지 않고, sim_ 토큰과 표시용 정보(브랜드·은행, 끝 4자리)만 보냅니다.
//   - 실제 카드 승인·계좌 출금·인증 문자 발송은 일어나지 않습니다.
// *
export type HolderType = "PERSONAL" | "CORPORATE";
export type CardBrand = "VISA" | "MASTERCARD" | "AMEX" | "JCB" | "UNIONPAY" | "DOMESTIC";
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export const digits = (v: string) => v.replace(/\D/g, "");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randomHex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n / 2)), (b) => b.toString(16).padStart(2, "0")).join("");

export function detectBrand(num: string): CardBrand {
  const d = digits(num);
  const p2 = Number(d.slice(0, 2)), p4 = Number(d.slice(0, 4));
  if (d.startsWith("4")) return "VISA";
  if ((p2 >= 51 && p2 <= 55) || (p4 >= 2221 && p4 <= 2720)) return "MASTERCARD";
  if (p2 === 34 || p2 === 37) return "AMEX";
  if (p4 >= 3528 && p4 <= 3589) return "JCB";
  if (p2 === 62) return "UNIONPAY";
  return "DOMESTIC";
}
export const BRAND_LABEL: Record<CardBrand, string> = { VISA: "VISA", MASTERCARD: "Mastercard", AMEX: "AMEX", JCB: "JCB", UNIONPAY: "UnionPay", DOMESTIC: "국내 카드" };

// 카드번호 표시 형식: AMEX 4-6-5, 그 외 4자리씩
export function formatCardNumber(v: string) {
  const d = digits(v).slice(0, 19);
  if (detectBrand(d) === "AMEX") return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
}
export function formatExpiry(v: string) {
  const d = digits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function luhn(d: string) {
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

function validBirth(v: string) {
  if (!/^\d{6}$/.test(v)) return false;
  const m = Number(v.slice(2, 4)), day = Number(v.slice(4, 6));
  return m >= 1 && m <= 12 && day >= 1 && day <= new Date(2000 + Number(v.slice(0, 2)), m, 0).getDate();
}

// 사업자등록번호 검증 (국세청 체크섬)
function validBusinessNo(v: string) {
  if (!/^\d{10}$/.test(v)) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = w.reduce((s, x, i) => s + Number(v[i]) * x, 0);
  sum += Math.floor((Number(v[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(v[9]);
}

function holderError(type: HolderType, id: string) {
  if (!id) return type === "PERSONAL" ? "생년월일 6자리를 입력해 주세요." : "사업자등록번호 10자리를 입력해 주세요.";
  if (type === "PERSONAL" && !validBirth(id)) return "생년월일을 YYMMDD 형식으로 정확히 입력해 주세요.";
  if (type === "CORPORATE" && !validBusinessNo(id)) return "사업자등록번호가 올바르지 않아요. 번호를 다시 확인해 주세요.";
  return undefined;
}

// ── 신용카드 ──────────────────────────────────────────────────────────
export interface CardInput { number: string; expiry: string; cvc: string; password2: string; holderType: HolderType; holderId: string; agreed: boolean }
export type CardField = keyof CardInput;

export function validateCard(c: CardInput, now = new Date()): FieldErrors<CardField> {
  const e: FieldErrors<CardField> = {};
  const num = digits(c.number);
  const amex = detectBrand(num) === "AMEX";
  if (!num) e.number = "카드번호를 입력해 주세요.";
  else if (num.length < (amex ? 15 : 14) || num.length > (amex ? 15 : 19)) e.number = "카드번호 자릿수가 맞지 않아요.";
  else if (!luhn(num)) e.number = "유효하지 않은 카드번호예요. 번호를 다시 확인해 주세요.";
  const exp = digits(c.expiry);
  if (exp.length !== 4) e.expiry = "유효기간을 MM/YY 형식으로 입력해 주세요.";
  else {
    const m = Number(exp.slice(0, 2)), y = 2000 + Number(exp.slice(2));
    const endOfMonth = new Date(y, m, 0, 23, 59, 59);
    if (m < 1 || m > 12) e.expiry = "유효기간의 월(MM)이 올바르지 않아요.";
    else if (endOfMonth < now) e.expiry = "유효기간이 지난 카드예요.";
    else if (y > now.getFullYear() + 20) e.expiry = "유효기간을 다시 확인해 주세요.";
  }
  if (!new RegExp(`^\\d{${amex ? 4 : 3}}$`).test(c.cvc)) e.cvc = amex ? "AMEX는 카드 앞면의 4자리를 입력해 주세요." : "카드 뒷면의 CVC 3자리를 입력해 주세요.";
  if (!/^\d{2}$/.test(c.password2)) e.password2 = "카드 비밀번호 앞 2자리를 입력해 주세요.";
  const h = holderError(c.holderType, c.holderId);
  if (h) e.holderId = h;
  if (!c.agreed) e.agreed = "정기 결제를 위한 카드 등록에 동의해 주세요.";
  return e;
}

export interface Tokenized { token: string; last4: string; holderType: HolderType; brand?: CardBrand; bank?: string }

export async function tokenizeCard(c: CardInput): Promise<Tokenized> {
  const errors = validateCard(c);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  await wait(700);   // 대행사 카드사 인증 시간 흉내
  const num = digits(c.number);
  return { token: `sim_card_${randomHex(24)}`, last4: num.slice(-4), brand: detectBrand(num), holderType: c.holderType };
}

// ── 계좌이체 (자동이체 출금 동의) ───────────────────────────────────────
// 등록 전 본인 인증은 관리자 등록 이메일로 서버가 확인합니다. (EmailVerification.tsx)
export interface BankInput { bank: string; account: string; holderName: string; holderType: HolderType; holderId: string; agreed: boolean }

export type BankField = keyof BankInput;

export function validateBank(b: BankInput): FieldErrors<BankField> {
  const e: FieldErrors<BankField> = {};
  const acc = digits(b.account);
  if (!b.bank) e.bank = "은행을 선택해 주세요.";
  if (!acc) e.account = "계좌번호를 입력해 주세요.";
  else if (acc.length < 10 || acc.length > 14) e.account = "계좌번호는 숫자 10~14자리예요. 하이픈(-)은 빼도 돼요.";
  if (b.holderName.trim().length < 2) e.holderName = "예금주명을 입력해 주세요.";
  const h = holderError(b.holderType, b.holderId);
  if (h) e.holderId = h;
  if (!b.agreed) e.agreed = "자동이체 출금 동의가 필요해요.";
  return e;
}

export async function tokenizeBank(b: BankInput): Promise<Tokenized> {
  const errors = validateBank(b);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  await wait(600);   // 대행사 계좌 실명 확인 시간 흉내
  return { token: `sim_bank_${randomHex(24)}`, last4: digits(b.account).slice(-4), bank: b.bank, holderType: b.holderType };
}
