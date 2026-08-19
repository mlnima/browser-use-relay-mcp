import type { JsonValue } from "../../../../src/types/json.js";

export type FrameReadEnvelope = { value: JsonValue; encodedBytes: number };

export const readFrame = (params: Record<string, JsonValue>): FrameReadEnvelope => {
  const maximum = typeof params.__relayMaxBytes === "number" ? Math.max(1, Math.floor(params.__relayMaxBytes)) : 1;
  const encoder = new TextEncoder();
  const operation = params.operation || "document";
  const fail = (detail: string): never => { throw new Error(`Frame ${String(operation)} read exceeds the ${detail}.`); };
  const bytes = (value: string, limit: number, start = 0, end = value.length) => {
    let size = 0;
    for (let offset = start; offset < end; offset += 8_192) {
      size += encoder.encode(value.slice(offset, Math.min(end, offset + 8_192))).byteLength;
      if (size > limit) return limit + 1;
    }
    return size;
  };
  const finish = (value: JsonValue): FrameReadEnvelope => {
    const serialized = JSON.stringify(value);
    const encodedBytes = encoder.encode(serialized).byteLength;
    if (encodedBytes > maximum) fail(`${maximum}-byte encoded limit`);
    return { value, encodedBytes };
  };
  const inspect = (root: Node, html: boolean, limit = maximum) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
    let size = 0, nodes = 0;
    const add = (amount: number) => { size += amount; if (size > limit) fail(`${limit}-byte source limit`); };
    const addString = (value: string) => add(bytes(value, limit - size));
    const visit = (node: Node) => {
      if (++nodes > 100_000) fail("100000-node source limit");
      if (node instanceof Text || node instanceof Comment) addString(node.data);
      else if (node instanceof Element) {
        add(html ? 5 : 1);
        if (html) {
          addString(node.localName); addString(node.localName);
          for (let index = 0; index < node.attributes.length; index += 1) {
            const attribute = node.attributes.item(index)!;
            add(4); addString(attribute.name); addString(attribute.value);
          }
        }
      }
    };
    visit(root);
    let node: Node | null;
    while ((node = walker.nextNode())) visit(node);
  };
  const selectionText = () => {
    const selection = document.getSelection();
    if (!selection?.rangeCount) return "";
    const range = selection.getRangeAt(0);
    const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ALL);
    let size = 0, nodes = 0;
    const visit = (node: Node) => {
      if (++nodes > 100_000) fail("100000-node selection limit");
      if (!(node instanceof Text) || !range.intersectsNode(node)) return;
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.data.length;
      size += bytes(node.data, maximum - size, start, end);
      if (size > maximum) fail(`${maximum}-byte selection limit`);
    };
    visit(range.commonAncestorContainer);
    let node: Node | null;
    while ((node = walker.nextNode())) visit(node);
    return selection.toString();
  };
  if (operation === "text") { inspect(document.body || document, false); return finish(document.body?.innerText || ""); }
  if (operation === "html") { inspect(document.documentElement, true); return finish(document.documentElement.outerHTML); }
  if (operation === "selection") return finish(selectionText());
  if (operation === "query") {
    const element = document.querySelector(params.selector as string);
    if (!element) return finish(null);
    const rect = element.getBoundingClientRect();
    inspect(element, false, Math.floor(maximum / 2));
    const text = (element as HTMLElement).innerText || element.textContent || "";
    inspect(element, true, Math.floor(maximum / 2));
    const html = element.outerHTML;
    const attributes: Record<string, string> = {};
    const attributeLimit = 64;
    for (let index = 0; index < Math.min(element.attributes.length, attributeLimit); index += 1) {
      const attribute = element.attributes.item(index)!;
      attributes[attribute.name] = attribute.value;
    }
    return finish({ tagName: element.tagName.toLowerCase(), text, html, attributes, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      outputLimits: { byteLimit: maximum, attributeLimit, omittedAttributeCount: Math.max(0, element.attributes.length - attributeLimit) } });
  }
  const value = { url: location.href, title: document.title, readyState: document.readyState, visibility: document.visibilityState,
    frameElement: window.frameElement?.tagName.toLowerCase() || null, dimensions: { viewportWidth: innerWidth, viewportHeight: innerHeight,
      documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight } };
  bytes(value.url, maximum) > maximum && fail(`${maximum}-byte URL source limit`);
  bytes(value.title, maximum) > maximum && fail(`${maximum}-byte title source limit`);
  return finish(value);
};
