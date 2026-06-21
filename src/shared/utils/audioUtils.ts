/**
 * Audio utility functions for processing audio data
 */

/**
 * Decode base64 string to Uint8Array
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode audio data from bytes to AudioBuffer
 */
export async function decodeAudioData(
  audioData: Uint8Array,
  audioContext: AudioContext,
  sampleRate: number = 24000,
  channels: number = 1
): Promise<AudioBuffer> {
  // Convert PCM data to AudioBuffer
  // Int16Array has 2 bytes per sample, so we need an even number of bytes
  // Round down to ensure we have a valid integer length
  const length = Math.floor(audioData.length / 2);
  
  // Handle edge case: if length is 0 or negative, create a minimal buffer
  if (length <= 0) {
    return audioContext.createBuffer(channels, 1, sampleRate);
  }
  
  const audioBuffer = audioContext.createBuffer(channels, length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  // Convert Int16 PCM to Float32 (-1.0 to 1.0)
  // Use Math.min to ensure we don't exceed the actual available data
  const actualLength = Math.min(length, Math.floor(audioData.length / 2));
  const int16Array = new Int16Array(audioData.buffer, audioData.byteOffset, actualLength);
  for (let i = 0; i < actualLength; i++) {
    channelData[i] = int16Array[i] / 32768.0;
  }

  return audioBuffer;
}



