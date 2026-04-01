"use client";

import { useAudioPlayer } from "@/lib/player";
import { formatDuration } from "@/lib/format";

interface NowPlayingBarProps {
  coverUrl: string | null;
}

export function NowPlayingBar({ coverUrl }: NowPlayingBarProps) {
  const {
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlayPause,
    next,
    previous,
    seekRatio,
    setVolume,
  } = useAudioPlayer();

  if (!activeTrack) {
    return (
      <div className="sticky bottom-0 z-30 overflow-hidden rounded-t-2xl border-t border-white/[0.06] bg-[#111]/95 px-4 py-4 text-center text-sm text-zinc-500 backdrop-blur-md sm:px-6">
        Add tracks to start listening
      </div>
    );
  }

  const prog = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="sticky bottom-0 z-30 overflow-hidden rounded-t-2xl border-t border-white/[0.06] bg-[#111]/95 px-4 py-4 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-zinc-800 sm:h-16 sm:w-16">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-sm text-zinc-500">
                {activeTrack.title.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-white">{activeTrack.title}</div>
            <div className="truncate text-xs text-zinc-500">{activeTrack.artist}</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-[2] flex-col gap-2">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => previous()}
              className="touch-target flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white sm:h-12 sm:w-12"
              aria-label="Previous"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={() => void togglePlayPause()}
              className="touch-target flex h-11 w-11 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 sm:h-12 sm:w-12"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              onClick={() => next()}
              className="touch-target flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white sm:h-12 sm:w-12"
              aria-label="Next"
            >
              ⏭
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="w-10 tabular-nums">{formatDuration(currentTime)}</span>
            <div
              className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-zinc-800"
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                seekRatio(Math.max(0, Math.min(1, x / rect.width)));
              }}
              role="slider"
              aria-valuenow={Math.round(prog * 100)}
            >
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-zinc-400"
                style={{ width: `${prog * 100}%` }}
              />
            </div>
            <span className="w-10 text-right tabular-nums">{formatDuration(duration)}</span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center sm:flex sm:pl-2">
          {/* Padding keeps range thumb from clipping at min/max */}
          <div className="px-2 py-1">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="h-2 w-[7.5rem] max-w-[min(7.5rem,100%)] cursor-pointer accent-zinc-400 sm:w-32"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
