import { MotionConfig } from "framer-motion";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* 운영체제의 '동작 줄이기' 설정을 따릅니다. */}
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "inherit", borderRadius: 14 } }} />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
