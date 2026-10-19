import { inspectionActionHandlers } from '../extension/src/content/actions/inspectionActions';
import { queryAll } from '../extension/src/content/actions/query-all';
import { lookupElement } from '../extension/src/content/catalog/registry';
import { elementDescriptorFields } from '../src/protocol/elementProjection';
import type { ActionRequest } from '../src/types/action';

export const query = queryAll;
export const fields = elementDescriptorFields;
export const lookup = (id: string) => lookupElement(id)?.tagName;
export const click = (id: string) => (lookupElement(id) as HTMLElement | undefined)?.click();
export const run = (action: string, params: ActionRequest['params'] = {}, selector = 'a', target?: ActionRequest['target']) =>
  inspectionActionHandlers[action]({
    request: { id: 'read', action, params, target: target || { locator: { selector } } },
    resolveTarget: () => document.querySelector(selector) || undefined,
    signal: new AbortController().signal,
  });
