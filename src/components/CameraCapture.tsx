import { useState, useRef, useEffect } from "react";
import { Camera, X, RefreshCw, AlertCircle, Sparkles } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  title?: string;
}

export default function CameraCapture({ onCapture, onClose, title = "Capturar Foto con Cámara" }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [loading, setLoading] = useState<boolean>(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setLoading(true);
    setError(null);
    
    // Stop any existing tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setLoading(false);
    } catch (err: any) {
      console.error("Camera access error:", err);
      
      // If environment camera fails, fallback to user camera (e.g. on PC)
      if (facingMode === "environment") {
        setFacingMode("user");
      } else {
        setError(
          "No se pudo acceder a la cámara. Por favor, asegúrate de dar permisos de cámara en tu navegador o selecciona subir archivo."
        );
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    startCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => (prev === "environment" ? "user" : "environment"));
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions matching the video stream resolution
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    // Optional Mirroring if user camera is used
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    // Draw frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to JPEG base64
    const base64 = canvas.toDataURL("image/jpeg", 0.95);
    onCapture(base64);
    
    // Stop stream and close
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 text-white rounded-3xl w-full max-w-lg border border-slate-800 shadow-2xl overflow-hidden flex flex-col relative animate-scaleIn">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            <h4 className="font-display font-bold text-sm text-slate-100">
              {title}
            </h4>
          </div>
          <button 
            onClick={() => {
              if (stream) {
                stream.getTracks().forEach(track => track.stop());
              }
              onClose();
            }}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Stage */}
        <div className="relative bg-black flex-1 flex items-center justify-center min-h-[300px] max-h-[450px] overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-950">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Encendiendo Cámara...</span>
            </div>
          )}

          {error ? (
            <div className="p-6 text-center text-red-400 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <p className="text-xs font-bold">{error}</p>
              <button 
                onClick={startCamera}
                className="mt-4 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover max-h-[450px] ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            />
          )}

          {/* Guide Overlay */}
          {!loading && !error && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="border-2 border-dashed border-indigo-400/50 rounded-2xl w-full max-w-[320px] aspect-[8.5/5.4] flex items-center justify-center relative bg-indigo-500/5 shadow-inner">
                <span className="text-[10px] bg-slate-900/80 text-indigo-300 font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                  Encuadra el Documento aquí
                </span>
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-400"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-400"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-400"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-400"></div>
              </div>
              <p className="text-[10px] text-slate-300 bg-slate-950/70 px-3 py-1 rounded-full mt-4 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
                Evita reflejos y mantén el pulso firme
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center gap-4">
          <button
            type="button"
            onClick={toggleCamera}
            disabled={!!error || loading}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 flex items-center justify-center gap-2 text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Girar Cámara</span>
          </button>

          <button
            type="button"
            onClick={capturePhoto}
            disabled={!!error || loading}
            className="flex-1 py-3 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-40 transition-all cursor-pointer"
          >
            <Camera className="w-5 h-5 stroke-[2.2]" />
            <span>Tomar Foto</span>
          </button>
        </div>

        {/* Hidden canvas */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
