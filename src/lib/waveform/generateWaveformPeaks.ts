export interface WaveformResult {
  peaks: number[];
  durationSec: number;
}

/** Downsample decoded audio to normalized peak bars (0–1). */
export async function generateWaveformPeaks(
  audioBlob: Blob,
  barCount = 320,
): Promise<WaveformResult> {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioContextClass();
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const durationSec = audioBuffer.duration || 0;
    const len = audioBuffer.length;
    const channels = audioBuffer.numberOfChannels;
    const scratch = new Float32Array(len);
    if (channels === 1) {
      scratch.set(audioBuffer.getChannelData(0));
    } else {
      const ch0 = audioBuffer.getChannelData(0);
      const ch1 = audioBuffer.getChannelData(1);
      for (let i = 0; i < len; i++) {
        scratch[i] = (ch0[i] + ch1[i]) / 2;
      }
    }

    const blockSize = Math.max(1, Math.floor(len / barCount));
    const peaks: number[] = [];
    for (let b = 0; b < barCount; b++) {
      const start = b * blockSize;
      let max = 0;
      const end = Math.min(start + blockSize, len);
      for (let i = start; i < end; i++) {
        const v = Math.abs(scratch[i]);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    let maxPeak = 0;
    for (const p of peaks) if (p > maxPeak) maxPeak = p;
    if (maxPeak < 1e-8) maxPeak = 1;
    return {
      peaks: peaks.map((p) => p / maxPeak),
      durationSec,
    };
  } finally {
    await ctx.close();
  }
}
