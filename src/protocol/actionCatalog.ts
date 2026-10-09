import { browserControlActions } from "./actions/browserControlActions.js";
import { compoundActions } from "./actions/compoundActions.js";
import { deviceDataActions } from "./actions/deviceDataActions.js";
import { formFileActions } from "./actions/formFileActions.js";
import { inspectionActions } from "./actions/inspectionActions.js";
import { keyboardTextActions } from "./actions/keyboardTextActions.js";
import { mediaBrowserDataActions } from "./actions/mediaBrowserDataActions.js";
import { pointerActions } from "./actions/pointerActions.js";
import { scrollTouchActions } from "./actions/scrollTouchActions.js";
import { stateNetworkActions } from "./actions/stateNetworkActions.js";
import { waitingActions } from "./actions/waitingActions.js";
import type { ActionDefinition } from "./actionDefinition.js";
import type { ActionRequest } from "../types/action.js";
import type { InputEngine } from "../types/settings.js";

export const actionCatalog = [
  ...pointerActions,
  ...scrollTouchActions,
  ...keyboardTextActions,
  ...formFileActions,
  ...inspectionActions,
  ...browserControlActions,
  ...waitingActions,
  ...deviceDataActions,
  ...stateNetworkActions,
  ...mediaBrowserDataActions,
  ...compoundActions,
].flatMap((definition): ActionDefinition[] => {
  const engines = definition.category === "nativeUI" || ["setInputFiles", "openDownload", "revealDownload", "blur"].includes(definition.name)
    ? definition.engines.filter((engine) => engine !== "native") : definition.engines;
  return engines.length ? [{ ...definition, engines }] : [];
});

export const getActionDefinition = (name: string) =>
  actionCatalog.find((definition) => definition.name === name);

const inputCategories = new Set(["pointer", "scroll", "keyboard", "text", "form", "drag", "dom", "events", "nativeUI"]);
const inputCompounds = new Set([
  "clickElement", "fillField", "chooseOption", "dragElement", "findAndClick", "findAndFill",
  "scrollUntilFound", "clickUntilGone", "submitAndWait", "copy", "cut", "paste",
]);

export const isInputEngine = (value: unknown): value is InputEngine =>
  value === "auto" || value === "browser" || value === "native";

export const resolveInputEngine = (configured?: InputEngine, extension?: InputEngine): InputEngine =>
  configured && configured !== "auto" ? configured : extension || "auto";

export const isInputAction = (definition?: ActionDefinition) => Boolean(definition && !definition.readOnly &&
  (inputCategories.has(definition.category) || inputCompounds.has(definition.name)));

export const getInputActionCatalog = (inputEngine: InputEngine): readonly ActionDefinition[] =>
  inputEngine === "auto" ? actionCatalog : actionCatalog.flatMap((definition): ActionDefinition[] =>
    !isInputAction(definition) ? [definition] : definition.engines.some((engine) => engine === inputEngine)
      ? [{ ...definition, engines: [inputEngine] }] : []);

export const resolveInputAction = (request: ActionRequest, extension?: InputEngine): ActionRequest => {
  const inputEngine = resolveInputEngine(request.inputEngine, extension);
  const definition = getActionDefinition(request.action);
  if (inputEngine === "auto" || !isInputAction(definition)) return request;
  if (!definition?.engines.some((engine) => engine === inputEngine))
    throw new Error(`Action "${request.action}" is unavailable with ${inputEngine} input.`);
  if (request.engine && request.engine !== "auto" && request.engine !== inputEngine)
    throw new Error(`Action "${request.action}" requires the ${inputEngine} input engine.`);
  return { ...request, engine: inputEngine };
};
