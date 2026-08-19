export const pointerMoveActions = new Set(["move", "moveTo", "hover", "unhover"]);
export const pointerClickActions = new Set([
  "mouseDown", "mouseUp", "leftClick", "middleClick", "rightClick", "doubleClick",
  "tripleClick", "clickAndHold", "release", "longPress", "contextMenu", "modifierClick",
]);
export const pointerDragActions = new Set([
  "dragStart", "dragMove", "dragEnd", "dragAndDrop", "dragToElement", "dragToCoordinates",
  "dragScrollbar", "dragSlider", "selectTextByDragging",
]);
export const scrollActions = new Set([
  "scrollUp", "scrollDown", "scrollLeft", "scrollRight", "scrollBy", "scrollToTop",
  "scrollToBottom", "scrollElement", "wheel",
]);
export const keyboardActions = new Set([
  "keyDown", "keyUp", "press", "type", "typeSlowly", "holdKey", "releaseKey", "repeatKey", "shortcut",
]);
export const textActions = new Set([
  "focus", "blur", "clear", "setValue", "appendText", "replaceText", "insertText", "deleteText",
  "selectAll", "selectRange", "contentEditableInsert", "contentEditableDelete", "undo", "redo",
]);
export const clipboardActions = new Set(["copy", "cut", "paste", "readClipboard", "writeClipboard"]);
export const dialogActions = new Set([
  "setInputFiles", "nativeFileChooser", "nativeSaveDialog", "nativePrintDialog",
  "nativePermissionPrompt", "nativeBrowserUI",
]);
export const compoundActions = new Set([
  "clickElement", "fillField", "chooseOption", "dragElement", "findAndClick", "findAndFill",
]);
