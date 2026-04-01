import type { MetadataSource } from "@/lib/types/track";

function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, "") || name;
}

function splitArtistTitle(filename: string): { title: string; artist: string } {
  const base = stripExtension(filename);
  const m = base.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (m) {
    return { artist: m[1].trim(), title: m[2].trim() };
  }
  return { artist: "Unknown artist", title: base || "Untitled" };
}

export interface ParsedMetadata {
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  metadataSource: MetadataSource;
}

/** MIME types browsers commonly decode with Web Audio / HTMLAudioElement */
export const SUPPORTED_MIME_HINTS = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aiff",
  "audio/x-aiff",
  "audio/flac",
  "audio/x-flac",
];

export function guessMimeFromFile(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
    case "mp4":
      return "audio/mp4";
    case "aiff":
    case "aif":
      return "audio/aiff";
    case "flac":
      return "audio/flac";
    default:
      return "application/octet-stream";
  }
}

export async function parseAudioMetadata(file: File): Promise<ParsedMetadata> {
  const fallback = (): ParsedMetadata => {
    const { title, artist } = splitArtistTitle(file.name);
    return {
      title,
      artist,
      durationSec: 0,
      metadataSource: "filename",
    };
  };

  try {
    const { parseBlob } = await import("music-metadata");
    const meta = await parseBlob(file, { duration: true });
    const title =
      meta.common.title?.trim() ||
      splitArtistTitle(file.name).title;
    const artist =
      meta.common.artist?.trim() ||
      meta.common.artists?.[0]?.trim() ||
      splitArtistTitle(file.name).artist;
    const album = meta.common.album?.trim();
    const durationSec =
      typeof meta.format.duration === "number" && meta.format.duration > 0
        ? meta.format.duration
        : 0;

    const hasEmbedded =
      Boolean(meta.common.title) ||
      Boolean(meta.common.artist) ||
      Boolean(meta.common.artists?.length);

    return {
      title,
      artist,
      album,
      durationSec,
      metadataSource: hasEmbedded ? "embedded" : "filename",
    };
  } catch {
    return fallback();
  }
}
