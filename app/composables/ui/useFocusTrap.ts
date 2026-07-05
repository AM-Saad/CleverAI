// app/composables/ui/useFocusTrap.ts
import { nextTick, onBeforeUnmount, watch, type Ref } from "vue";
import { getFocusableElements } from "~/composables/ui/useMotionCommon";

type FocusTrapTarget = HTMLElement | { $el?: unknown } | null;

export interface FocusTrapOptions {
  /** Called when the user presses Escape inside the trapped region */
  onEscape?: () => void;
  /** CSS selector to focus first when opened (falls back to first focusable, then panel) */
  initialFocus?: string;
  /** Restores focus to the previously focused element when the active trap closes */
  restoreFocus?: boolean;
  /** Passed to HTMLElement.focus(). Defaults to true to avoid page jumps behind overlays. */
  preventScroll?: boolean;
  /** Set false for inline panels that only need local Tab wrapping. */
  documentTrap?: boolean;
}

interface FocusTrapEntry {
  panelEl: Ref<FocusTrapTarget>;
  opts: FocusTrapOptions;
  lastFocusedEl: HTMLElement | null;
}

const activeTraps: FocusTrapEntry[] = [];
let listenersInstalled = false;
let redirectingFocus = false;

const isBrowser = () =>
  typeof document !== "undefined" && typeof window !== "undefined";

const resolveRoot = (target: FocusTrapTarget): HTMLElement | null => {
  if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
    return target;
  }

  const el =
    typeof target === "object" && target && "$el" in target ? target.$el : null;
  return typeof HTMLElement !== "undefined" && el instanceof HTMLElement
    ? el
    : null;
};

const getTopTrap = () => activeTraps[activeTraps.length - 1] ?? null;

function removeTrap(entry: FocusTrapEntry) {
  const index = activeTraps.indexOf(entry);
  if (index !== -1) activeTraps.splice(index, 1);

  if (!activeTraps.length && listenersInstalled && isBrowser()) {
    document.removeEventListener("keydown", onDocumentKeydown, true);
    document.removeEventListener("focusin", onDocumentFocusIn, true);
    listenersInstalled = false;
  }
}

function installListeners() {
  if (listenersInstalled || !isBrowser()) return;
  document.addEventListener("keydown", onDocumentKeydown, true);
  document.addEventListener("focusin", onDocumentFocusIn, true);
  listenersInstalled = true;
}

function focusElement(el: HTMLElement, opts: FocusTrapOptions) {
  try {
    el.focus({ preventScroll: opts.preventScroll ?? true });
  } catch {
    el.focus();
  }
}

function focusTrapRoot(root: HTMLElement, opts: FocusTrapOptions) {
  if (!root.hasAttribute("tabindex")) {
    root.tabIndex = -1;
  }
  focusElement(root, opts);
}

function getInitialFocus(root: HTMLElement, opts: FocusTrapOptions) {
  if (opts.initialFocus) {
    const target = root.querySelector<HTMLElement>(opts.initialFocus);
    if (target) return target;
  }

  return (
    root.querySelector<HTMLElement>("[autofocus]") ??
    getFocusableElements(root)[0] ??
    null
  );
}

function focusInside(entry: FocusTrapEntry) {
  const root = resolveRoot(entry.panelEl.value);
  if (!root) return;

  const target = getInitialFocus(root, entry.opts);
  if (target) {
    focusElement(target, entry.opts);
    return;
  }

  focusTrapRoot(root, entry.opts);
}

function scheduleFocusInside(entry: FocusTrapEntry) {
  if (!isBrowser()) return;
  nextTick(() => {
    requestAnimationFrame(() => {
      if (entry.opts.documentTrap === false || getTopTrap() === entry) {
        focusInside(entry);
      }
    });
  });
}

function restoreFocus(entry: FocusTrapEntry) {
  if (entry.opts.restoreFocus === false || !isBrowser()) return;
  requestAnimationFrame(() => {
    const target = entry.lastFocusedEl;
    if (!target?.isConnected || !document.contains(target)) return;
    focusElement(target, entry.opts);
  });
}

function handleTrapKeydown(entry: FocusTrapEntry, e: KeyboardEvent) {
  if (e.defaultPrevented) return;

  const root = resolveRoot(entry.panelEl.value);
  if (!root) return;

  if (e.key === "Escape" && entry.opts.onEscape) {
    entry.opts.onEscape();
    e.stopPropagation();
    e.preventDefault();
    return;
  }

  if (e.key !== "Tab") return;

  const focusableEls = getFocusableElements(root);
  if (!focusableEls.length) {
    focusTrapRoot(root, entry.opts);
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  const first = focusableEls[0];
  const last = focusableEls[focusableEls.length - 1];
  if (!first || !last) return;

  const activeEl = document.activeElement as HTMLElement | null;
  const activeInside =
    activeEl instanceof HTMLElement &&
    activeEl !== root &&
    root.contains(activeEl);

  if (!activeInside) {
    focusElement(e.shiftKey ? last : first, entry.opts);
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (e.shiftKey && activeEl === first) {
    focusElement(last, entry.opts);
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (!e.shiftKey && activeEl === last) {
    focusElement(first, entry.opts);
    e.preventDefault();
    e.stopPropagation();
  }
}

function onDocumentKeydown(e: KeyboardEvent) {
  const entry = getTopTrap();
  if (entry) handleTrapKeydown(entry, e);
}

function onDocumentFocusIn(e: FocusEvent) {
  const entry = getTopTrap();
  if (!entry || redirectingFocus) return;

  const root = resolveRoot(entry.panelEl.value);
  const target = e.target;
  if (!root || !(target instanceof Node) || root.contains(target)) return;

  redirectingFocus = true;
  requestAnimationFrame(() => {
    try {
      if (getTopTrap() === entry) focusInside(entry);
    } finally {
      redirectingFocus = false;
    }
  });
}

/**
 * Reusable focus trap for dialogs/drawers/sheets.
 * - Records previously focused element and restores it on close
 * - Moves focus inside on open (selector → first focusable → panel)
 * - Traps Tab/Shift+Tab within the region
 * - Keeps focus inside even if a dialog forgets a local keydown binding
 * - Only the topmost active trap handles keyboard/focus events
 */
export function useFocusTrap(
  active: Ref<boolean>,
  panelEl: Ref<FocusTrapTarget>,
  opts: FocusTrapOptions = {},
) {
  const entry: FocusTrapEntry = {
    panelEl,
    opts,
    lastFocusedEl: null,
  };

  watch(
    active,
    (isActive) => {
      if (!isBrowser()) return;

      if (isActive) {
        removeTrap(entry);
        entry.lastFocusedEl =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        if (opts.documentTrap !== false) {
          activeTraps.push(entry);
          installListeners();
        }
        scheduleFocusInside(entry);
        return;
      }

      const wasTopTrap = getTopTrap() === entry;
      removeTrap(entry);
      if (wasTopTrap || opts.documentTrap === false) restoreFocus(entry);
    },
    { immediate: true, flush: "post" },
  );

  watch(
    panelEl,
    () => {
      if (active.value && getTopTrap() === entry) scheduleFocusInside(entry);
    },
    { flush: "post" },
  );

  onBeforeUnmount(() => {
    const wasTopTrap = getTopTrap() === entry;
    removeTrap(entry);
    if (wasTopTrap || opts.documentTrap === false) restoreFocus(entry);
  });

  function onKeydown(e: KeyboardEvent) {
    if (opts.documentTrap === false || getTopTrap() === entry) {
      handleTrapKeydown(entry, e);
    }
  }

  return { onKeydown };
}
