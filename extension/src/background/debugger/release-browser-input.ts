import { releaseHeldKeys } from "./key-events";
import { cancelActiveIme } from "./ime-state";
import { releaseHeldMouse } from "./mouse-input";
import { releaseHeldPens } from "./pen-input";
import { cancelHeldTouches } from "./touch-input";
import { drainSerializedInput } from "./debugger-session.js";

export const releaseBrowserInput = async () => {
  await drainSerializedInput();
  await Promise.allSettled([
    releaseHeldMouse(),
    releaseHeldPens(),
    cancelHeldTouches(),
    cancelActiveIme(),
  ]);
  await releaseHeldKeys();
};
