import type { ActionDefinition } from "../actionDefinition.js";

const input = ["browser", "native"] as const;

export const scrollTouchActions = [
  { name: "scrollUp", category: "scroll", engines: input, readOnly: false, description: "Scroll upward." },
  { name: "scrollDown", category: "scroll", engines: input, readOnly: false, description: "Scroll downward." },
  { name: "scrollLeft", category: "scroll", engines: input, readOnly: false, description: "Scroll left." },
  { name: "scrollRight", category: "scroll", engines: input, readOnly: false, description: "Scroll right." },
  { name: "scrollBy", category: "scroll", engines: input, readOnly: false, description: "Scroll by x and y deltas." },
  { name: "scrollTo", category: "scroll", engines: ["dom"], readOnly: false, description: "Scroll to document coordinates." },
  { name: "scrollToTop", category: "scroll", engines: ["dom", "native"], readOnly: false, description: "Scroll to the document top." },
  { name: "scrollToBottom", category: "scroll", engines: ["dom", "native"], readOnly: false, description: "Scroll to the document bottom." },
  { name: "scrollElement", category: "scroll", engines: ["dom", "native"], readOnly: false, description: "Scroll within an element." },
  { name: "scrollIntoView", category: "scroll", engines: ["dom"], readOnly: false, description: "Bring an element into view." },
  { name: "wheel", category: "scroll", engines: input, readOnly: false, description: "Dispatch wheel deltas as browser input." },
  { name: "tap", category: "touch", engines: ["browser"], readOnly: false, description: "Tap a target." },
  { name: "doubleTap", category: "touch", engines: ["browser"], readOnly: false, description: "Double-tap a target." },
  { name: "longTap", category: "touch", engines: ["browser"], readOnly: false, description: "Touch and hold a target." },
  { name: "touchStart", category: "touch", engines: ["browser"], readOnly: false, description: "Start touch points." },
  { name: "touchMove", category: "touch", engines: ["browser"], readOnly: false, description: "Move active touch points." },
  { name: "touchEnd", category: "touch", engines: ["browser"], readOnly: false, description: "End active touch points." },
  { name: "touchCancel", category: "touch", engines: ["browser"], readOnly: false, description: "Cancel active touch points." },
  { name: "swipe", category: "touch", engines: ["browser"], readOnly: false, description: "Swipe between coordinates." },
  { name: "pinchIn", category: "touch", engines: ["browser"], readOnly: false, description: "Perform a two-point pinch inward." },
  { name: "pinchOut", category: "touch", engines: ["browser"], readOnly: false, description: "Perform a two-point pinch outward." },
  { name: "multiTouch", category: "touch", engines: ["browser"], readOnly: false, description: "Run simultaneous touch sequences." },
  { name: "pen", category: "touch", engines: ["browser"], readOnly: false, description: "Dispatch pen input with pressure, tilt, twist, and buttons." },
] satisfies readonly ActionDefinition[];
