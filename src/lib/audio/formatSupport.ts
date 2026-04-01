/** Best-effort check; actual decode may still fail per browser. */
export function isLikelyPlayableMime(mime: string): boolean {
  const m = mime.toLowerCase();
  if (m.startsWith("audio/mpeg") || m === "audio/mp3") return true;
  if (m.includes("wav")) return true;
  if (m.includes("mp4") || m.includes("m4a")) return true;
  if (m.includes("aiff") || m.includes("aif")) return true;
  if (m.includes("flac")) return true;
  return false;
}

export function formatNotSupportedMessage(mime: string): string {
  return `This browser may not decode "${mime}". Try MP3 or WAV, or use Safari/Chrome.`;
}
