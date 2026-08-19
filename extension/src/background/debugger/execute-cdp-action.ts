import type { ActionRequest } from "../../../../src/types/action.js";
import type { JsonValue } from "../../../../src/types/json.js";
import { resolveTabId } from "../actions/tab";
import { executeBrowserTextAction } from "./browser-text-actions";
import { executeCdpPageAction } from "./cdp-page-actions";
import { executeKeyboardInput } from "./keyboard-input";
import { executeMouseInput } from "./mouse-input";
import { executeTouchInput } from "./touch-input";
import { executeWheelInput } from "./wheel-input";
import { executePenInput } from "./pen-input";
import { executeEvaluationAction } from "./evaluation-action";
import { runSerializedInput } from "./debugger-session.js";

const executors = [
  executeCdpPageAction,
  executeEvaluationAction,
  executeMouseInput,
  executeWheelInput,
  executePenInput,
  executeTouchInput,
  executeBrowserTextAction,
  executeKeyboardInput,
];

const aliases: Record<string, string> = {
  clickElement: "leftClick",
  findAndClick: "leftClick",
  dragElement: "dragAndDrop",
  fillField: "setValue",
  findAndFill: "setValue",
  submitAndWait: "submitForm",
};
const statefulInputActions = new Set([
  "move", "moveTo", "hover", "unhover", "mouseDown", "mouseUp", "leftClick", "middleClick", "rightClick", "doubleClick", "tripleClick", "clickAndHold", "release", "longPress", "contextMenu", "modifierClick",
  "dragStart", "dragMove", "dragEnd", "dragAndDrop", "dragToElement", "dragToCoordinates", "dragScrollbar", "dragSlider", "selectTextByDragging",
  "scrollUp", "scrollDown", "scrollLeft", "scrollRight", "scrollBy", "wheel", "pen",
  "tap", "doubleTap", "longTap", "touchStart", "touchMove", "touchEnd", "touchCancel", "swipe", "pinchIn", "pinchOut", "multiTouch",
  "keyDown", "keyUp", "press", "type", "typeSlowly", "holdKey", "releaseKey", "repeatKey", "shortcut", "composeText", "undo", "redo", "copy", "cut", "paste",
  "focus", "blur", "clear", "setValue", "appendText", "replaceText", "insertText", "deleteText", "selectAll", "selectRange", "contentEditableInsert", "contentEditableDelete", "focusField", "blurField",
  "check", "uncheck", "toggleCheckbox", "selectRadio", "increment", "decrement", "submitForm",
  "setInputFiles", "clearFiles",
]);

export const executeCdpAction = async (request: ActionRequest, signal?: AbortSignal): Promise<JsonValue | undefined> => {
  const tabId = await resolveTabId(request.target?.tabId);
  const candidate = aliases[request.action] ? { ...request, action: aliases[request.action] } : request;
  const execute = async () => {
    for (const executor of executors) {
      signal?.throwIfAborted();
      const result = await executor(candidate, tabId, signal);
      if (result !== undefined) return result as JsonValue;
    }
    return undefined;
  };
  return statefulInputActions.has(candidate.action) ? runSerializedInput(tabId, signal, execute) : execute();
};
