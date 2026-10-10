// jsdom has no layout engine; React Flow needs these browser APIs to mount.
// Reports every observed element as measured, which lets React Flow compute node handles and therefore draw edges.
class RO {
  constructor(private cb: ResizeObserverCallback) {}
  observe(el: Element) {
    queueMicrotask(() =>
      this.cb([{ target: el, contentRect: el.getBoundingClientRect() } as ResizeObserverEntry], this as unknown as ResizeObserver),
    );
  }
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = RO;
Element.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, top: 0, left: 0, right: 44, bottom: 44, width: 44, height: 44, toJSON() {} } as DOMRect;
};
(globalThis as any).DOMMatrixReadOnly =
  (globalThis as any).DOMMatrixReadOnly ??
  class {
    m22 = 1;
    constructor(_t?: string) {}
  };
window.matchMedia =
  window.matchMedia ??
  ((q: string) =>
    ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as any);
Object.defineProperties(HTMLElement.prototype, {
  offsetHeight: { get: () => 600 },
  offsetWidth: { get: () => 900 },
});
