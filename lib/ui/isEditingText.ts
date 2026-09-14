/**
 * True when a keystroke belongs to a text field, not the canvas.
 *
 * Canvas shortcuts (H for hand, Backspace to delete a node) must not fire while
 * someone is typing in notes, the code pane, or any input — otherwise deleting
 * a caption also deletes the selected diagram nodes.
 */
export function isEditingText(target: EventTarget | null = document.activeElement): boolean {
  if (!target || !(target instanceof HTMLElement)) return false

  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  if (target.closest('[contenteditable="true"]')) return true
  if (target.closest('[data-notes-root]')) return true

  return false
}
