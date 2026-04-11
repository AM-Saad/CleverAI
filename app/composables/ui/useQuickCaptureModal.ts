// Shared open/close state for the QuickCaptureModal.
// The single modal instance lives in QuickCaptureButton (layout layer).
// Any component can call `open()` to trigger it.
const _isOpen = ref(false);

export function useQuickCaptureModal() {
  function open() {
    _isOpen.value = true;
  }
  function close() {
    _isOpen.value = false;
  }
  return { isOpen: readonly(_isOpen), open, close, _isOpen };
}
