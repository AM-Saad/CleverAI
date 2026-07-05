import { computed, onScopeDispose, ref, unref, watch, type MaybeRefOrGetter } from "vue";

export interface DoubleTapConfirmOptions {
  /**
   * Time allowed between the first and second activation. After this window the
   * action returns to idle and the user must intentionally start again.
   */
  windowMs?: MaybeRefOrGetter<number | undefined>;
  disabled?: MaybeRefOrGetter<boolean | undefined>;
  loading?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Any identity that should reset the armed state when it changes, e.g. the id
   * of the row/item currently owning the delete action.
   */
  resetKey?: MaybeRefOrGetter<unknown>;
  onArm?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void | Promise<void>;
}

const DEFAULT_CONFIRM_WINDOW_MS = 2500;

function read<T>(value: MaybeRefOrGetter<T> | undefined): T | undefined {
  return typeof value === "function" ? (value as () => T)() : unref(value);
}

export function useDoubleTapConfirm(options: DoubleTapConfirmOptions = {}) {
  const isArmed = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const windowMs = computed(() => {
    const value = read(options.windowMs);
    return typeof value === "number" && value > 0 ? value : DEFAULT_CONFIRM_WINDOW_MS;
  });

  const isBlocked = computed(() => Boolean(read(options.disabled) || read(options.loading)));
  const resetKey = computed(() => read(options.resetKey));

  function clearTimer() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  function cancel({ notify = true }: { notify?: boolean } = {}) {
    if (!isArmed.value) return;
    isArmed.value = false;
    clearTimer();
    if (notify) options.onCancel?.();
  }

  function arm() {
    clearTimer();
    isArmed.value = true;
    options.onArm?.();
    timer = setTimeout(() => cancel(), windowMs.value);
  }

  async function trigger(): Promise<boolean> {
    if (isBlocked.value) return false;

    if (!isArmed.value) {
      arm();
      return false;
    }

    isArmed.value = false;
    clearTimer();
    await options.onConfirm?.();
    return true;
  }

  watch(isBlocked, (blocked) => {
    if (blocked) cancel({ notify: false });
  });

  watch(resetKey, () => cancel({ notify: false }));

  onScopeDispose(() => clearTimer());

  return {
    isArmed,
    trigger,
    cancel,
    arm,
  };
}
