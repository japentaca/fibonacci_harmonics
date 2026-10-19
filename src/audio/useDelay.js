import { ref, watch } from 'vue'
import * as Tone from 'tone'

export function useDelay() {
  const delaySend = ref(25)
  const delayTime = ref(0.25)
  const delayFeedback = ref(0.4)

  let delayNode = null
  let delaySendGain = null

  // Stereo ping-pong delay. The node is created before the master chain and
  // connected to it afterwards.
  function createNodes() {
    delayNode = new Tone.PingPongDelay(delayTime.value, delayFeedback.value)
    delaySendGain = new Tone.Gain(delaySend.value / 100)
    delaySendGain.connect(delayNode)
    delayNode.wet.value = 1
  }

  function connectTo(masterBus, limiter) {
    if (!delayNode || !delaySendGain) return
    masterBus.connect(delaySendGain)
    delayNode.connect(limiter)
  }

  watch(delaySend, () => {
    if (delaySendGain) {
      delaySendGain.gain.rampTo(delaySend.value / 100, 0.05)
    }
  })
  watch(delayTime, () => {
    if (delayNode) {
      delayNode.delayTime.rampTo(delayTime.value, 0.05)
    }
  })
  watch(delayFeedback, () => {
    if (delayNode) {
      delayNode.feedback.rampTo(delayFeedback.value, 0.05)
    }
  })

  function dispose() {
    if (delayNode) {
      delayNode.dispose()
      delayNode = null
    }
    if (delaySendGain) {
      delaySendGain.dispose()
      delaySendGain = null
    }
  }

  return {
    delaySend,
    delayTime,
    delayFeedback,
    createNodes,
    connectTo,
    dispose
  }
}
