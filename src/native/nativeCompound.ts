import type { ActionRequest } from "../types/action.js";
import type { JsonValue } from "../types/json.js";
import { createNativeError } from "./nativeError.js";
import { assertNativeKeyAvailable, assertNativeTextKeysAvailable, tapNativeKeys } from "./nativeInputState.js";
import { assertNativeInputDuration, nativeInputDuration, nativeTypingPlan } from "./nativeInputLimits.js";
import { resolveKey } from "./nativeKeys.js";
import { optionalRequestPoint, stringArrayParam, textParam } from "./nativeParams.js";
import { executeNativePointerClick } from "./nativePointerClick.js";
import { executeNativePointerDrag } from "./nativePointerDrag.js";
import { executeNativeTextEditing } from "./nativeTextEditing.js";
import { typeNativeText } from "./nativeKeyboard.js";

const click = (request: ActionRequest, signal: AbortSignal) => {
  if (!optionalRequestPoint(request))
    throw createNativeError("NATIVE_COORDINATES_REQUIRED", "Native element clicking requires screen coordinates.");
  return executeNativePointerClick({ ...request, action: "leftClick" }, signal);
};

const fill = async (request: ActionRequest, signal: AbortSignal) => {
  if (!request.params || !Object.hasOwn(request.params, "value"))
    throw createNativeError("INVALID_NATIVE_PARAMETERS", "Native field filling requires parameter \"value\".");
  textParam(request, "value");
  if (!optionalRequestPoint(request))
    throw createNativeError("NATIVE_COORDINATES_REQUIRED", "Native field filling requires screen coordinates.");
  return executeNativeTextEditing({ ...request, action: "setValue" }, signal);
};

const choose = async (request: ActionRequest, signal: AbortSignal) => {
  const value = stringArrayParam(request, "values")?.[0] || textParam(request, "value");
  if (!value) throw createNativeError("INVALID_NATIVE_PARAMETERS", "Native option selection requires a nonempty value.");
  const typingMs = nativeTypingPlan(value, 0).durationMs;
  const enter = resolveKey("Enter");
  assertNativeKeyAvailable(enter);
  assertNativeTextKeysAvailable(value);
  if (!optionalRequestPoint(request))
    throw createNativeError("NATIVE_COORDINATES_REQUIRED", "Native option selection requires screen coordinates.");
  const pointerMs = request.params?.durationMs === undefined || request.params.durationMs === null
    ? 0 : nativeInputDuration(request.params.durationMs, 0, "Pointer durationMs");
  assertNativeInputDuration(pointerMs + typingMs, "Native option-selection duration");
  await click(request, signal);
  await typeNativeText(value, 0, signal);
  await tapNativeKeys([enter]);
  return { selected: value };
};

export const executeNativeCompound = async (
  request: ActionRequest,
  signal: AbortSignal,
): Promise<JsonValue | undefined> => {
  switch (request.action) {
    case "clickElement": case "findAndClick": return click(request, signal);
    case "fillField": case "findAndFill": return fill(request, signal);
    case "chooseOption": return choose(request, signal);
    case "dragElement": return executeNativePointerDrag({ ...request, action: "dragToCoordinates" }, signal);
    default:
      throw createNativeError(
        "NATIVE_COMPOUND_REQUIRES_BROWSER",
        `Action "${request.action}" requires browser or DOM state and cannot run only through OS input.`,
      );
  }
};
