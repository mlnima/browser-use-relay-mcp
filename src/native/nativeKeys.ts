import { platform } from "node:os";
import { MAX_NATIVE_CHORD_KEYS, MAX_NATIVE_SHORTCUT_CHARACTERS } from "./constants.js";
import { createNativeError } from "./nativeError.js";

export type NativeKey = Readonly<{ code: string }>;
const normalize = (value: string) => value.replace(/[\s_-]/g, "").toLowerCase();
const aliases: Record<string, string> = {
  alt: "LeftAlt",
  arrowdown: "Down",
  arrowleft: "Left",
  arrowright: "Right",
  arrowup: "Up",
  cmd: "LeftSuper",
  command: "LeftSuper",
  control: "LeftControl",
  ctrl: "LeftControl",
  del: "Delete",
  esc: "Escape",
  meta: "LeftSuper",
  option: "LeftAlt",
  return: "Enter",
  shift: "LeftShift",
  spacebar: "Space",
  win: "LeftSuper",
};
const generated = [
  ...Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ", (name) => [name, name.toLowerCase()]),
  ...Array.from({ length: 24 }, (_, index) => [`F${index + 1}`, `f${index + 1}`]),
  ...Array.from({ length: 10 }, (_, index) => [`${index}`, `${index}`]),
  ...Array.from({ length: 10 }, (_, index) => [`Digit${index}`, `${index}`]),
  ...Array.from({ length: 10 }, (_, index) => [`Num${index}`, `${index}`]),
  ...Array.from({ length: 10 }, (_, index) => [`NumPad${index}`, `numpad_${index}`]),
] as Array<[string, string]>;
const special: Record<string, string> = {
  Add: "add", AudioForward: "audio_forward", AudioMute: "audio_mute", AudioNext: "audio_next",
  AudioPause: "audio_pause", AudioPlay: "audio_play", AudioPrev: "audio_prev", AudioRandom: "audio_random",
  AudioRepeat: "audio_repeat", AudioRewind: "audio_rewind", AudioStop: "audio_stop", AudioVolDown: "audio_vol_down",
  AudioVolUp: "audio_vol_up", Backslash: "\\", Backspace: "backspace", CapsLock: "caps_lock",
  Clear: "clear", Comma: ",", Decimal: "numpad_decimal", Delete: "delete", Divide: "divide", Down: "down",
  End: "end", Enter: "enter", Equal: "=", Escape: "escape", Fn: "fn", Grave: "`", Home: "home",
  Insert: "insert", Left: "left", LeftAlt: "alt", LeftBracket: "[", LeftCmd: "cmd",
  LeftControl: "control", LeftMeta: "meta", LeftShift: "shift", LeftSuper: "meta", LeftWin: "win",
  Menu: "menu", Minus: "-", Multiply: "multiply", NumLock: "num_lock", NumPadEqual: "numpad_equal",
  PageDown: "pagedown", PageUp: "pageup", Period: ".", Print: "printscreen", Quote: "'", Return: "return",
  Right: "right", RightAlt: "right_alt", RightBracket: "]", RightCmd: "right_cmd",
  RightControl: "right_control", RightMeta: "right_meta", RightShift: "right_shift",
  RightSuper: "right_meta", RightWin: "right_win", ScrollLock: "scroll_lock", Semicolon: ";", Slash: "/",
  Space: "space", Subtract: "subtract", Tab: "tab", Up: "up",
};
const keys = new Map<string, NativeKey>(
  [...generated, ...Object.entries(special)].map(([name, code]) => [normalize(name), Object.freeze({ code })]),
);
const modifierCodes = new Set(["alt", "right_alt", "cmd", "right_cmd", "control", "right_control", "meta", "right_meta", "shift", "right_shift", "win", "right_win"]);
const textNames: Record<string, string> = {
  " ": "Space", "\t": "Tab", "\n": "Enter", "\r": "Enter", "`": "Grave", "~": "Grave", "-": "Minus", "_": "Minus", "=": "Equal", "+": "Equal",
  "[": "LeftBracket", "{": "LeftBracket", "]": "RightBracket", "}": "RightBracket", "\\": "Backslash", "|": "Backslash", ";": "Semicolon", ":": "Semicolon",
  "'": "Quote", "\"": "Quote", ",": "Comma", "<": "Comma", ".": "Period", ">": "Period", "/": "Slash", "?": "Slash",
  "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
};
const findKey = (name: string) => keys.get(normalize(aliases[normalize(name)] || name));

export const resolveKey = (name: string): NativeKey => {
  const key = findKey(name);
  if (key) return key;
  throw createNativeError("UNKNOWN_NATIVE_KEY", `Unsupported native key "${name}".`);
};
export const resolveTextKeys = (value: string) => [...new Set(Array.from(value, (character) =>
  findKey(/^[a-z0-9]$/i.test(character) ? character : textNames[character] || "")).filter((key): key is NativeKey => key !== undefined))];
export const assertNativeModifierKeys = (values: readonly NativeKey[]) => {
  if (values.some((key) => !modifierCodes.has(key.code)))
    throw createNativeError("INVALID_NATIVE_MODIFIER", "Native chord prefixes must be modifier keys.");
};
export const assertNativeChordLength = (length: number) => {
  if (length > MAX_NATIVE_CHORD_KEYS)
    throw createNativeError("NATIVE_CHORD_LIMIT", `Native key chords cannot exceed ${MAX_NATIVE_CHORD_KEYS} keys.`);
};

export const platformModifier = () =>
  platform() === "darwin" ? resolveKey("LeftSuper") : resolveKey("LeftControl");

export const resolveKeys = (values: readonly string[]) => {
  assertNativeChordLength(values.length);
  return values.map(resolveKey);
};

export const splitShortcut = (shortcut: string) => {
  if (shortcut.length > MAX_NATIVE_SHORTCUT_CHARACTERS)
    throw createNativeError("NATIVE_CHORD_LIMIT", `Native shortcuts cannot exceed ${MAX_NATIVE_SHORTCUT_CHARACTERS} characters.`);
  const values = shortcut.split("+").map((part) => part.trim()).filter(Boolean);
  assertNativeChordLength(values.length);
  return values;
};
