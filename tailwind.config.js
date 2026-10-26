/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard Variable", "Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
      },
      // 서비스 메인 색상: #2B5793 (brand-500)
      colors: {
        ink: { 950: "#0B1020", 900: "#111827", 800: "#1F2937", 700: "#374151", 600: "#4B5563", 500: "#6B7280", 400: "#9CA3AF", 300: "#D1D5DB", 200: "#E5E7EB", 100: "#F1F3F8", 50: "#F7F8FC" },
        brand: { 50: "#EEF3F9", 100: "#DDE7F3", 200: "#BCCFE6", 300: "#91AFD4", 400: "#5F87BD", 500: "#2B5793", 600: "#254C82", 700: "#1F406D", 800: "#1A3558", 900: "#142944" },
        mint: { 50: "#E9FBF4", 500: "#12B886", 600: "#0CA678" },
        amber: { 50: "#FFF7E6", 500: "#F59F00", 600: "#E8590C" },
        rose: { 50: "#FFF0F3", 500: "#F03E3E", 600: "#E03131" },
        sky: { 50: "#E7F5FF", 500: "#228BE6" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.12)",
        lift: "0 12px 28px -14px rgba(43,87,147,.45)",
        glow: "0 0 0 4px rgba(43,87,147,.14)",
      },
      borderRadius: { xl2: "1.25rem" },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },   // 랜딩 연동 띠 (목록을 두 번 이어 붙여 끊김 없이 흐름)
      },
      animation: { shimmer: "shimmer 1.6s infinite", float: "float 6s ease-in-out infinite", marquee: "marquee 38s linear infinite" },
    },
  },
  plugins: [],
};
