"use client";

// Camera QR scanning shared by /scan and the inspection round page.
// Uses the browser's BarcodeDetector when it can read QR codes (Chrome/Android); everywhere else
// (Safari on iPhone/iPad, Firefox) frames are decoded with jsQR, loaded only when needed.
import { useEffect, useRef, useState, type RefObject } from "react";

export type QrScannerStatus = "idle" | "starting" | "scanning" | "denied" | "unavailable" | "error";

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
type DetectorConstructor = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

const MAX_FRAME_WIDTH = 720;

/** The camera API exists here (needs HTTPS or localhost). */
export function cameraAvailable() {
  return typeof window !== "undefined" && window.isSecureContext !== false && Boolean(navigator.mediaDevices?.getUserMedia);
}

export type CameraPermission = "granted" | "prompt" | "denied" | "unknown";

/**
 * Current camera permission without prompting. "unknown" when the Permissions API cannot answer
 * (older Safari/Firefox) — callers should then just try to start the camera.
 */
export async function readCameraPermission(): Promise<CameraPermission> {
  try {
    const result = await navigator.permissions?.query({ name: "camera" as PermissionName });
    return result?.state ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Calls `onChange` when the user flips the camera permission in the browser settings (Chrome, Edge, Safari 16+). */
export async function watchCameraPermission(onChange: (state: CameraPermission) => void): Promise<() => void> {
  try {
    const result = await navigator.permissions?.query({ name: "camera" as PermissionName });
    if (!result) return () => {};
    const handler = () => onChange(result.state);
    result.addEventListener("change", handler);
    return () => result.removeEventListener("change", handler);
  } catch {
    return () => {};
  }
}

async function createNativeDetector(): Promise<Detector | null> {
  const Native = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
  if (!Native) return null;
  try {
    const formats = (await Native.getSupportedFormats?.()) ?? ["qr_code"];
    return formats.includes("qr_code") ? new Native({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

async function createJsQrDetector(): Promise<Detector> {
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return {
    async detect(source) {
      const video = source as HTMLVideoElement;
      if (!context || !video.videoWidth) return [];
      const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
      return code?.data ? [{ rawValue: code.data }] : [];
    },
  };
}

function statusForError(error: unknown): QrScannerStatus {
  const name = (error as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") return "unavailable";
  return "error";
}

/**
 * While `active`, streams the rear camera into `videoRef` and calls `onCode` with each decoded QR text.
 * The same code is reported at most once every `repeatMs`. Scanning pauses while the tab is hidden and the
 * camera is always released when `active` turns false or the component unmounts.
 */
export function useQrScanner({
  active,
  videoRef,
  onCode,
  intervalMs = 300,
  repeatMs = 3000,
}: {
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onCode: (text: string) => void;
  intervalMs?: number;
  repeatMs?: number;
}) {
  const [status, setStatus] = useState<QrScannerStatus>("idle");
  const latest = useRef(onCode);
  useEffect(() => {
    latest.current = onCode;
  });

  useEffect(() => {
    if (!active) {
      setStatus("idle"); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let last = { text: "", at: 0 };
    const videoElement = videoRef.current;

    (async () => {
      if (!cameraAvailable()) {
        setStatus("unavailable");
        return;
      }
      setStatus("starting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        const video = videoRef.current;
        if (cancelled || !video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
        const detector = (await createNativeDetector()) ?? (await createJsQrDetector());
        if (cancelled) return;
        setStatus("scanning");
        const tick = async () => {
          if (cancelled) return;
          if (!document.hidden && videoRef.current && videoRef.current.readyState >= 2) {
            const codes = await detector.detect(videoRef.current).catch(() => []);
            const text = codes.find((code) => code.rawValue)?.rawValue;
            const now = Date.now();
            if (text && !(text === last.text && now - last.at < repeatMs)) {
              last = { text, at: now };
              latest.current(text);
            }
          }
          if (!cancelled) timer = window.setTimeout(tick, intervalMs);
        };
        void tick();
      } catch (error) {
        if (!cancelled) setStatus(statusForError(error));
      }
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoElement) videoElement.srcObject = null;
    };
  }, [active, videoRef, intervalMs, repeatMs]);

  return status;
}

export const QR_SCANNER_MESSAGES: Partial<Record<QrScannerStatus, string>> = {
  starting: "กำลังเปิดกล้อง…",
  denied: "ไม่ได้รับอนุญาตให้ใช้กล้อง — อนุญาตกล้องให้เว็บไซต์นี้ตามขั้นตอนด้านล่าง แล้วกด “ลองอีกครั้ง”",
  unavailable: "อุปกรณ์หรือเบราว์เซอร์นี้เปิดกล้องไม่ได้ (ต้องเข้าผ่าน https) — ใช้แอปกล้องของโทรศัพท์สแกนสติ๊กเกอร์ หรือพิมพ์เลขครุภัณฑ์แทน",
  error: "เปิดกล้องไม่สำเร็จ ลองใหม่อีกครั้ง หรือใช้แอปกล้องของโทรศัพท์สแกนแทน",
};
