/**
 * Ease a container across a layout change CSS can't animate.
 *
 * Flex re-wrapping and line-count changes land in a single frame — there is no
 * property to transition, because nothing about the box is interpolating. Call
 * `easeReflow()` immediately *before* the state change that triggers the
 * reflow: it measures the height, lets the DOM settle, and if the height moved,
 * animates across the difference with `overflow: hidden` so the new content is
 * revealed rather than appearing all at once.
 *
 * Deliberately cheap to call: it no-ops when the height didn't change (the
 * common wide-screen case, where the row never changes line count), when there
 * is no element, and under `prefers-reduced-motion`.
 *
 * Duration and curve are read off the element so they track the design tokens
 * rather than pinning a second copy of the numbers here.
 */
export function useReflowEase() {
  const reflowEl = ref<HTMLElement | null>(null);

  async function easeReflow() {
    const el = reflowEl.value;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const from = el.getBoundingClientRect().height;
    await nextTick();
    const to = el.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) return;

    const styles = getComputedStyle(el);
    const previousOverflow = el.style.overflow;
    el.style.overflow = "hidden";
    const animation = el.animate(
      [{ height: `${from}px` }, { height: `${to}px` }],
      {
        duration:
          parseFloat(styles.getPropertyValue("--duration-normal")) || 200,
        easing: styles.getPropertyValue("--ease-exit").trim() || "ease",
      },
    );
    void animation.finished
      .catch(() => undefined)
      .finally(() => {
        el.style.overflow = previousOverflow;
      });
  }

  return { reflowEl, easeReflow };
}
