import { executionError } from "../actions/execution-error.js";

export type KeyDefinition = { key: string; code: string; keyCode: number; text?: string; location?: number; isKeypad?: boolean };
const key = (value: string, code: string, keyCode: number, text?: string): KeyDefinition => ({ key: value, code, keyCode, ...(text !== undefined && { text }) });
const named: Record<string, KeyDefinition> = {
  enter: key("Enter", "Enter", 13), tab: key("Tab", "Tab", 9), escape: key("Escape", "Escape", 27),
  space: key(" ", "Space", 32, " "), backspace: key("Backspace", "Backspace", 8), delete: key("Delete", "Delete", 46),
  insert: key("Insert", "Insert", 45), home: key("Home", "Home", 36), end: key("End", "End", 35),
  pageup: key("PageUp", "PageUp", 33), pagedown: key("PageDown", "PageDown", 34),
  arrowleft: key("ArrowLeft", "ArrowLeft", 37), arrowup: key("ArrowUp", "ArrowUp", 38),
  arrowright: key("ArrowRight", "ArrowRight", 39), arrowdown: key("ArrowDown", "ArrowDown", 40),
  shift: { ...key("Shift", "ShiftLeft", 16), location: 1 }, control: { ...key("Control", "ControlLeft", 17), location: 1 },
  alt: { ...key("Alt", "AltLeft", 18), location: 1 }, meta: { ...key("Meta", "MetaLeft", 91), location: 1 }, altgraph: { ...key("AltGraph", "AltRight", 18), location: 2 },
  shiftright: { ...key("Shift", "ShiftRight", 16), location: 2 }, controlright: { ...key("Control", "ControlRight", 17), location: 2 },
  altright: { ...key("Alt", "AltRight", 18), location: 2 }, metaright: { ...key("Meta", "MetaRight", 92), location: 2 },
  capslock: key("CapsLock", "CapsLock", 20), numlock: key("NumLock", "NumLock", 144), scrolllock: key("ScrollLock", "ScrollLock", 145),
  pause: key("Pause", "Pause", 19), printscreen: key("PrintScreen", "PrintScreen", 44), contextmenu: key("ContextMenu", "ContextMenu", 93),
  clear: key("Clear", "Numpad5", 12), help: key("Help", "Help", 47), cancel: key("Cancel", "Cancel", 3),
  browserback: key("BrowserBack", "BrowserBack", 166), browserforward: key("BrowserForward", "BrowserForward", 167),
  browserrefresh: key("BrowserRefresh", "BrowserRefresh", 168), browserstop: key("BrowserStop", "BrowserStop", 169),
  browsersearch: key("BrowserSearch", "BrowserSearch", 170), browserfavorites: key("BrowserFavorites", "BrowserFavorites", 171), browserhome: key("BrowserHome", "BrowserHome", 172),
  audiovolumemute: key("AudioVolumeMute", "AudioVolumeMute", 173), audiovolumedown: key("AudioVolumeDown", "AudioVolumeDown", 174),
  audiovolumeup: key("AudioVolumeUp", "AudioVolumeUp", 175), mediatracknext: key("MediaTrackNext", "MediaTrackNext", 176),
  mediatrackprevious: key("MediaTrackPrevious", "MediaTrackPrevious", 177), mediastop: key("MediaStop", "MediaStop", 178),
  mediaplaypause: key("MediaPlayPause", "MediaPlayPause", 179), launchmail: key("LaunchMail", "LaunchMail", 180),
  launchmediaplayer: key("LaunchMediaPlayer", "LaunchMediaPlayer", 181), process: key("Process", "", 229),
  dead: key("Dead", "", 0), unidentified: key("Unidentified", "", 0),
};
const aliases: Record<string, string> = {
  return: "enter", esc: "escape", spacebar: "space", del: "delete", ins: "insert", left: "arrowleft", up: "arrowup", right: "arrowright", down: "arrowdown",
  pgup: "pageup", pgdn: "pagedown", ctrl: "control", cmd: "meta", command: "meta", os: "meta", option: "alt", menu: "contextmenu", apps: "contextmenu",
  leftshift: "shift", shiftleft: "shift", leftcontrol: "control", controlleft: "control", leftctrl: "control", leftalt: "alt", altleft: "alt", leftmeta: "meta", metaleft: "meta",
  rightshift: "shiftright", rightcontrol: "controlright", rightctrl: "controlright", rightalt: "altright", rightmeta: "metaright", plus: "+", minus: "-",
  volumedown: "audiovolumedown", volumeup: "audiovolumeup", volumemute: "audiovolumemute", medianexttrack: "mediatracknext",
  mediaprevioustrack: "mediatrackprevious", mediaplay: "mediaplaypause", mediapause: "mediaplaypause", numpadplus: "numpadadd", numpadminus: "numpadsubtract",
};
const punctuation: Record<string, [string, number]> = {
  ";": ["Semicolon", 186], "=": ["Equal", 187], ",": ["Comma", 188], "-": ["Minus", 189], ".": ["Period", 190], "/": ["Slash", 191],
  "`": ["Backquote", 192], "[": ["BracketLeft", 219], "\\": ["Backslash", 220], "]": ["BracketRight", 221], "'": ["Quote", 222],
  ":": ["Semicolon", 186], "+": ["Equal", 187], "<": ["Comma", 188], "_": ["Minus", 189], ">": ["Period", 190], "?": ["Slash", 191],
  "~": ["Backquote", 192], "{": ["BracketLeft", 219], "|": ["Backslash", 220], "}": ["BracketRight", 221], "\"": ["Quote", 222],
  "!": ["Digit1", 49], "@": ["Digit2", 50], "#": ["Digit3", 51], "$": ["Digit4", 52], "%": ["Digit5", 53], "^": ["Digit6", 54], "&": ["Digit7", 55], "*": ["Digit8", 56], "(": ["Digit9", 57], ")": ["Digit0", 48],
};
for (let index = 1; index <= 24; index += 1) named[`f${index}`] = key(`F${index}`, `F${index}`, 111 + index);
for (let index = 0; index <= 9; index += 1) named[`numpad${index}`] = { ...key(String(index), `Numpad${index}`, 96 + index, String(index)), location: 3, isKeypad: true };
for (const [name, value, code, keyCode] of [
  ["numpadadd", "+", "NumpadAdd", 107], ["numpadsubtract", "-", "NumpadSubtract", 109], ["numpadmultiply", "*", "NumpadMultiply", 106],
  ["numpaddivide", "/", "NumpadDivide", 111], ["numpaddecimal", ".", "NumpadDecimal", 110], ["numpadenter", "Enter", "NumpadEnter", 13],
  ["numpadequal", "=", "NumpadEqual", 187], ["numpadcomma", ",", "NumpadComma", 188],
] as const) named[name] = { ...key(value, code, keyCode, value === "Enter" ? undefined : value), location: 3, isKeypad: true };

export const normalizeKeyName = (value: string): string => {
  const source = value === " " ? "Space" : value.trim();
  const lookup = source.toLowerCase();
  const normalized = aliases[lookup] || lookup;
  if (named[normalized]) return normalized;
  if ([...source].length === 1) return source;
  if ([...normalized].length === 1) return normalized;
  throw executionError(`Unsupported key name "${value}".`, true);
};
export const resolveKey = (value: string): KeyDefinition => {
  const normalized = normalizeKeyName(value);
  if (named[normalized]) return named[normalized];
  const character = [...normalized][0];
  const upper = character.toUpperCase();
  const punctuationKey = punctuation[character];
  const code = /^[a-z]$/i.test(character) ? `Key${upper}` : /^\d$/.test(character) ? `Digit${character}` : punctuationKey?.[0] || "";
  const keyCode = /^[a-z]$/i.test(character) ? upper.charCodeAt(0) : /^\d$/.test(character) ? character.charCodeAt(0) : punctuationKey?.[1] || 0;
  return { key: character, code, keyCode, text: character };
};
