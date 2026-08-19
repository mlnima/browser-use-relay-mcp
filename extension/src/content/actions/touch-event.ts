import type { JsonValue } from "../../../../src/types/json.js";

const eventOptions = (params?: Record<string, JsonValue>) => ({
  bubbles: params?.bubbles !== false,
  cancelable: params?.cancelable !== false,
  composed: params?.composed !== false,
});

const records = (value: JsonValue | undefined): Record<string, JsonValue>[] => Array.isArray(value)
  ? value.filter((item): item is Record<string, JsonValue> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
  : [];

const createTouches = (value: JsonValue | undefined, target: EventTarget) => records(value).map((point, index) => {
  const clientX = Number(point.clientX ?? point.x ?? 0);
  const clientY = Number(point.clientY ?? point.y ?? 0);
  return new Touch({
    identifier: Number(point.identifier ?? point.id ?? index),
    target,
    clientX,
    clientY,
    screenX: Number(point.screenX ?? clientX),
    screenY: Number(point.screenY ?? clientY),
    pageX: Number(point.pageX ?? clientX + scrollX),
    pageY: Number(point.pageY ?? clientY + scrollY),
    radiusX: Number(point.radiusX ?? 1),
    radiusY: Number(point.radiusY ?? 1),
    rotationAngle: Number(point.rotationAngle ?? 0),
    force: Number(point.force ?? point.pressure ?? 1),
  });
});

export const createTouchEvent = (type: string, params: Record<string, JsonValue> | undefined, target: EventTarget): Event => {
  if (typeof TouchEvent === "undefined" || typeof Touch === "undefined") return new Event(type, eventOptions(params));
  try {
    const source = params?.touches ?? params?.points;
    const changedSource = params?.changedTouches ?? source;
    const ended = /(?:end|cancel)$/i.test(type);
    const touches = ended && params?.touches === undefined ? [] : createTouches(source, target);
    const changedTouches = createTouches(changedSource, target);
    const targetTouches = params?.targetTouches === undefined ? touches : createTouches(params.targetTouches, target);
    return new TouchEvent(type, { ...eventOptions(params), touches, changedTouches, targetTouches });
  } catch {
    return new Event(type, eventOptions(params));
  }
};
