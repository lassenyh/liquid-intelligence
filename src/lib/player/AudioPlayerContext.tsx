"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TrackRecord } from "@/lib/types/track";
import type { LibraryStorageAdapter } from "@/lib/storage";
import { bindMediaSessionActions, updateMediaSession } from "./mediaSession";

interface AudioPlayerContextValue {
  activeTrackId: string | null;
  activeTrack: TrackRecord | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  orderedTrackIds: string[];
  playTrack: (id: string, startRatio?: number) => Promise<void>;
  refreshActiveArtwork: () => Promise<void>;
  togglePlayPause: () => void;
  pause: () => void;
  seek: (time: number) => void;
  seekRatio: (ratio: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  next: () => void;
  previous: () => void;
  setOrderedTrackIds: (ids: string[]) => void;
  setActiveTrackMeta: (t: TrackRecord | null) => void;
  clearActive: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({
  children,
  storage,
}: {
  children: React.ReactNode;
  storage: LibraryStorageAdapter;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const coverUrlRef = useRef<string | null>(null);

  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [activeTrack, setActiveTrack] = useState<TrackRecord | null>(null);
  const [orderedTrackIds, setOrderedTrackIds] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);

  const activeTrackRef = useRef<TrackRecord | null>(null);

  useEffect(() => {
    activeTrackRef.current = activeTrack;
  }, [activeTrack]);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const revokeCoverUrl = useCallback(() => {
    if (coverUrlRef.current) {
      URL.revokeObjectURL(coverUrlRef.current);
      coverUrlRef.current = null;
    }
  }, []);

  const playTrack = useCallback(
    async (id: string, startRatio?: number) => {
      const track = await storage.getTrack(id);
      if (!track) return;
      const blob = await storage.getAudioBlob(id);
      if (!blob) return;

      revokeBlobUrl();
      revokeCoverUrl();

      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const coverBlob = await storage.getCoverBlob(id);
      if (coverBlob) {
        coverUrlRef.current = URL.createObjectURL(coverBlob);
      }

      setActiveTrackId(id);
      setActiveTrack(track);

      const el = audioRef.current;
      if (!el) return;
      el.src = url;
      el.volume = volume;
      el.muted = muted;
      await el.load();

      const d =
        Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : track.durationSec;
      const dur = d > 0 ? d : track.durationSec;
      setDuration(dur);

      if (startRatio !== undefined && dur > 0) {
        el.currentTime = startRatio * dur;
        setCurrentTime(el.currentTime);
      } else {
        setCurrentTime(0);
      }

      updateMediaSession(track, {
        artworkUrl: coverUrlRef.current,
        isPlaying: true,
      });

      try {
        await el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
        updateMediaSession(track, {
          artworkUrl: coverUrlRef.current,
          isPlaying: false,
        });
      }
    },
    [storage, volume, muted, revokeBlobUrl, revokeCoverUrl],
  );

  const refreshActiveArtwork = useCallback(async () => {
    const id = activeTrackId;
    if (!id) return;
    revokeCoverUrl();
    const coverBlob = await storage.getCoverBlob(id);
    if (coverBlob) {
      coverUrlRef.current = URL.createObjectURL(coverBlob);
    }
    const t = activeTrackRef.current;
    if (t) {
      updateMediaSession(t, {
        artworkUrl: coverUrlRef.current,
        isPlaying: !audioRef.current?.paused,
      });
    }
  }, [activeTrackId, storage, revokeCoverUrl]);

  const next = useCallback(() => {
    const cur = activeTrackId;
    if (!cur || orderedTrackIds.length === 0) return;
    const i = orderedTrackIds.indexOf(cur);
    if (i < 0 || i >= orderedTrackIds.length - 1) return;
    void playTrack(orderedTrackIds[i + 1]);
  }, [activeTrackId, orderedTrackIds, playTrack]);

  const previous = useCallback(() => {
    const cur = activeTrackId;
    if (!cur || orderedTrackIds.length === 0) return;
    const i = orderedTrackIds.indexOf(cur);
    if (i <= 0) return;
    void playTrack(orderedTrackIds[i - 1]);
  }, [activeTrackId, orderedTrackIds, playTrack]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onPlay = () => {
      setIsPlaying(true);
      const t = activeTrackRef.current;
      if (t) {
        updateMediaSession(t, {
          artworkUrl: coverUrlRef.current,
          isPlaying: true,
        });
      }
    };
    const onPause = () => {
      setIsPlaying(false);
      const t = activeTrackRef.current;
      if (t) {
        updateMediaSession(t, {
          artworkUrl: coverUrlRef.current,
          isPlaying: false,
        });
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      next();
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [next]);

  useEffect(() => {
    bindMediaSessionActions({
      play: () => {
        void audioRef.current?.play();
      },
      pause: () => audioRef.current?.pause(),
      next,
      previous,
    });
  }, [next, previous]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el && !el.paused) {
        setCurrentTime(el.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePlayPause = useCallback(async () => {
    const el = audioRef.current;
    if (!el?.src) return;
    if (el.paused) {
      try {
        await el.play();
      } catch {
        /* blocked */
      }
    } else {
      el.pause();
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    const el = audioRef.current;
    if (!el) return;
    const max = el.duration > 0 ? el.duration : duration;
    const t = Math.max(0, Math.min(time, max));
    el.currentTime = t;
    setCurrentTime(t);
  }, [duration]);

  const seekRatio = useCallback(
    (ratio: number) => {
      const el = audioRef.current;
      const d = el && el.duration > 0 ? el.duration : duration;
      if (!d) return;
      seek(ratio * d);
    },
    [seek, duration],
  );

  const setVolume = useCallback((v: number) => {
    const nv = Math.max(0, Math.min(1, v));
    setVolumeState(nv);
    setMuted(false);
    if (audioRef.current) {
      audioRef.current.volume = nv;
      audioRef.current.muted = false;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const nm = !m;
      if (audioRef.current) audioRef.current.muted = nm;
      return nm;
    });
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.volume = volume;
  }, [volume]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.muted = muted;
  }, [muted]);

  const setActiveTrackMeta = useCallback((t: TrackRecord | null) => {
    setActiveTrack(t);
    if (t) {
      updateMediaSession(t, {
        artworkUrl: coverUrlRef.current,
        isPlaying: !audioRef.current?.paused,
      });
    }
  }, []);

  const clearActive = useCallback(() => {
    revokeBlobUrl();
    revokeCoverUrl();
    setActiveTrackId(null);
    setActiveTrack(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
    }
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
    }
  }, [revokeBlobUrl, revokeCoverUrl]);

  useEffect(
    () => () => {
      revokeBlobUrl();
      revokeCoverUrl();
    },
    [revokeBlobUrl, revokeCoverUrl],
  );

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      activeTrackId,
      activeTrack,
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      orderedTrackIds,
      playTrack,
      refreshActiveArtwork,
      togglePlayPause,
      pause,
      seek,
      seekRatio,
      setVolume,
      toggleMute,
      next,
      previous,
      setOrderedTrackIds,
      setActiveTrackMeta,
      clearActive,
    }),
    [
      activeTrackId,
      activeTrack,
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      orderedTrackIds,
      playTrack,
      refreshActiveArtwork,
      togglePlayPause,
      pause,
      seek,
      seekRatio,
      setVolume,
      toggleMute,
      next,
      previous,
      setActiveTrackMeta,
      clearActive,
    ],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      <audio ref={audioRef} preload="metadata" className="hidden" playsInline />
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}
