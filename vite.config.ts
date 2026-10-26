import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// 백엔드(FastAPI, :8000)로 API/정적 파일 요청을 프록시합니다.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        // 라이브러리별 청크. 차트(recharts·d3)는 통계 화면에서만 쓰므로 첫 화면(랜딩·로그인)에서 내려받지 않도록
        // 그 패키지 파일만 charts로 묶습니다. (객체 형식은 clsx 같은 공용 의존성까지 charts로 끌어가 첫 화면이 의존하게 됨)
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(recharts|d3-|victory-vendor|recharts-scale|decimal\.js-light|lodash|react-smooth|eventemitter3|fast-equals|internmap)/.test(id)) return "charts";
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//.test(id)) return "react";
          if (/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return "motion";
          if (/node_modules\/(jsqr|qrcode\.react)\//.test(id)) return "qr";   // QR 표시·스캔 화면에서만 사용
          return "vendor";   // clsx·아이콘·토스트 등 첫 화면에서도 쓰는 공용 의존성
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/static": "http://localhost:8000",
      "/files": "http://localhost:8000",
    },
  },
});
