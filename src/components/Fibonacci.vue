<script setup>
  import { ref, computed, watch, onUnmounted } from 'vue'
  import Tag from 'primevue/tag';
  import Button from "primevue/button"
  import Dropdown from "primevue/dropdown"
  import Card from 'primevue/card';
  import Slider from 'primevue/slider';
  import Dialog from 'primevue/dialog';
  import Toast from 'primevue/toast';
  import { useToast } from 'primevue/usetoast';
  import LfoControl from './LfoControl.vue';
  import SpectrumView from './SpectrumView.vue';
  import * as Tone from 'tone'
  import { maxArmonicos } from '../audio/constants.js'
  import { useSynth } from '../audio/useSynth.js'
  import { useDelay } from '../audio/useDelay.js'
  import { useLfo } from '../audio/useLfo.js'
  import { useArpeggiator } from '../audio/useArpeggiator.js'
  import { useKeyboard } from '../audio/useKeyboard.js'
  import { exportWav, downloadBlob } from '../audio/exportWav.js'
  import {
    BUILTIN_PRESETS,
    DEFAULT_STATE,
    applyState,
    findPreset,
    readState,
    serializeState,
    stateFromHash
  } from '../presets.js'

  const baseUrl = import.meta.env.BASE_URL
  const heroImage = `${baseUrl}landing-hero.svg`

  const toast = useToast()
  const synth = useSynth()
  const lfo = useLfo({ synth })
  const arpeggiator = useArpeggiator({ synth, lfo })
  const delay = useDelay()

  const {
    fundamental, cantArmonicos, offset, mappingMode, mappingModes,
    oscillatorType, oscillatorTypes, volumeSlider, volumeDb, isMuted,
    armonicos, droppedPartials, analyser
  } = synth
  const { lfos, lfoPhases, lfoPhaseTimes } = lfo
  const {
    arpeggiatorActive, arpeggiatorType, arpeggiatorTempo, arpeggiatorTypes,
    activeArpeggioIndex, toggleArpeggiator
  } = arpeggiator
  const { delaySend, delayTime, delayFeedback } = delay

  const audioStarted = ref(false)

  // The refs that hold the shareable state
  const stateSources = {
    fundamental, cantArmonicos, offset, mappingMode, oscillatorType,
    volumeSlider, delaySend, delayTime, delayFeedback,
    arpeggiatorType, arpeggiatorTempo, lfos
  }

  const PRESET_FROM_URL = '__url__'
  const presetOptions = computed(() => [
    ...BUILTIN_PRESETS.map(preset => ({ label: preset.name, value: preset.name })),
    { label: 'Load from URL', value: PRESET_FROM_URL }
  ])
  const activePresetName = ref(null)
  const showShortcuts = ref(false)
  const exporting = ref(false)
  // True when the state comes from a preset, a shared link or a reset, so the
  // default count is not forced over it when the engine starts
  let stateApplied = false
  // Volume before the mute, so it can be restored
  let previousVolume = null

  const shortcuts = [
    { keys: 'Space', description: 'Start the engine, or toggle the arpeggiator' },
    { keys: 'Esc', description: 'Close this help, or panic: release every note' },
    { keys: '1 - 4', description: 'Arpeggiator pattern: up, down, up-down, random' },
    { keys: 'M', description: 'Mute and unmute the output' },
    { keys: 'L', description: 'Switch the three LFOs on and off' },
    { keys: '? / H', description: 'Show or hide this help' }
  ]

  // A shared link is applied as soon as the app is loaded
  const sharedState = stateFromHash(window.location.hash)
  const stateRestored = sharedState ? applyState(stateSources, sharedState) : false
  stateApplied = stateRestored

  // Recalculates the series and pushes it to the voices, the arpeggiator and the LFO
  function calcular() {
    const prevArpeggioIndex = arpeggiator.getCurrentIndex()
    synth.calcular()
    arpeggiator.onSeriesChanged(prevArpeggioIndex)
    lfo.updateFundLfoRange()
  }

  watch([fundamental, cantArmonicos, offset, mappingMode], () => {
    calcular()
  })

  async function startAudio() {
    if (audioStarted.value) return
    await Tone.start()
    audioStarted.value = true

    // Create stereo ping-pong delay
    delay.createNodes()
    // Master chain: everything -> masterBus -> limiter -> analyser -> destination
    const master = synth.createMasterChain()
    delay.connectTo(master.masterBus, master.limiter)
    synth.createOscillators()

    // Native LFO for the fundamental
    lfo.createNativeLfo()

    // The count of a shared state or of a preset is not overwritten
    if (!stateApplied) {
      cantArmonicos.value = 3
    }

    // Initialize volume based on slider
    synth.updateVolume()
    calcular()

    lfo.startControlLoop()
  }

  function currentState() {
    return readState(stateSources)
  }

  function onPresetChange(event) {
    const name = event.value
    if (!name) return
    if (name === PRESET_FROM_URL) {
      const state = stateFromHash(window.location.hash)
      if (!state) {
        activePresetName.value = null
        toast.add({
          severity: 'error',
          summary: 'No shared state',
          detail: 'The address bar does not contain a valid state'
        })
        return
      }
      applyState(stateSources, state)
      activePresetName.value = null
      stateApplied = true
      toast.add({
        severity: 'success',
        summary: 'State loaded',
        detail: 'The state of the link has been applied'
      })
      return
    }
    const preset = findPreset(name)
    if (!preset) return
    applyState(stateSources, preset.state)
    activePresetName.value = preset.name
    stateApplied = true
    toast.add({
      severity: 'info',
      summary: preset.name,
      detail: 'Preset applied'
    })
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch (e) {
        // falls back to the legacy copy command
      }
    }
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(area)
      return copied
    } catch (e) {
      return false
    }
  }

  async function copyLink() {
    const encoded = serializeState(currentState())
    if (!encoded) return
    // The state travels in the hash, so the link is self contained
    window.history.replaceState(null, '', `#s=${encoded}`)
    const copied = await copyToClipboard(window.location.href)
    toast.add({
      severity: copied ? 'success' : 'warn',
      summary: copied ? 'Link copied' : 'Link ready',
      detail: copied
        ? 'The shareable link is in the clipboard'
        : 'The link is in the address bar, copy it manually'
    })
  }

  function resetState() {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    applyState(stateSources, DEFAULT_STATE)
    activePresetName.value = null
    stateApplied = true
    toast.add({
      severity: 'info',
      summary: 'Reset',
      detail: 'The default state has been restored'
    })
  }

  async function exportWavFile() {
    if (exporting.value) return
    exporting.value = true
    try {
      const { blob, filename } = await exportWav(currentState(), { presetName: activePresetName.value })
      downloadBlob(blob, filename)
      toast.add({
        severity: 'success',
        summary: 'Export finished',
        detail: filename
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: 'Export failed',
        detail: error && error.message ? error.message : 'Unknown error'
      })
    } finally {
      exporting.value = false
    }
  }

  function panic() {
    arpeggiator.panic()
    synth.panic()
    toast.add({
      severity: 'warn',
      summary: 'Panic',
      detail: 'Every note has been released'
    })
  }

  function toggleMute() {
    if (isMuted.value) {
      volumeSlider.value = previousVolume === null || previousVolume <= 0 ? 80 : previousVolume
      previousVolume = null
    } else {
      previousVolume = volumeSlider.value
      volumeSlider.value = 0
    }
  }

  function toggleLfos() {
    const allActive = lfos.value.fundamental.active && lfos.value.cantArmonicos.active && lfos.value.offset.active
    const next = !allActive
    lfos.value.fundamental.active = next
    lfos.value.cantArmonicos.active = next
    lfos.value.offset.active = next
  }

  useKeyboard({
    onSpace: () => {
      if (!audioStarted.value) {
        startAudio()
      } else {
        arpeggiator.toggleArpeggiator()
      }
    },
    onPanic: () => {
      // With the help panel open the escape key closes it, it does not panic
      if (showShortcuts.value) {
        showShortcuts.value = false
        return
      }
      panic()
    },
    onPattern: (index) => {
      const type = ['up', 'down', 'updown', 'random'][index]
      if (type) arpeggiatorType.value = type
    },
    onToggleMute: toggleMute,
    onToggleLfos: toggleLfos,
    onToggleHelp: () => {
      showShortcuts.value = !showShortcuts.value
    }
  })

  onUnmounted(() => {
    arpeggiator.dispose()
    lfo.dispose()
    delay.dispose()
    synth.dispose()
  })

