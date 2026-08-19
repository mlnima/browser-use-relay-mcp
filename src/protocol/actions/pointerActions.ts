import type { ActionDefinition } from "../actionDefinition.js";

const input = ["browser", "native"] as const;
const domInput = ["browser", "dom", "native"] as const;

export const pointerActions = [
  { name: "move", category: "pointer", engines: input, readOnly: false, description: "Move the pointer to viewport coordinates." },
  { name: "moveTo", category: "pointer", engines: input, readOnly: false, description: "Move the pointer to an element." },
  { name: "hover", category: "pointer", engines: domInput, readOnly: false, description: "Hover over a target." },
  { name: "unhover", category: "pointer", engines: domInput, readOnly: false, description: "Move the pointer away from a target." },
  { name: "mouseDown", category: "pointer", engines: domInput, readOnly: false, description: "Press a mouse button." },
  { name: "mouseUp", category: "pointer", engines: domInput, readOnly: false, description: "Release a mouse button." },
  { name: "leftClick", category: "pointer", engines: domInput, readOnly: false, description: "Click with the primary button." },
  { name: "middleClick", category: "pointer", engines: input, readOnly: false, description: "Click with the middle button." },
  { name: "rightClick", category: "pointer", engines: domInput, readOnly: false, description: "Click with the secondary button." },
  { name: "doubleClick", category: "pointer", engines: domInput, readOnly: false, description: "Double-click a target." },
  { name: "tripleClick", category: "pointer", engines: domInput, readOnly: false, description: "Triple-click a target." },
  { name: "clickAndHold", category: "pointer", engines: input, readOnly: false, description: "Press and hold on a target." },
  { name: "release", category: "pointer", engines: input, readOnly: false, description: "Release the held pointer button." },
  { name: "longPress", category: "pointer", engines: input, readOnly: false, description: "Press a pointer for a duration." },
  { name: "contextMenu", category: "pointer", engines: domInput, readOnly: false, description: "Open the target context menu." },
  { name: "modifierClick", category: "pointer", engines: input, readOnly: false, description: "Click while holding modifier keys." },
  { name: "dragStart", category: "pointer", engines: input, readOnly: false, description: "Start a pointer drag." },
  { name: "dragMove", category: "pointer", engines: input, readOnly: false, description: "Continue an active drag." },
  { name: "dragEnd", category: "pointer", engines: input, readOnly: false, description: "Finish an active drag." },
  { name: "dragAndDrop", category: "pointer", engines: input, readOnly: false, description: "Drag between supplied points." },
  { name: "dragToElement", category: "pointer", engines: input, readOnly: false, description: "Drag a target to another element." },
  { name: "dragToCoordinates", category: "pointer", engines: input, readOnly: false, description: "Drag a target to viewport coordinates." },
  { name: "dragScrollbar", category: "pointer", engines: input, readOnly: false, description: "Drag a scrollbar thumb." },
  { name: "dragSlider", category: "pointer", engines: input, readOnly: false, description: "Drag a range slider." },
  { name: "selectTextByDragging", category: "pointer", engines: input, readOnly: false, description: "Select text with a pointer drag." },
] satisfies readonly ActionDefinition[];
