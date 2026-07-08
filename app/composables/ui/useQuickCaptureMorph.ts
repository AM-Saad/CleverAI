import type { ComponentPublicInstance } from "vue";
import { useViewTransitionMorph } from "~/composables/ui/useViewTransitionMorph";

type TemplateRefEl = Element | ComponentPublicInstance | null;

export function useQuickCaptureMorph<TAction extends string>() {
  const actionEls = new Map<TAction, HTMLElement>();
  const { morph, armMorphTarget, morphing } = useViewTransitionMorph();

  function setActionElement(action: TAction, el: TemplateRefEl) {
    if (el instanceof HTMLElement) {
      actionEls.set(action, el);
      return;
    }
    actionEls.delete(action);
  }

  function actionElement(action: TAction) {
    const el = actionEls.get(action);
    return el?.isConnected ? el : null;
  }

  async function morphFromAction(
    action: TAction,
    event: MouseEvent | undefined,
    update: () => void | Promise<void>,
  ) {
    const trigger =
      event?.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : actionElement(action);
    await morph({ from: trigger, update });
  }

  async function morphToAction(
    action: TAction,
    update: () => void | Promise<void>,
  ) {
    await morph({ to: () => actionElement(action), update });
  }

  return {
    morph,
    armMorphTarget,
    morphing,
    setActionElement,
    morphFromAction,
    morphToAction,
  };
}
