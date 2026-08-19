import { createNativeError } from "./nativeError.js";

export type NativeButton = "left" | "middle" | "right";
const aliases: Record<string, NativeButton> = {
  left: "left",
  middle: "middle",
  primary: "left",
  right: "right",
  secondary: "right",
};

export const resolveButton = (name = "left"): NativeButton => {
  const button = aliases[name.toLowerCase()];
  if (button) return button;
  throw createNativeError("UNKNOWN_NATIVE_BUTTON", `Unsupported mouse button "${name}".`);
};