</script>

<template>
  <div class="flex flex-column align-items-center justify-content-center min-h-screen p-4 surface-ground">
    <div v-if="!audioStarted" class="flex flex-column align-items-center gap-4 fadein animation-duration-1000">
      <img
        :src="heroImage" alt="A glowing spiral of the Fibonacci sequence over a waveform"
        class="w-20rem md:w-30rem h-auto hero-image"
      >
      <h1 class="text-4xl font-bold text-primary mb-0">Fibonacci Harmonics</h1>
      <p class="text-xl text-500 mt-0 mb-4">Explore the mathematics of sound</p>
      <Button
        size="large" label="Start Audio Engine" icon="pi pi-play" class="p-button-raised p-button-lg shadow-4"
        rounded @click="startAudio"
      />
    </div>

    <div v-if="audioStarted" class="w-full max-w-7 fadein animation-duration-500">
      <!-- Main Controls Header -->
      <div class="flex justify-content-between items-center mb-4 p-3 surface-card border-round shadow-2">
        <div class="flex gap-3 items-center">
          <i class="pi pi-wave-pulse text-2xl text-primary" />
          <span class="font-bold text-xl">Fibonacci Harmonics</span>
        </div>
        <div class="flex gap-2 items-center flex-wrap justify-content-end">
          <Dropdown
            v-model="activePresetName" :options="presetOptions" option-label="label" option-value="value"
            placeholder="Load preset" class="w-13rem" title="Load a built-in preset or the state stored in the link"
            aria-label="Load a preset" @change="onPresetChange"
          />
          <Button
            label="Copy link" icon="pi pi-link" outlined size="small" title="Copy a link with the current state"
            @click="copyLink"
          />
          <Button
            label="Reset" icon="pi pi-refresh" outlined severity="secondary" size="small" title="Clear the link and go back to the default state"
            @click="resetState"
          />
          <Button
            icon="pi pi-key" outlined severity="secondary" size="small" title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts" @click="showShortcuts = true"
          />
        </div>
      </div>

      <div class="grid">
        <!-- Harmonics Controls (Left/Center) -->
        <div class="col-12 md:col-8">
          <Card class="h-full shadow-2">
            <template #title>
              <div class="flex justify-content-between items-center gap-3">
                <span>Harmonics Generator</span>
                <div class="flex gap-3 items-end">
                  <div class="flex flex-column gap-1">
                    <span class="text-xs text-500">Mode</span>
                    <Dropdown
                      v-model="mappingMode" :options="mappingModes" option-label="label"
                      option-value="value" class="w-11rem" title="How partial numbers are mapped to frequencies"
                      aria-label="Mapping mode"
                    />
                  </div>
                  <div class="flex flex-column gap-1">
                    <span class="text-xs text-500">Osc</span>
                    <Dropdown
                      v-model="oscillatorType" :options="oscillatorTypes" class="w-10rem"
                      title="Oscillator waveform" aria-label="Oscillator waveform"
                    />
                  </div>
                </div>
              </div>
            </template>
            <template #content>
              <div class="flex justify-content-around flex-wrap gap-4 mt-4">
                <!-- Fundamental -->
                <!-- Fundamental -->
                <div class="flex flex-column items-center gap-3 border-1 surface-border p-3 border-round">
                  <Slider
                    v-model="fundamental" :min="80" :max="3000" orientation="vertical" class="h-12rem"
                    aria-label="Fundamental frequency, in hertz"
                  />
                  <div class="text-center">
                    <span class="block font-medium text-sm mb-1">Fund</span>
                    <span class="block text-xs text-500">{{ Math.round(fundamental) }} Hz</span>
                  </div>
                  <LfoControl
                    v-model="lfos.fundamental" label="Fund LFO" :param-min="80" :param-max="3000"
                    :lfo-phase="lfoPhases.fundamental" :lfo-phase-time="lfoPhaseTimes.fundamental" class="w-14rem"
                  />
                </div>

                <!-- Harmonics Count -->
                <div class="flex flex-column items-center gap-3 border-1 surface-border p-3 border-round">
                  <Slider
                    v-model="cantArmonicos" :min="1" :max="maxArmonicos" orientation="vertical" class="h-12rem"
                    aria-label="Number of partials"
                  />
                  <div class="text-center">
                    <span class="block font-medium text-sm mb-1">Count</span>
                    <span class="block text-xs text-500">
                      {{ armonicos.length }}<span v-if="droppedPartials > 0"> / {{ cantArmonicos }}</span>
                    </span>
                    <span v-if="droppedPartials > 0" class="block text-xs text-orange-400">
                      {{ droppedPartials }} above Nyquist
                    </span>
                  </div>
                  <LfoControl
                    v-model="lfos.cantArmonicos" label="Count LFO" :param-min="1" :param-max="10"
                    :lfo-phase="lfoPhases.cantArmonicos" :lfo-phase-time="lfoPhaseTimes.cantArmonicos"
                    class="w-14rem"
                  />
                </div>

                <!-- Offset -->
                <div
                  class="flex flex-column items-center gap-3 border-1 surface-border p-3 border-round"
                  title="Offset shifts the starting partial"
                >
                  <Slider
                    v-model="offset" :min="0" :max="20" orientation="vertical" class="h-12rem"
                    aria-label="Offset of the starting partial"
                  />
                  <div class="text-center">
                    <span class="block font-medium text-sm mb-1">Offset</span>
                    <span class="block text-xs text-500">{{ Number(offset).toFixed(1) }}</span>
                    <span class="block text-xs text-500">shifts starting partial</span>
                  </div>
                  <LfoControl
                    v-model="lfos.offset" label="Offset LFO" :param-min="0" :param-max="20"
                    :lfo-phase="lfoPhases.offset" :lfo-phase-time="lfoPhaseTimes.offset" class="w-14rem"
                  />
                </div>

                <!-- Volume -->

                <div class="flex flex-column items-center gap-3 border-1 surface-border p-3 border-round">
                  <Slider
                    v-model="volumeSlider" :min="0" :max="100" orientation="vertical" class="h-12rem"
                    aria-label="Volume"
                  />
                  <div class="text-center">
                    <span class="block font-medium text-sm mb-1">Vol</span>
                    <span class="block text-xs text-500">{{ isMuted ? 'Mute' : Math.round(volumeDb) + ' dB' }}</span>
                  </div>
                </div>
              </div>
            </template>
          </Card>
        </div>

        <!-- Arpeggiator Controls (Right) -->
        <div class="col-12 md:col-4">
          <Card class="shadow-2">
            <template #title>
              <div class="flex items-center justify-content-between">
                <span>Arpeggiator</span>
                <Button
                  :icon="arpeggiatorActive ? 'pi pi-stop' : 'pi pi-play'" :severity="arpeggiatorActive ? 'danger' : 'success'"
                  rounded text :aria-label="arpeggiatorActive ? 'Stop the arpeggiator' : 'Start the arpeggiator'"
                  @click="toggleArpeggiator"
                />
              </div>
            </template>
            <template #content>
              <div class="grid">
                <div class="col-12 md:col-7 flex flex-column gap-1">
                  <label class="text-sm font-medium text-500">Pattern</label>
                  <Dropdown
                    v-model="arpeggiatorType" :options="arpeggiatorTypes" option-label="label"
                    option-value="value" class="w-full" aria-label="Arpeggiator pattern"
                  />
                </div>
                <div class="col-12 md:col-5 flex flex-column gap-1">
                  <div class="flex justify-content-between">
                    <label class="text-sm font-medium text-500">Tempo</label>
                    <span class="text-sm font-bold">{{ arpeggiatorTempo }}ms</span>
                  </div>
                  <Slider v-model="arpeggiatorTempo" :min="50" :max="500" :step="10" aria-label="Arpeggiator tempo, in milliseconds" />
                </div>
              </div>
            </template>
          </Card>

          <!-- Ping-Pong Delay -->
          <Card class="mt-3 shadow-2">
            <template #title>
              <div class="flex items-center gap-2">
                <i class="pi pi-arrow-right-arrow-left text-primary" />
                <span>Ping-Pong Delay</span>
              </div>
            </template>
            <template #content>
              <div class="flex flex-column gap-4 mt-3">
                <div class="flex flex-column gap-2">
                  <div class="flex justify-content-between">
                    <label class="text-sm font-medium text-500">Send</label>
                    <span class="text-sm font-bold">{{ delaySend }}%</span>
                  </div>
                  <Slider v-model="delaySend" :min="0" :max="100" aria-label="Delay send, in percent" />
                </div>
                <div class="flex flex-column gap-2">
                  <div class="flex justify-content-between">
                    <label class="text-sm font-medium text-500">Time</label>
                    <span class="text-sm font-bold">{{ (delayTime * 1000).toFixed(0) }}ms</span>
                  </div>
                  <Slider v-model="delayTime" :min="0.05" :max="1" :step="0.01" aria-label="Delay time, in seconds" />
                </div>
                <div class="flex flex-column gap-2">
                  <div class="flex justify-content-between">
                    <label class="text-sm font-medium text-500">Feedback</label>
                    <span class="text-sm font-bold">{{ (delayFeedback * 100).toFixed(0) }}%</span>
                  </div>
                  <Slider v-model="delayFeedback" :min="0" :max="0.9" :step="0.01" aria-label="Delay feedback, in percent" />
                </div>
              </div>
            </template>
          </Card>

          <!-- Export to WAV -->
          <Card class="mt-3 shadow-2">
            <template #title>
              <div class="flex items-center gap-2">
                <i class="pi pi-download text-primary" />
                <span>Export</span>
              </div>
            </template>
            <template #content>
              <div class="flex flex-column gap-3 mt-3">
                <Button
                  :label="exporting ? 'Rendering...' : 'Export WAV'"
                  :icon="exporting ? 'pi pi-spin pi-spinner' : 'pi pi-download'" :disabled="exporting"
                  @click="exportWavFile"
                />
                <p class="text-xs text-500 m-0">
                  Renders 6 s of the current harmonic series with the ping-pong delay.
                  The arpeggiator and the LFOs are not included.
                </p>
              </div>
            </template>
          </Card>

          <!-- Spectrum Analyser -->
          <Card class="mt-3 shadow-2">
            <template #title>
              <div class="flex items-center gap-2">
                <i class="pi pi-chart-bar text-primary" />
                <span>Spectrum</span>
              </div>
            </template>
            <template #content>
              <SpectrumView :analyser="analyser" :active="audioStarted" class="mt-3" />
            </template>
          </Card>
        </div>

        <!-- Visualization (Bottom) -->
        <div class="col-12">
          <div class="flex flex-wrap gap-2 justify-content-center mt-3">
            <Tag
              v-for="(item, idx) in armonicos" :key="idx" :value="Math.round(item)"
              :severity="arpeggiatorActive && idx === activeArpeggioIndex ? 'danger' : 'primary'"
              class="text-base px-3 py-2 border-round-xl w-6rem justify-content-center"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Keyboard Shortcuts -->
    <Dialog v-model:visible="showShortcuts" header="Keyboard Shortcuts" modal style="width: 26rem">
      <ul class="list-none p-0 m-0 flex flex-column gap-3">
        <li v-for="shortcut in shortcuts" :key="shortcut.keys" class="flex align-items-center gap-3">
          <Tag :value="shortcut.keys" class="font-mono" />
          <span class="text-sm text-500">{{ shortcut.description }}</span>
        </li>
      </ul>
    </Dialog>

    <Toast position="bottom-right" />
  </div>
</template>

<style scoped>
  @keyframes float {
    0% {
      transform: translateY(0px);
    }

    50% {
      transform: translateY(-20px);
    }

    100% {
      transform: translateY(0px);
    }
  }

  .hero-image {
    animation: float 6s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-image {
      animation: none;
    }
  }
</style>

<style scoped></style>
