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
] as const;

export const getActionDefinition = (name: string) =>
  actionCatalog.find((definition) => definition.name === name);
