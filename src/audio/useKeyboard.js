import { onMounted, onUnmounted } from 'vue'

// The shortcuts are ignored while the user is typing in a form control, so the
// keyboard navigation is never hijacked
export function isTypingTarget(target) {
  if (!target || !target.tagName) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option') return true
  if (target.isContentEditable) return true
  return false
}

// Elements that use the space bar on their own: a focused button is activated
// with it, so the shortcut must not steal the key
export function hasNativeKeyHandling(target) {
  if (!target || !target.tagName) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'button' || tag === 'a' || tag === 'summary') return true
  const role = typeof target.getAttribute === 'function' ? target.getAttribute('role') : target.role
  return role === 'button' || role === 'link'
}

// Maps a key event to a shortcut. Returns null when the key does not trigger
// any of them.
export function resolveShortcut(event) {
  if (!event) return null
  if (event.defaultPrevented) return null
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  const target = event.target
  if (isTypingTarget(target)) return null

  const key = typeof event.key === 'string' ? event.key : ''
  if (key === ' ') {
    if (hasNativeKeyHandling(target)) return null
    return { action: 'space' }
  }
  if (key === 'Escape') return { action: 'panic' }
  if (key === '?' || key === 'h' || key === 'H') return { action: 'help' }
  if (key.length === 1 && key >= '1' && key <= '4') return { action: 'pattern', value: Number(key) - 1 }
  const lower = key.toLowerCase()
  if (lower === 'm') return { action: 'mute' }
  if (lower === 'l') return { action: 'lfos' }
  return null
}

// Name of the handler of every shortcut
const HANDLERS = {
  space: 'onSpace',
  panic: 'onPanic',
  help: 'onToggleHelp',
  pattern: 'onPattern',
  mute: 'onToggleMute',
  lfos: 'onToggleLfos'
}

// Registers a single keydown listener on the window
export function useKeyboard(handlers = {}) {
  function handleKeydown(event) {
    const shortcut = resolveShortcut(event)
    if (!shortcut) return
    const name = HANDLERS[shortcut.action]
    const handler = name ? handlers[name] : null
    if (!handler) return
    event.preventDefault()
    handler(shortcut.value)
  }

  // The listener is registered in the capture phase: the help panel can then
  // take the priority over the panic, because the dialog closes itself before
  // the event reaches the window
  onMounted(() => window.addEventListener('keydown', handleKeydown, true))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown, true))

  return { handleKeydown }
}
