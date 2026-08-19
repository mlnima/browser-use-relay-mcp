import { createRequire } from "node:module";

type RawPoint = { x: number; y: number };
type RawInput = {
  getMousePos: () => RawPoint;
  keyTap: (key: string, modifiers?: string[]) => void;
  keyToggle: (key: string, direction: "down" | "up", modifiers?: string[]) => void;
  mouseClick: (button?: string, double?: boolean) => void;
  mouseToggle: (direction: "down" | "up", button?: string) => void;
  moveMouse: (x: number, y: number) => void;
  scrollMouse: (x: number, y: number) => void;
  setKeyboardDelay: (milliseconds: number) => void;
  setMouseDelay: (milliseconds: number) => void;
  typeString: (value: string) => void;
};

const require = createRequire(import.meta.url);
let binding: RawInput | undefined;

export const nativeBinding = () => {
  binding ||= (require("@nut-tree-fork/libnut/dist/import_libnut.js") as { libnut: RawInput }).libnut;
  return binding;
};
