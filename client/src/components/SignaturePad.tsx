import { useRef, useState, useEffect } from "react";
import { X, Eraser, Check } from "lucide-react";

export default function SignaturePad({
  title = "Sign Off",
  subtitle,
  instruction = "Draw your signature below to confirm this payslip is correct.",
  onSave,
  onClose,
  saving = false,
}: {
  title?: string;
  subtitle?: string;
  instruction?: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
  saving?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    try { canvasRef.current!.setPointerCapture(e.pointerId); } catch {}
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  const save = () => {
    if (!hasInk || saving) return;
    const src = canvasRef.current!;
    // Flatten onto a white background so the PNG prints cleanly (not transparent).
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const octx = out.getContext("2d")!;
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(src, 0, 0);
    onSave(out.toDataURL("image/png"));
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200">
          <div>
            <p className="font-black text-sm uppercase tracking-wide text-zinc-900">{title}</p>
            {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400"
            data-testid="button-close-signature"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-zinc-500">{instruction}</p>
          <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-48 rounded-xl block"
              style={{ touchAction: "none" }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
              onPointerCancel={end}
              data-testid="canvas-signature"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clear}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 border border-zinc-300 rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
              data-testid="button-clear-signature"
            >
              <Eraser className="w-4 h-4" /> Clear
            </button>
            <button
              onClick={save}
              disabled={!hasInk || saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-save-signature"
            >
              <Check className="w-4 h-4" /> {saving ? "Saving…" : "Confirm & Sign"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
