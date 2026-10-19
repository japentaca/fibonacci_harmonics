<script setup>
  import { ref, watch, onMounted, onUnmounted } from 'vue';
  import * as Tone from 'tone';

  const props = defineProps({
    // Tone.Analyser connected to the master chain
    analyser: { type: Object, default: null },
    // The spectrum is only drawn when the audio engine is running
    active: { type: Boolean, default: false }
  });

  const canvasRef = ref(null);
  let animationId = null;
  let observer = null;
  let visible = true;
  let lastDraw = 0;

  const MIN_FREQ = 20;
  const MAX_FREQ = 20000;
  const DB_FLOOR = -100;
  const DB_CEIL = 0;
  const HEIGHT = 120;
  const FPS = 30;
  const FRAME_MS = 1000 / FPS;
  const PEAK_LIMIT = 4;
  const PEAK_MIN_DB = -70;
  // Minimum distance between two labels, in Hz
  const PEAK_MIN_DISTANCE = 120;

  // The X axis is logarithmic: 20 Hz on the left, 20 kHz on the right
  function frequencyAt(x, width) {
    const t = width > 0 ? Math.min(1, Math.max(0, x / width)) : 0;
    return MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, t);
  }

  function formatFrequency(freq) {
    return freq >= 1000 ? (freq / 1000).toFixed(1) + ' kHz' : Math.round(freq) + ' Hz';
  }

  function readValues() {
    if (!props.analyser) return null;
    const raw = props.analyser.getValue();
    if (!raw) return null;
    if (!Array.isArray(raw)) return raw;
    // Several channels: the loudest one is shown
    const merged = new Float32Array(raw[0].length);
    raw.forEach(channel => {
      for (let i = 0; i < merged.length; i++) {
        if (channel[i] > merged[i]) merged[i] = channel[i];
      }
    });
    return merged;
  }

  function drawGrid(ctx, width, height) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(freq => {
      const t = (Math.log(freq) - Math.log(MIN_FREQ)) / (Math.log(MAX_FREQ) - Math.log(MIN_FREQ));
      const x = Math.round(t * width) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - 12);
      ctx.stroke();
      ctx.fillText(freq >= 1000 ? (freq / 1000) + 'k' : String(freq), x, height - 2);
    });
  }

  function findPeaks(values, binWidth) {
    const peaks = [];
    for (let i = 1; i < values.length - 1; i++) {
      const value = values[i];
      if (!Number.isFinite(value)) continue;
      if (value < PEAK_MIN_DB) continue;
      if (value < values[i - 1] || value < values[i + 1]) continue;
      peaks.push({ index: i, freq: i * binWidth, db: value });
    }
    peaks.sort((a, b) => b.db - a.db);
    const selected = [];
    peaks.forEach(peak => {
      if (selected.length >= PEAK_LIMIT) return;
      if (selected.some(other => Math.abs(other.freq - peak.freq) < PEAK_MIN_DISTANCE)) return;
      selected.push(peak);
    });
    return selected;
  }

  function render() {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || (canvas.parentElement ? canvas.parentElement.clientWidth : 0);
    if (width <= 0) return;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(HEIGHT * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, HEIGHT);
    drawGrid(ctx, width, HEIGHT);

    const values = readValues();
    if (!values || values.length === 0) return;

    const sampleRate = Tone.getContext().sampleRate;
    // The analyser uses an fft of twice its size, so the bins are half of the range
    const binWidth = sampleRate / (props.analyser.size * 2);

    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.85)');
    gradient.addColorStop(0.6, 'rgba(0, 180, 216, 0.55)');
    gradient.addColorStop(1, 'rgba(0, 180, 216, 0.05)');

    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let x = 0; x <= width; x++) {
      const f1 = frequencyAt(x, width);
      const f2 = frequencyAt(x + 1, width);
      let i1 = Math.floor(f1 / binWidth);
      let i2 = Math.max(i1 + 1, Math.ceil(f2 / binWidth));
      if (i1 < 0) i1 = 0;
      if (i2 > values.length) i2 = values.length;
      let db = DB_FLOOR;
      for (let i = i1; i < i2; i++) {
        const value = values[i];
        if (Number.isFinite(value) && value > db) db = value;
      }
      const ratio = (db - DB_FLOOR) / (DB_CEIL - DB_FLOOR);
      const y = HEIGHT - 12 - Math.max(0, Math.min(1, ratio)) * (HEIGHT - 18);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, HEIGHT);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // The peaks of the spectrum are labelled with their frequency
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    findPeaks(values, binWidth).forEach(peak => {
      if (peak.freq < MIN_FREQ || peak.freq > MAX_FREQ) return;
      const t = (Math.log(peak.freq) - Math.log(MIN_FREQ)) / (Math.log(MAX_FREQ) - Math.log(MIN_FREQ));
      const x = t * width;
      const ratio = (peak.db - DB_FLOOR) / (DB_CEIL - DB_FLOOR);
      const y = HEIGHT - 12 - Math.max(0, Math.min(1, ratio)) * (HEIGHT - 18);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, HEIGHT - 12);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(formatFrequency(peak.freq), Math.min(x + 3, width - 46), Math.max(10, y - 3));
    });
  }

  function loop(timestamp) {
    animationId = null;
    if (!props.active || !visible) return;
    if (timestamp - lastDraw >= FRAME_MS) {
      lastDraw = timestamp;
      render();
    }
    animationId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (animationId === null) {
      lastDraw = 0;
      animationId = requestAnimationFrame(loop);
    }
  }

  function stopLoop() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // The loop only runs when the engine is on and the card is on the screen
  function syncLoop() {
    if (props.active && visible) {
      startLoop();
    } else {
      stopLoop();
    }
  }

  watch(() => props.active, () => {
    syncLoop();
  });

  onMounted(() => {
    if (typeof IntersectionObserver !== 'undefined' && canvasRef.value) {
      observer = new IntersectionObserver(entries => {
        visible = entries[entries.length - 1].isIntersecting;
        syncLoop();
      }, { threshold: 0.01 });
      observer.observe(canvasRef.value);
    }
    syncLoop();
  });

  onUnmounted(() => {
    stopLoop();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  });
</script>

<template>
  <div class="border-round overflow-hidden" style="height: 120px; background: #1e1e1e;">
    <canvas
      ref="canvasRef" class="w-full h-full block" role="img"
      aria-label="Spectrum analyser of the master output, in a logarithmic frequency scale"
    />
  </div>
</template>

<style scoped></style>
