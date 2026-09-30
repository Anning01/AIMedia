import '@testing-library/jest-dom/vitest'

// jsdom has no text layout. ProseMirror measures the selection on the animation
// frame after focus; real geometry and scrolling are covered in Electron tests.
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(0, 0, 0, 0),
  })
}
if (typeof Range.prototype.getClientRects !== 'function') {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => Object.assign([], { item: () => null }),
  })
}
