import type { ActionDefinition } from "../actionDefinition.js";

const input = ["browser", "native"] as const;
const edit = ["browser", "dom", "native"] as const;

export const keyboardTextActions = [
  { name: "keyDown", category: "keyboard", engines: input, readOnly: false, description: "Press a keyboard key." },
  { name: "keyUp", category: "keyboard", engines: input, readOnly: false, description: "Release a keyboard key." },
  { name: "press", category: "keyboard", engines: input, readOnly: false, description: "Press and release a key or shortcut." },
  { name: "type", category: "keyboard", engines: input, readOnly: false, description: "Type text as browser input." },
  { name: "typeSlowly", category: "keyboard", engines: input, readOnly: false, description: "Type text with human-paced delays." },
  { name: "holdKey", category: "keyboard", engines: input, readOnly: false, description: "Hold a key down." },
  { name: "releaseKey", category: "keyboard", engines: input, readOnly: false, description: "Release a held key." },
  { name: "repeatKey", category: "keyboard", engines: input, readOnly: false, description: "Generate key-repeat input." },
  { name: "shortcut", category: "keyboard", engines: input, readOnly: false, description: "Press an arbitrary modifier shortcut." },
  { name: "composeText", category: "keyboard", engines: ["browser"], readOnly: false, description: "Insert IME or composition text." },
  { name: "focus", category: "text", engines: edit, readOnly: false, description: "Focus an editable target." },
  { name: "blur", category: "text", engines: edit, readOnly: false, description: "Blur the focused target." },
  { name: "clear", category: "text", engines: edit, readOnly: false, description: "Clear editable content." },
  { name: "setValue", category: "text", engines: edit, readOnly: false, description: "Replace an editable control value." },
  { name: "appendText", category: "text", engines: edit, readOnly: false, description: "Append text to editable content." },
  { name: "replaceText", category: "text", engines: edit, readOnly: false, description: "Replace selected editable text." },
  { name: "insertText", category: "text", engines: edit, readOnly: false, description: "Insert text at the caret." },
  { name: "deleteText", category: "text", engines: edit, readOnly: false, description: "Delete text around the caret." },
  { name: "selectAll", category: "text", engines: edit, readOnly: false, description: "Select all editable text." },
  { name: "selectRange", category: "text", engines: edit, readOnly: false, description: "Select an editable text range." },
  { name: "setCaretPosition", category: "text", engines: ["dom"], readOnly: false, description: "Place the caret in editable content." },
  { name: "getSelection", category: "text", engines: ["dom"], readOnly: true, description: "Read the current selection." },
  { name: "contentEditableInsert", category: "text", engines: edit, readOnly: false, description: "Insert text into contenteditable content." },
  { name: "contentEditableDelete", category: "text", engines: edit, readOnly: false, description: "Delete contenteditable text." },
  { name: "undo", category: "text", engines: input, readOnly: false, description: "Undo the last edit." },
  { name: "redo", category: "text", engines: input, readOnly: false, description: "Redo the last edit." },
] satisfies readonly ActionDefinition[];
