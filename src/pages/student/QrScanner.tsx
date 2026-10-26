import { motion } from "framer-motion";
import jsQR from "jsqr";
import { CameraOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// 카메라로 QR 코드를 스캔합니다. (jsQR로 프레임 디코딩)
export default function QrScanner({ onDetect, paused }: { onDetect: (text: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const detectedRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  if (!paused) detectedRef.current = false;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setError("이 브라우저에서는 카메라를 사용할 수 없습니다.");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        return setError("카메라 권한을 허용해주세요.");
      }
      if (stopped || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
      const tick = () => {
        const video = videoRef.current, canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !pausedRef.current && !detectedRef.current) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code?.data) { detectedRef.current = true; onDetect(code.data); }
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    start();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onDetect]);

  if (error) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-3xl bg-ink-950 text-center text-white">
        <div><CameraOff className="mx-auto mb-3 h-8 w-8 text-ink-400" /><div className="text-[14px] font-semibold">{error}</div></div>
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-ink-950">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative h-[64%] w-[64%]">
          {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
            <span key={c} className={`absolute h-10 w-10 border-white ${c}`} />
          ))}
          <motion.div className="absolute inset-x-2 h-0.5 rounded-full bg-gradient-to-r from-transparent via-mint-500 to-transparent shadow-[0_0_16px_#12B886]"
            animate={{ top: ["6%", "94%", "6%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-4 text-center text-[13px] font-semibold text-white/90">교실 화면의 QR 코드를 사각형 안에 맞춰주세요</div>
    </div>
  );
}
