// Pure 16-bit PCM WAV encoder. No Vue nor Tone.js here, so it can be tested
// with node --test.

export const WAV_HEADER_BYTES = 44
export const WAV_BITS_PER_SAMPLE = 16

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

// Encodes an audio buffer as a RIFF/WAVE file with 16-bit PCM samples.
// The buffer only needs numberOfChannels, length, sampleRate and getChannelData.
export function encodeWav(audioBuffer) {
  if (!audioBuffer || typeof audioBuffer.getChannelData !== 'function') {
    throw new TypeError('encodeWav expects an audio buffer')
  }
  const channels = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  const sampleRate = audioBuffer.sampleRate
  if (!Number.isInteger(channels) || channels < 1) {
    throw new TypeError('the audio buffer must have at least one channel')
  }
  if (!Number.isInteger(length) || length < 0) {
    throw new TypeError('the audio buffer must have a valid length')
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new TypeError('the audio buffer must have a valid sample rate')
  }

  const bytesPerSample = WAV_BITS_PER_SAMPLE / 8
  const blockAlign = channels * bytesPerSample
  const dataBytes = length * blockAlign
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes)
  const view = new DataView(buffer)

  // RIFF header
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')

  // fmt chunk: uncompressed PCM
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, WAV_BITS_PER_SAMPLE, true)

  // data chunk
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  const channelData = []
  for (let channel = 0; channel < channels; channel++) {
    channelData.push(audioBuffer.getChannelData(channel))
  }

  let offset = WAV_HEADER_BYTES
  for (let frame = 0; frame < length; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const data = channelData[channel]
      const raw = data && data.length > frame ? data[frame] : 0
      const clamped = Math.max(-1, Math.min(1, Number.isFinite(raw) ? raw : 0))
      const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
      view.setInt16(offset, Math.round(value), true)
      offset += 2
    }
  }

  return buffer
}
