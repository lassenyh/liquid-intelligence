"use client";

import { useCallback, useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TrackRecord } from "@/lib/types/track";
import { formatDuration } from "@/lib/format";
import { useAudioPlayer } from "@/lib/player";
import { Waveform } from "./Waveform";

export interface TrackRowProps {
  track: TrackRecord;
  coverUrl: string | null;
  sortable: boolean;
  onEdit: () => void;
  onChangeCover: () => void;
  onDelete: () => void;
}

function TrackRowInner({
  track,
  coverUrl,
  sortable,
  dragListeners,
  onEdit,
  onChangeCover,
  onDelete,
}: TrackRowProps & {
  dragListeners?: Record<string, unknown>;
}) {
  const {
    activeTrackId,
    playTrack,
    togglePlayPause,
    seekRatio,
    currentTime,
    duration,
    isPlaying,
  } = useAudioPlayer();

  const [menuOpen, setMenuOpen] = useState(false);
  const active = activeTrackId === track.id;
  const prog = active && duration > 0 ? currentTime / duration : 0;

  const handlePlay = () => {
    if (active) {
      void togglePlayPause();
    } else {
      void playTrack(track.id);
    }
  };

  const handleSeek = useCallback(
    (ratio: number) => {
      if (active) {
        seekRatio(ratio);
      } else {
        void playTrack(track.id, ratio);
      }
    },
    [active, playTrack, seekRatio, track.id],
  );

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setNow(Date.now());
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const week = 7 * 24 * 60 * 60 * 1000;
  const isNew =
    now !== null && now - track.createdAt < week;

  const disabledWave =
    Boolean(track.playbackError) || track.waveformStatus === "error";

  return (
    <div
      className={`group flex items-center gap-2 border-b border-white/[0.04] px-2 py-1.5 transition-colors sm:gap-3 sm:px-3 sm:py-2 ${
        active ? "bg-[#1a1a1a]" : "hover:bg-[#181818]"
      }`}
    >
      {sortable && (
        <button
          type="button"
          className="touch-target flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-zinc-500 active:cursor-grabbing"
          aria-label="Reorder"
          {...(dragListeners ?? {})}
        >
          ⋮⋮
        </button>
      )}

      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-zinc-800 sm:h-11 sm:w-11">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 text-xs font-medium text-zinc-500">
            {track.title.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handlePlay}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
        aria-label={active && isPlaying ? "Pause" : "Play"}
      >
        {active && isPlaying ? (
          <span className="inline-block h-3 w-3 text-[10px] leading-3">❚❚</span>
        ) : (
          <span className="ml-0.5 inline-block text-xs">▶</span>
        )}
      </button>

      <div className="min-w-0 flex-1 sm:max-w-[220px]">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="truncate font-semibold text-white">{track.title}</span>
          {isNew && (
            <span className="shrink-0 rounded bg-[#f5c400] px-1 py-0.5 text-[10px] font-bold uppercase leading-none text-black">
              New
            </span>
          )}
        </div>
        <div className="truncate text-xs text-zinc-500">{track.artist}</div>
      </div>

      <div className="hidden w-12 shrink-0 text-right text-xs text-zinc-500 sm:block">
        {formatDuration(track.durationSec)}
      </div>

      <div className="min-w-0 flex-[2]">
        {track.waveformStatus === "pending" && (
          <div className="h-7 w-full animate-pulse rounded bg-zinc-800/80" />
        )}
        {track.waveformStatus === "error" && (
          <div className="truncate text-xs text-amber-500/90">
            {track.waveformError || "Waveform failed"}
          </div>
        )}
        {track.waveformStatus === "ready" && track.waveformPeaks && (
          <Waveform
            peaks={track.waveformPeaks}
            progress={prog}
            onSeekRatio={handleSeek}
            disabled={disabledWave}
          />
        )}
        {track.playbackError && (
          <div className="truncate text-xs text-red-400/90">{track.playbackError}</div>
        )}
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded text-zinc-500 hover:bg-white/10 hover:text-white"
          aria-label="Track actions"
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-hidden
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-white/10 bg-[#1e1e1e] py-1 shadow-xl">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              >
                Edit details
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                onClick={() => {
                  setMenuOpen(false);
                  onChangeCover();
                }}
              >
                Change cover
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/10"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                Remove
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SortableTrackRow(props: TrackRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="w-full" {...attributes}>
      <TrackRowInner {...props} dragListeners={listeners} />
    </div>
  );
}

export function TrackRow(props: TrackRowProps) {
  if (props.sortable) {
    return <SortableTrackRow {...props} />;
  }
  return <TrackRowInner {...props} />;
}
