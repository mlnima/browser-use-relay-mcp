import type { JsonValue } from "../../../../src/types/json.js";
import type { ActionTarget } from "../../../../src/types/action.js";
import { resolveTarget as resolveActionTarget } from "../catalog/resolve-target.js";
import type { ContentActionHandler } from "./types.js";
import { requireElement } from "./element.js";
import { createTouchEvent } from "./touch-event.js";

const eventOptions = (params?: Record<string, JsonValue>) => ({
  bubbles: params?.bubbles !== false,
  cancelable: params?.cancelable !== false,
  composed: params?.composed !== false,
});

const createEvent = (type: string, params: Record<string, JsonValue> | undefined, target: EventTarget) => {
  const options = { ...eventOptions(params), ...(params || {}) };
  if (/^(mouse|click|dblclick|contextmenu)/i.test(type)) return new MouseEvent(type, options as MouseEventInit);
  if (/^pointer/i.test(type)) return new PointerEvent(type, options as PointerEventInit);
  if (/^touch/i.test(type)) return createTouchEvent(type, params, target);
  if (/^key/i.test(type)) return new KeyboardEvent(type, options as KeyboardEventInit);
  if (type === "wheel") return new WheelEvent(type, options as WheelEventInit);
  if (/^(beforeinput|input)$/i.test(type)) return new InputEvent(type, options as InputEventInit);
  if (/^composition/i.test(type)) return new CompositionEvent(type, options as CompositionEventInit);
  if (/^drag|^drop$/i.test(type)) return new DragEvent(type, { ...options, dataTransfer: new DataTransfer() } as DragEventInit);
  return new Event(type, options);
};

const dragPoint = (element: Element) => {
  const bounds = element.getBoundingClientRect();
  return { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 };
};

const dispatchDrag = (
  element: Element,
  type: string,
  transfer: DataTransfer,
  relatedTarget?: EventTarget,
): boolean => element.dispatchEvent(new DragEvent(type, {
  bubbles: true,
  cancelable: true,
  composed: true,
  dataTransfer: transfer,
  relatedTarget,
  ...dragPoint(element),
}));

export const eventActionHandlers: Record<string, ContentActionHandler> = {
  dispatchEvent: async ({ target, request }) => {
    const type = String(request.params?.type ?? "");
    if (!type) throw new Error("An event type is required.");
    const element = requireElement(target);
    return element.dispatchEvent(createEvent(type, request.params, element));
  },
  dispatchCustomEvent: async ({ target, request }) => {
    const type = String(request.params?.type ?? "");
    if (!type) throw new Error("An event type is required.");
    return requireElement(target).dispatchEvent(new CustomEvent(type, { ...eventOptions(request.params), detail: request.params?.detail }));
  },
  dragWithData: async ({ target, request }) => {
    const source = requireElement(target);
    const rawDestination = request.params?.destination;
    if (!rawDestination || typeof rawDestination !== "object" || Array.isArray(rawDestination)) {
      throw new Error("dragWithData requires params.destination as an ActionTarget.");
    }
    const destination = requireElement(resolveActionTarget(rawDestination as unknown as ActionTarget));
    const transfer = new DataTransfer();
    const data = (request.params?.data || {}) as Record<string, string>;
    for (const [type, value] of Object.entries(data)) transfer.setData(type, value);
    request.params?.effectAllowed && (transfer.effectAllowed = String(request.params.effectAllowed) as DataTransfer["effectAllowed"]);
    request.params?.dropEffect && (transfer.dropEffect = String(request.params.dropEffect) as DataTransfer["dropEffect"]);
    if (!dispatchDrag(source, "dragstart", transfer)) return {
      dropped: false,
      cancelledAt: "dragstart",
      dropEffect: transfer.dropEffect,
      effectAllowed: transfer.effectAllowed,
    };
    let dropped = false;
    try {
      dispatchDrag(source, "drag", transfer);
      dispatchDrag(destination, "dragenter", transfer, source);
      dispatchDrag(source, "dragleave", transfer, destination);
      const accepted = !dispatchDrag(destination, "dragover", transfer, source);
      if (accepted) {
        dispatchDrag(destination, "drop", transfer, source);
        dropped = true;
      } else dispatchDrag(destination, "dragleave", transfer, source);
    } finally {
      dispatchDrag(source, "dragend", transfer, destination);
    }
    return { dropped, cancelledAt: dropped ? null : "dragover", dropEffect: transfer.dropEffect, effectAllowed: transfer.effectAllowed };
  },
};
