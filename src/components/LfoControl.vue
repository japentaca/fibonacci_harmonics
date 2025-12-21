<script setup>
  import { ref, watch, onMounted, onUnmounted } from 'vue';
  import Slider from 'primevue/slider';
  import Dropdown from 'primevue/dropdown';
  import InputSwitch from 'primevue/inputswitch';

  const props = defineProps({
    label: String,
    modelValue: Object, // { active, min, max, type, speed, range: [min, max] }
    paramMin: Number,
    paramMax: Number
  });

  const emit = defineEmits(['update:modelValue']);

  const localState = ref({ ...props.modelValue });
  const canvasRef = ref(null);
  let animationId = null;

  // Ensure range is initialized
  if (!localState.value.range) {
    localState.value.range = [props.paramMin, props.paramMax];
  }

  const typeOptions = [
    { label: 'Sine', value: 'sine' },
    { label: 'Triangle', value: 'triangle' },
    { label: 'Square', value: 'square' },
    { label: 'Sawtooth', value: 'sawtooth' },
    { label: 'Inverse Sawtooth', value: 'inv sawtooth' }
  ];

  // Simple debounce implementation
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  const debouncedEmit = debounce((val) => {
    emit('update:modelValue', val);
  }, 50); // 50ms debounce

  watch(localState, (newVal) => {
    debouncedEmit({ ...newVal });
  }, { deep: true });

  watch(() => props.modelValue, (newVal) => {
    if (JSON.stringify(newVal) !== JSON.stringify(localState.value)) {
      localState.value = { ...newVal };
    }
  }, { deep: true });


  // Visualization Logic
  function draw() {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    if (!localState.value.active) return;

    const type = localState.value.type;
    const speed = localState.value.speed;
    const time = Date.now() / 1000;

    const cycleDuration = 1 / speed;
    const currentPhase = (time % cycleDuration) / cycleDuration;

    // Draw Static Waveform
    ctx.beginPath();
    ctx.strokeStyle = '#00b4d8';
    ctx.lineWidth = 2;

    for (let x = 0; x < width; x++) {
      const stepPhase = x / width;
      let val = 0;

      switch (type) {
        case 'sine':
          val = (Math.sin(stepPhase * 2 * Math.PI) + 1) / 2;
          break;
        case 'triangle':
          val = (Math.asin(Math.sin(stepPhase * 2 * Math.PI)) / (Math.PI / 2) + 1) / 2;
          break;
        case 'square':
          val = Math.sin(stepPhase * 2 * Math.PI) > 0 ? 1 : 0;
          break;
        case 'sawtooth':
          val = stepPhase;
          break;
        case 'inv sawtooth':
          val = 1 - stepPhase;
          break;
      }

      const y = 1 - val;
      const padding = 4;
      const drawHeight = height - (padding * 2);
      const yPos = padding + (y * drawHeight);

      if (x === 0) ctx.moveTo(x, yPos);
      else ctx.lineTo(x, yPos);
    }
    ctx.stroke();

    // Draw Playhead
    const cursorX = currentPhase * width;

    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, height);
    ctx.stroke();

    // Draw Dot
    let valAtCursor = 0;
    switch (type) {
      case 'sine':
        valAtCursor = (Math.sin(currentPhase * 2 * Math.PI) + 1) / 2;
        break;
      case 'triangle':
        valAtCursor = (Math.asin(Math.sin(currentPhase * 2 * Math.PI)) / (Math.PI / 2) + 1) / 2;
        break;
      case 'square':
        valAtCursor = Math.sin(currentPhase * 2 * Math.PI) > 0 ? 1 : 0;
        break;
      case 'sawtooth':
        valAtCursor = currentPhase;
        break;
      case 'inv sawtooth':
        valAtCursor = 1 - currentPhase;
        break;
    }
    const yAtCursor = 4 + ((1 - valAtCursor) * (height - 8));

    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(cursorX, yAtCursor, 3, 0, Math.PI * 2);
    ctx.fill();

    animationId = requestAnimationFrame(draw);
  }

  // Watch for active state to start/stop loop
  watch(() => localState.value.active, (active) => {
    if (active) {
      // Wait for DOM update
      setTimeout(() => {
        if (!animationId) animationId = requestAnimationFrame(draw);
      }, 0);
    } else {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }
  });

  onMounted(() => {
    if (localState.value.active) {
      animationId = requestAnimationFrame(draw);
    }
  });

  onUnmounted(() => {
    if (animationId) cancelAnimationFrame(animationId);
  });

</script>

<template>
  <div class="flex flex-column gap-2 p-3 surface-overlay border-round">
    <div class="flex align-items-center justify-content-between">
      <span class="font-bold text-sm">{{ label }}</span>
      <InputSwitch v-model="localState.active" />
    </div>

    <div v-if="localState.active" class="flex flex-column gap-3 mt-2">
      <!-- Canvas Visualization moved inside -->
      <div class="border-round overflow-hidden" style="height: 60px; background: #1e1e1e;">
        <canvas ref="canvasRef" width="200" height="60" class="w-full h-full block"></canvas>
      </div>

      <!-- Range -->
      <div class="flex flex-column gap-1">
        <div class="flex justify-content-between text-xs text-500">
          <span>Range</span>
          <span>{{ Math.round(localState.range[0]) }} - {{ Math.round(localState.range[1]) }}</span>
        </div>
        <Slider v-model="localState.range" :min="paramMin" :max="paramMax" range class="w-full" />
      </div>

      <!-- Speed -->
      <div class="flex flex-column gap-1">
        <div class="flex justify-content-between text-xs text-500">
          <span>Speed</span>
          <span>{{ localState.speed }} Hz</span>
        </div>
        <Slider v-model="localState.speed" :min="0.01" :max="5" :step="0.01" class="w-full" />
      </div>

      <!-- Type -->
      <div class="flex flex-column gap-1">
        <span class="text-xs text-500">Type</span>
        <Dropdown v-model="localState.type" :options="typeOptions" optionLabel="label" optionValue="value"
          class="w-full p-inputtext-sm" />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
