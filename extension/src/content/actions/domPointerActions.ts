import type { ContentActionHandler } from "./types.js";
import { requireHtmlElement } from "./element";
import { requireActionableElement } from "./actionable-element";

const buttonNumber = (value: unknown) => value === "middle" || value === 1 ? 1 : value === "right" || value === 2 ? 2 : 0;
const buttonState = (button: number) => button === 0 ? 1 : button === 1 ? 4 : button === 2 ? 2 : 0;
const event = (type: string, requested: unknown = 0) => {
  const button = buttonNumber(requested);
  return new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, button, buttons: type === "mousedown" ? buttonState(button) : 0 });
};

export const domPointerActionHandlers: Record<string, ContentActionHandler> = {
  leftClick: async ({ target }) => (requireHtmlElement(target).click(), true),
  clickElement: async ({ target, resolveTarget, signal }) => (requireHtmlElement(await requireActionableElement(target, resolveTarget, signal)).click(), true),
  findAndClick: async ({ target, resolveTarget, signal }) => (requireHtmlElement(await requireActionableElement(target, resolveTarget, signal)).click(), true),
  doubleClick: async ({ target }) => requireHtmlElement(target).dispatchEvent(event("dblclick")),
  tripleClick: async ({ target }) => {
    const element = requireHtmlElement(target);
    for (let index = 0; index < 3; index += 1) element.click();
    return true;
  },
  rightClick: async ({ target }) => requireHtmlElement(target).dispatchEvent(event("contextmenu", 2)),
  contextMenu: async ({ target }) => requireHtmlElement(target).dispatchEvent(event("contextmenu", 2)),
  mouseDown: async ({ target, request }) => requireHtmlElement(target).dispatchEvent(event("mousedown", request.params?.button)),
  mouseUp: async ({ target, request }) => requireHtmlElement(target).dispatchEvent(event("mouseup", request.params?.button)),
  hover: async ({ target }) => requireHtmlElement(target).dispatchEvent(event("mouseover")),
  unhover: async ({ target }) => requireHtmlElement(target).dispatchEvent(event("mouseout")),
};
