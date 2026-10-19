import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeWav, WAV_HEADER_BYTES } from './wav.js'

function makeBuffer(channels, length, sampleRate, fill = 0) {
  const data = []
  for (let channel = 0; channel < channels; channel++) {
    const samples = new Float32Array(length)
    for (let i = 0; i < length; i++) samples[i] = fill
    data.push(samples)
  }
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: channel => data[channel]
  }
}

function readAscii(view, offset, size) {
  let out = ''
  for (let i = 0; i < size; i++) out += String.fromCharCode(view.getUint8(offset + i))
  return out
}

test('the buffer holds the 44 bytes header plus the samples', () => {
  const channels = 2
  const length = 100
  const encoded = encodeWav(makeBuffer(channels, length, 44100))
  assert.equal(encoded.byteLength, WAV_HEADER_BYTES + length * channels * 2)
})

test('the header describes a RIFF/WAVE file', () => {
  const encoded = encodeWav(makeBuffer(2, 64, 44100))
  const view = new DataView(encoded)
  assert.equal(readAscii(view, 0, 4), 'RIFF')
  assert.equal(readAscii(view, 8, 4), 'WAVE')
  assert.equal(readAscii(view, 12, 4), 'fmt ')
  assert.equal(readAscii(view, 36, 4), 'data')
  // the size of the riff chunk is the file size without the first 8 bytes
  assert.equal(view.getUint32(4, true), encoded.byteLength - 8)
  // the size of the data chunk is the number of bytes of the samples
  assert.equal(view.getUint32(40, true), 64 * 2 * 2)
})

test('the header holds the real channel count and sample rate', () => {
  const encoded = encodeWav(makeBuffer(1, 10, 48000))
  const view = new DataView(encoded)
  assert.equal(view.getUint16(20, true), 1, 'PCM format')
  assert.equal(view.getUint16(22, true), 1, 'channels')
  assert.equal(view.getUint32(24, true), 48000, 'sample rate')
  assert.equal(view.getUint32(28, true), 48000 * 2, 'byte rate')
  assert.equal(view.getUint16(32, true), 2, 'block align')
  assert.equal(view.getUint16(34, true), 16, 'bits per sample')
})

test('the samples are written as 16-bit signed PCM', () => {
  const buffer = makeBuffer(1, 3, 44100)
  buffer.getChannelData(0).set([0, 1, -1])
  const view = new DataView(encodeWav(buffer))
  assert.equal(view.getInt16(WAV_HEADER_BYTES, true), 0)
  assert.equal(view.getInt16(WAV_HEADER_BYTES + 2, true), 32767)
  assert.equal(view.getInt16(WAV_HEADER_BYTES + 4, true), -32768)
})

test('the samples of every channel are interleaved', () => {
  const buffer = makeBuffer(2, 2, 44100)
  buffer.getChannelData(0).set([1, 0])
  buffer.getChannelData(1).set([0, 1])
  const view = new DataView(encodeWav(buffer))
  assert.equal(view.getInt16(WAV_HEADER_BYTES, true), 32767)
  assert.equal(view.getInt16(WAV_HEADER_BYTES + 2, true), 0)
  assert.equal(view.getInt16(WAV_HEADER_BYTES + 4, true), 0)
  assert.equal(view.getInt16(WAV_HEADER_BYTES + 6, true), 32767)
})

test('the samples out of range are clipped', () => {
  const buffer = makeBuffer(1, 2, 44100)
  buffer.getChannelData(0).set([2, -2])
  const view = new DataView(encodeWav(buffer))
  assert.equal(view.getInt16(WAV_HEADER_BYTES, true), 32767)
  assert.equal(view.getInt16(WAV_HEADER_BYTES + 2, true), -32768)
})

test('an empty buffer produces a valid header', () => {
  const encoded = encodeWav(makeBuffer(2, 0, 44100))
  assert.equal(encoded.byteLength, WAV_HEADER_BYTES)
  const view = new DataView(encoded)
  assert.equal(readAscii(view, 0, 4), 'RIFF')
  assert.equal(view.getUint32(40, true), 0)
})

test('an invalid buffer is rejected', () => {
  assert.throws(() => encodeWav(null), TypeError)
  assert.throws(() => encodeWav({}), TypeError)
  assert.throws(() => encodeWav(makeBuffer(0, 10, 44100)), TypeError)
  assert.throws(() => encodeWav(makeBuffer(1, 10, 0)), TypeError)
})
