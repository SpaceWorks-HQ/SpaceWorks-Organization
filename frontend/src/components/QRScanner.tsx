import { useEffect, useRef } from "react";

/**
 * Extracts a card UUID from scanned QR text.
 * Handles raw UUIDs and /members/:id or /verify/:id URLs.
 */
export function extractCardId(text: string): string | null {
  const urlMatch = text.match(
    /\/(?:members|verify)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  if (urlMatch) return urlMatch[1];

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRe.test(text.trim())) return text.trim();

  return null;
}

type DetectedCode = { rawValue: string };

type DetectorFn = (source: HTMLVideoElement) => Promise<DetectedCode[]>;

declare global {
  interface Window {
    BarcodeDetector?: new (options?: {
      formats?: string[];
    }) => {
      detect: (source: ImageBitmapSource) => Promise<DetectedCode[]>;
    };
  }

  // Chromium also exposes BarcodeDetector as a global constructor.
  // eslint-disable-next-line no-var
  var BarcodeDetector:
    | (new (options?: { formats?: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<DetectedCode[]>;
        getSupportedFormats?: () => Promise<string[]>;
      })
    | undefined;
}

async function makeDetector(): Promise<DetectorFn> {
  const BarcodeDetectorCtor =
    typeof window !== "undefined"
      ? window.BarcodeDetector ?? globalThis.BarcodeDetector
      : undefined;

  if (BarcodeDetectorCtor) {
    try {
      const getFormats = (
        BarcodeDetectorCtor as unknown as {
          getSupportedFormats?: () => Promise<string[]>;
        }
      ).getSupportedFormats;

      const formats = getFormats ? await getFormats.call(BarcodeDetectorCtor) : ["qr_code"];
      if (formats.includes("qr_code")) {
        const native = new BarcodeDetectorCtor({ formats: ["qr_code"] });
        return (source) => native.detect(source);
      }
    } catch {
      // Fall through to zxing-wasm
    }
  }

  // Default zxing-wasm reader loads WASM from the package CDN.
  const { readBarcodes } = await import("zxing-wasm/reader");

  return async (source) => {
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth || 640;
    canvas.height = source.videoHeight || 480;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const results = await readBarcodes(imageData, { formats: ["QRCode"] });
    return results.map((r) => ({ rawValue: r.text }));
  };
}

export type QRScannerProps = {
  onScan: (cardId: string) => void;
  onError?: (msg: string) => void;
  active: boolean;
};

/**
 * QRScanner — camera-based QR code reader.
 * Uses native BarcodeDetector when available, else zxing-wasm.
 */
export default function QRScanner({ onScan, onError, active }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScannedRef = useRef<{ id: string | null; at: number }>({
    id: null,
    at: 0,
  });
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  onScanRef.current = onScan;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let detect: DetectorFn | null = null;

    const handleDecoded = (decodedText: string) => {
      const cardId = extractCardId(decodedText);
      if (!cardId) {
        onErrorRef.current?.("Invalid QR code — not a Space Works card.");
        return;
      }
      const now = Date.now();
      if (
        lastScannedRef.current.id === cardId &&
        now - lastScannedRef.current.at < 3000
      ) {
        return;
      }
      lastScannedRef.current = { id: cardId, at: now };
      onScanRef.current(cardId);
    };

    const tick = async () => {
      if (cancelled || !detect || !videoRef.current) return;
      try {
        if (videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const codes = await detect(videoRef.current);
          if (!cancelled && codes.length > 0 && codes[0]?.rawValue) {
            handleDecoded(codes[0].rawValue);
          }
        }
      } catch {
        // Per-frame decode failures are expected — ignore silently
      }
      if (!cancelled) {
        timer = setTimeout(tick, 200);
      }
    };

    (async () => {
      try {
        detect = await makeDetector();
        if (cancelled) return;

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (!cancelled) tick();
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Unable to access camera";
          onErrorRef.current?.(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-white">
      <video
        ref={videoRef}
        className="w-full aspect-square object-cover bg-black"
        muted
        playsInline
        autoPlay
      />
      <p className="text-xs text-center text-slate-400 py-2">
        Point the camera at a member&apos;s ID card QR code
      </p>
    </div>
  );
}
