import { isLikelyPlayableMime, formatNotSupportedMessage } from "@/lib/audio/formatSupport";
import { guessMimeFromFile, parseAudioMetadata } from "@/lib/metadata/parseAudioMetadata";
import type { LibraryStorageAdapter } from "@/lib/storage";
import type { TrackRecord } from "@/lib/types/track";
import { generateWaveformPeaks } from "@/lib/waveform/generateWaveformPeaks";

export interface IngestResult {
  ok: true;
  id: string;
}

export interface IngestError {
  ok: false;
  fileName: string;
  message: string;
}

export async function ingestAudioFile(
  file: File,
  storage: LibraryStorageAdapter,
  orderIndex: number,
): Promise<IngestResult | IngestError> {
  const mime = guessMimeFromFile(file);
  if (!isLikelyPlayableMime(mime)) {
    return {
      ok: false,
      fileName: file.name,
      message: formatNotSupportedMessage(mime),
    };
  }

  let meta;
  try {
    meta = await parseAudioMetadata(file);
  } catch {
    meta = {
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Unknown artist",
      durationSec: 0,
      metadataSource: "filename" as const,
    };
  }

  const id = crypto.randomUUID();
  const record: TrackRecord = {
    id,
    title: meta.title,
    artist: meta.artist,
    album: meta.album,
    durationSec: meta.durationSec,
    mimeType: mime,
    fileName: file.name,
    createdAt: Date.now(),
    orderIndex,
    metadataSource: meta.metadataSource,
    waveformPeaks: null,
    waveformStatus: "pending",
  };

  try {
    await storage.saveTrack(record, file, undefined);
  } catch (e) {
    return {
      ok: false,
      fileName: file.name,
      message: e instanceof Error ? e.message : "Could not save track",
    };
  }

  void generateAndCacheWaveform(id, file, storage);

  return { ok: true, id };
}

async function generateAndCacheWaveform(
  id: string,
  file: File,
  storage: LibraryStorageAdapter,
) {
  try {
    const { peaks, durationSec } = await generateWaveformPeaks(file);
    await storage.updateTrackWaveform(id, peaks, "ready", undefined, durationSec);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Decode failed";
    await storage.updateTrackWaveform(id, null, "error", msg);
    try {
      await storage.patchTrack(id, {
        playbackError:
          "This file could not be analyzed for a waveform. Playback may still work.",
      });
    } catch {
      /* ignore */
    }
  }
}
