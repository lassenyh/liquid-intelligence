"use client";

import { useCallback, useEffect, useRef } from "react";

interface WaveformProps {
  peaks: number[] | null;
  progress: number;
  onSeekRatio: (ratio: number) => void;
  disabled?: boolean;
  height?: number;
  className?: string;
}

export function Waveform({
  peaks,
  progress,
  onSeekRatio,
  disabled,
  height = 28,
  className = "",
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const bg = "#2a2a2a";
    const fg = "#4a4a4a";
    const played = "#6a6a6a";

    if (!peaks?.length) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const n = peaks.length;
    const barW = w / n;
    const gap = Math.max(0.5, barW * 0.15);
    const inner = barW - gap;
    const mid = h / 2;

    const progX = progress * w;

    for (let i = 0; i < n; i++) {
      const x = i * barW + gap / 2;
      const amp = peaks[i] * (h * 0.42);
      const y0 = mid - amp;
      const y1 = mid + amp;
      const center = x + inner / 2;
      ctx.fillStyle = center <= progX ? played : fg;
      ctx.fillRect(x, y0, inner, y1 - y0);
    }
  }, [peaks, progress, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    const el = canvasRef.current;
    if (el?.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [draw]);

  const ratioFromClientX = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    onSeekRatio(ratioFromClientX(e.clientX));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || disabled) return;
    onSeekRatio(ratioFromClientX(e.clientX));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`relative min-h-[28px] w-full min-w-[80px] ${className}`}>
      <canvas
        ref={canvasRef}
        className="block h-[28px] w-full cursor-pointer touch-none select-none"
        style={{ height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowLeft") onSeekRatio(Math.max(0, progress - 0.05));
          if (e.key === "ArrowRight") onSeekRatio(Math.min(1, progress + 0.05));
        }}
      />
    </div>
  );
}
