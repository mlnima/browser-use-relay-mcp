import { MAX_CONTENT_JSON_ITEMS, MAX_SNAPSHOT_STRING_CHARACTERS, MAX_SNAPSHOT_TEXT_SCAN_NODES } from "../../../../src/protocol/limits.js";
const excludedTextTags = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);
type Encoding = "json" | "htmlText" | "htmlAttribute" | "utf8";

const failRead = (label: string, detail: string): never => {
  throw Object.assign(new Error(`${label} exceeds the ${detail}.`), { contentCode: "CONTENT_RESULT_TOO_LARGE" });
};

const stringBytes = (value: string, maximum: number, encoding: Encoding): number => {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const pair = code >= 55_296 && code <= 56_319 && value.charCodeAt(index + 1) >= 56_320 && value.charCodeAt(index + 1) <= 57_343;
    const character = value[index];
    const escaped = encoding === "json" && (code === 34 || code === 92) ? 2
      : encoding === "json" && code <= 31 ? ([8, 9, 10, 12, 13].includes(code) ? 2 : 6)
        : encoding === "json" && code >= 55_296 && code <= 57_343 && !pair ? 6
          : encoding !== "json" && character === "&" ? 5
            : encoding === "htmlAttribute" && character === "\"" ? 6
              : encoding !== "utf8" && encoding !== "json" && character === "<" ? 4
                : encoding === "htmlText" && character === ">" ? 4
                  : code <= 127 ? 1 : code <= 2_047 ? 2 : pair ? 4 : 3;
    bytes += escaped;
    pair && (index += 1);
    if (bytes > maximum) return maximum + 1;
  }
  return bytes;
};
export const normalizeText = (value: string | null | undefined): string => (value || "").replace(/\s+/g, " ").trim();

export const collectBoundedElementText = (element: Element, maximum = MAX_SNAPSHOT_STRING_CHARACTERS) => {
  if (excludedTextTags.has(element.tagName)) return { value: undefined, truncated: false };
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);
  const target = maximum + 1;
  let value = "";
  let pendingSpace = false;
  let scanned = 0;
  let node: Node | null;
  while (value.length < target && scanned < MAX_SNAPSHOT_TEXT_SCAN_NODES && (node = walker.nextNode())) {
    scanned += 1;
    if (!(node instanceof Text)) continue;
    for (let index = 0; index < node.data.length && value.length < target; index += 1) {
      const character = node.data[index];
      if (/\s/.test(character)) { pendingSpace = value.length > 0; continue; }
      if (pendingSpace && value.length < target) value += " ";
      pendingSpace = false;
      const pair = /[\uD800-\uDBFF]/.test(character) && /[\uDC00-\uDFFF]/.test(node.data[index + 1] || "");
      value += pair && value.length + 2 <= target ? `${character}${node.data[++index]}` : character;
    }
  }
  const scanTruncated = scanned >= MAX_SNAPSHOT_TEXT_SCAN_NODES && Boolean(walker.nextNode());
  const truncated = value.length > maximum || scanTruncated;
  const sliced = value.slice(0, maximum);
  return { value: (/[\uD800-\uDBFF]$/.test(sliced) ? sliced.slice(0, -1) : sliced) || undefined, truncated };
};

export const getElementText = (element: Element, maximum = MAX_SNAPSHOT_STRING_CHARACTERS): string | undefined =>
  collectBoundedElementText(element, maximum).value;

export const assertTextReadBounded = (element: Element, maximum: number, label: string): void => {
  if (excludedTextTags.has(element.tagName)) return;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let bytes = 2;
  let nodes = 1;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (++nodes > MAX_CONTENT_JSON_ITEMS) failRead(label, `${MAX_CONTENT_JSON_ITEMS}-node source limit`);
    const added = node instanceof Text ? stringBytes(node.data, maximum - bytes, "json") : 1;
    bytes += added;
    if (bytes > maximum) failRead(label, `${maximum}-byte source limit`);
  }
};

export const assertHtmlReadBounded = (element: Element, maximum: number, label: string): void => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);
  let bytes = 0;
  let nodes = 0;
  const add = (amount: number) => { bytes += amount; if (bytes > maximum) failRead(label, `${maximum}-byte source limit`); };
  const addString = (value: string, encoding: Encoding) => add(stringBytes(value, maximum - bytes, encoding));
  const inspect = (node: Node) => {
    if (++nodes > MAX_CONTENT_JSON_ITEMS) failRead(label, `${MAX_CONTENT_JSON_ITEMS}-node source limit`);
    if (node instanceof Element) {
      add(5); addString(node.localName, "utf8"); addString(node.localName, "utf8");
      for (let index = 0; index < node.attributes.length; index += 1) {
        const attribute = node.attributes.item(index)!;
        add(4); addString(attribute.name, "utf8"); addString(attribute.value, "htmlAttribute");
      }
    } else if (node instanceof Text) addString(node.data, "htmlText");
    else if (node instanceof Comment) { add(7); addString(node.data, "utf8"); }
  };
  inspect(element);
  let node: Node | null;
  while ((node = walker.nextNode())) inspect(node);
};

export const includesText = (value: string | undefined, expected: string, exact = false): boolean => {
  const source = normalizeText(value).toLocaleLowerCase();
  const query = normalizeText(expected).toLocaleLowerCase();
  return exact ? source === query : source.includes(query);
};
