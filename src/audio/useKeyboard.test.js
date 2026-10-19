import test from 'node:test'
import assert from 'node:assert/strict'
import { isTypingTarget, hasNativeKeyHandling, resolveShortcut } from './useKeyboard.js'

function fakeTag(tagName, extra = {}) {
  return { tagName, ...extra }
}

function fakeEvent(key, target = fakeTag('DIV'), extra = {}) {
  return { key, target, preventDefault() {}, ...extra }
}

test('the shortcuts are ignored while typing in a form control', () => {
  assert.equal(isTypingTarget(fakeTag('INPUT')), true)
  assert.equal(isTypingTarget(fakeTag('TEXTAREA')), true)
  assert.equal(isTypingTarget(fakeTag('SELECT')), true)
  assert.equal(isTypingTarget(fakeTag('OPTION')), true)
})

test('the shortcuts are ignored in a contenteditable element', () => {
  assert.equal(isTypingTarget(fakeTag('DIV', { isContentEditable: true })), true)
  assert.equal(isTypingTarget(fakeTag('DIV', { isContentEditable: false })), false)
})

test('the shortcuts work on the rest of the page', () => {
  assert.equal(isTypingTarget(fakeTag('DIV')), false)
  assert.equal(isTypingTarget(fakeTag('BUTTON')), false)
  assert.equal(isTypingTarget(fakeTag('CANVAS')), false)
  assert.equal(isTypingTarget(null), false)
  assert.equal(isTypingTarget(undefined), false)
})

test('the space bar is left to the elements that use it on their own', () => {
  assert.equal(hasNativeKeyHandling(fakeTag('BUTTON')), true)
  assert.equal(hasNativeKeyHandling(fakeTag('A')), true)
  assert.equal(hasNativeKeyHandling(fakeTag('DIV', { getAttribute: () => 'button' })), true)
  assert.equal(hasNativeKeyHandling(fakeTag('DIV')), false)
  assert.equal(resolveShortcut(fakeEvent(' ', fakeTag('BUTTON'))), null)
  assert.deepEqual(resolveShortcut(fakeEvent(' ', fakeTag('DIV'))), { action: 'space' })
})

test('every shortcut is mapped to its action', () => {
  assert.deepEqual(resolveShortcut(fakeEvent(' ')), { action: 'space' })
  assert.deepEqual(resolveShortcut(fakeEvent('Escape')), { action: 'panic' })
  assert.deepEqual(resolveShortcut(fakeEvent('?')), { action: 'help' })
  assert.deepEqual(resolveShortcut(fakeEvent('h')), { action: 'help' })
  assert.deepEqual(resolveShortcut(fakeEvent('H')), { action: 'help' })
  assert.deepEqual(resolveShortcut(fakeEvent('m')), { action: 'mute' })
  assert.deepEqual(resolveShortcut(fakeEvent('M')), { action: 'mute' })
  assert.deepEqual(resolveShortcut(fakeEvent('l')), { action: 'lfos' })
  assert.deepEqual(resolveShortcut(fakeEvent('L')), { action: 'lfos' })
})

test('the numbers one to four select the arpeggiator pattern', () => {
  assert.deepEqual(resolveShortcut(fakeEvent('1')), { action: 'pattern', value: 0 })
  assert.deepEqual(resolveShortcut(fakeEvent('2')), { action: 'pattern', value: 1 })
  assert.deepEqual(resolveShortcut(fakeEvent('3')), { action: 'pattern', value: 2 })
  assert.deepEqual(resolveShortcut(fakeEvent('4')), { action: 'pattern', value: 3 })
  assert.equal(resolveShortcut(fakeEvent('5')), null)
  assert.equal(resolveShortcut(fakeEvent('0')), null)
})

test('the shortcuts are ignored with a modifier, in a form control or when the key was already handled', () => {
  assert.equal(resolveShortcut(fakeEvent('m', fakeTag('DIV'), { ctrlKey: true })), null)
  assert.equal(resolveShortcut(fakeEvent('m', fakeTag('DIV'), { metaKey: true })), null)
  assert.equal(resolveShortcut(fakeEvent('m', fakeTag('DIV'), { altKey: true })), null)
  assert.equal(resolveShortcut(fakeEvent('m', fakeTag('INPUT'))), null)
  assert.equal(resolveShortcut(fakeEvent('m', fakeTag('DIV'), { defaultPrevented: true })), null)
  assert.equal(resolveShortcut(fakeEvent('F1')), null)
  assert.equal(resolveShortcut(null), null)
})
