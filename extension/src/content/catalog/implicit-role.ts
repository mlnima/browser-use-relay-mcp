const tagRoles: Record<string, string> = {
  ASIDE: "complementary",
  ARTICLE: "article",
  BUTTON: "button",
  DIALOG: "dialog",
  FIELDSET: "group",
  FIGURE: "figure",
  FOOTER: "contentinfo",
  FORM: "form",
  HEADER: "banner",
  IMG: "img",
  LI: "listitem",
  MAIN: "main",
  MENU: "list",
  METER: "meter",
  NAV: "navigation",
  OL: "list",
  OPTION: "option",
  OUTPUT: "status",
  PROGRESS: "progressbar",
  SEARCH: "search",
  HR: "separator",
  TABLE: "table",
  TBODY: "rowgroup",
  TD: "cell",
  TEXTAREA: "textbox",
  TFOOT: "rowgroup",
  THEAD: "rowgroup",
  TR: "row",
  UL: "list",
};

const inputRoles: Record<string, string> = {
  button: "button",
  checkbox: "checkbox",
  email: "textbox",
  image: "button",
  number: "spinbutton",
  radio: "radio",
  range: "slider",
  reset: "button",
  search: "searchbox",
  submit: "button",
  tel: "textbox",
  text: "textbox",
  url: "textbox",
};

const selectRole = (element: HTMLSelectElement): string =>
  element.multiple || element.size > 1 ? "listbox" : "combobox";

export const getImplicitRole = (element: Element): string | undefined => {
  if ((element instanceof HTMLAnchorElement || element instanceof HTMLAreaElement) && element.href) return "link";
  if (element instanceof HTMLInputElement) return inputRoles[element.type] || undefined;
  if (element instanceof HTMLSelectElement) return selectRole(element);
  if (element instanceof HTMLHeadingElement) return "heading";
  if (element instanceof HTMLDetailsElement) return "group";
  if (element instanceof HTMLElement && element.tagName === "SUMMARY") return "button";
  if (element instanceof HTMLTableCellElement && element.tagName === "TH") {
    return element.scope === "row" ? "rowheader" : "columnheader";
  }
  return tagRoles[element.tagName];
};

export const getRole = (element: Element): string | undefined =>
  element.getAttribute("role")?.slice(0, MAX_SNAPSHOT_STRING_CHARACTERS + 1).trim().split(/\s+/)[0] || getImplicitRole(element);
import { MAX_SNAPSHOT_STRING_CHARACTERS } from "../../../../src/protocol/limits.js";
