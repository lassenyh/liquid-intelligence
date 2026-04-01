"use client";

import type { TrackRecord } from "@/lib/types/track";

export function updateMediaSession(
  track: TrackRecord | null,
  opts: {
    artworkUrl?: string | null;
    isPlaying: boolean;
  },
) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }
  const artwork = opts.artworkUrl
    ? [{ src: opts.artworkUrl, sizes: "512x512", type: "image/jpeg" }]
    : [];

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album ?? "",
    artwork,
  });

  navigator.mediaSession.playbackState = opts.isPlaying ? "playing" : "paused";
}

export function bindMediaSessionActions(handlers: {
  play: () => void;
  pause: () => void;
  next?: () => void;
  previous?: () => void;
}) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

  try {
    navigator.mediaSession.setActionHandler("play", handlers.play);
    navigator.mediaSession.setActionHandler("pause", handlers.pause);
  } catch {
    /* ignore */
  }

  if (handlers.next) {
    try {
      navigator.mediaSession.setActionHandler("nexttrack", handlers.next);
    } catch {
      /* ignore */
    }
  }
  if (handlers.previous) {
    try {
      navigator.mediaSession.setActionHandler("previoustrack", handlers.previous);
    } catch {
      /* ignore */
    }
  }
}
