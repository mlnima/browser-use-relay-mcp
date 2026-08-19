import type { ActionDefinition } from "../actionDefinition.js";

const form = ["browser", "dom"] as const;

export const formFileActions = [
  { name: "check", category: "form", engines: form, readOnly: false, description: "Check a checkbox." },
  { name: "uncheck", category: "form", engines: form, readOnly: false, description: "Uncheck a checkbox." },
  { name: "toggleCheckbox", category: "form", engines: form, readOnly: false, description: "Toggle a checkbox." },
  { name: "selectRadio", category: "form", engines: form, readOnly: false, description: "Select a radio control." },
  { name: "selectOption", category: "form", engines: ["dom"], readOnly: false, description: "Select one or more options." },
  { name: "deselectOption", category: "form", engines: ["dom"], readOnly: false, description: "Deselect options in a multi-select." },
  { name: "setRange", category: "form", engines: ["dom"], readOnly: false, description: "Set a range control." },
  { name: "setNumber", category: "form", engines: ["dom"], readOnly: false, description: "Set a number control." },
  { name: "increment", category: "form", engines: form, readOnly: false, description: "Increment a numeric control." },
  { name: "decrement", category: "form", engines: form, readOnly: false, description: "Decrement a numeric control." },
  { name: "setDate", category: "form", engines: ["dom"], readOnly: false, description: "Set a date control." },
  { name: "setTime", category: "form", engines: ["dom"], readOnly: false, description: "Set a time control." },
  { name: "setDatetime", category: "form", engines: ["dom"], readOnly: false, description: "Set a datetime-local control." },
  { name: "setMonth", category: "form", engines: ["dom"], readOnly: false, description: "Set a month control." },
  { name: "setWeek", category: "form", engines: ["dom"], readOnly: false, description: "Set a week control." },
  { name: "setColor", category: "form", engines: ["dom"], readOnly: false, description: "Set a color control." },
  { name: "submitForm", category: "form", engines: form, readOnly: false, description: "Submit a form through its submit control." },
  { name: "resetForm", category: "form", engines: ["dom"], readOnly: false, description: "Activate a form reset." },
  { name: "focusField", category: "form", engines: form, readOnly: false, description: "Focus a form field." },
  { name: "blurField", category: "form", engines: form, readOnly: false, description: "Blur a form field." },
  { name: "setInputFiles", category: "files", engines: ["browser", "dom", "native"], readOnly: false, description: "Set uploaded files from browser-device paths or transferred byte payloads." },
  { name: "clearFiles", category: "files", engines: ["browser", "dom"], readOnly: false, description: "Clear a file input and dispatch its value events." },
  { name: "dropFile", category: "files", engines: ["dom"], readOnly: false, description: "Drop a transferred file on a target." },
  { name: "dropFiles", category: "files", engines: ["dom"], readOnly: false, description: "Drop transferred files on a target." },
  { name: "waitUpload", category: "files", engines: ["dom"], readOnly: true, description: "Wait for upload completion signals." },
  { name: "dragWithData", category: "drag", engines: ["dom"], readOnly: false, description: "Perform HTML drag-and-drop with DataTransfer payloads." },
] satisfies readonly ActionDefinition[];
