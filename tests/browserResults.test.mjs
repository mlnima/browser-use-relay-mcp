import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { openBrowser } from './browserRuntime.mjs';
import { actionParameterOverrides } from '../src/protocol/parameterOverrides.ts';
import { registerQueryTool } from '../src/mcp/tools/registerQueryTool.ts';
import { registerCapabilitiesTool } from '../src/mcp/tools/registerCapabilitiesTool.ts';

let browser;
let bundle;
before(async () => {
  bundle = (await build({ entryPoints: [fileURLToPath(new URL('./browserFixture.ts', import.meta.url))],
    bundle: true, write: false, format: 'iife', globalName: 'browserResults', platform: 'browser', target: 'chrome130' })).outputFiles[0].text;
  bundle += '\nglobalThis.browserResults = browserResults;';
  browser = await openBrowser();
  await browser.evaluate(bundle);
});
after(async () => { await browser?.close(); });

const evaluate = (code) => browser.evaluate(`(async () => { ${code} })()`);
const fixture = `document.body.innerHTML = '<main><a href="/first" aria-label="First link">First</a><a href="/second">Second</a><a href="/third">Third</a><input value="sample" disabled readonly><select multiple><option selected value="one">One</option><option selected value="two">Two</option></select></main>';`;

test('omitted fields preserve full descriptors and existing pagination', async () => {
  const result = await evaluate(`${fixture}
    const page = browserResults.query('a', 2, 0);
    const next = browserResults.query('a', 2, page.nextOffset);
    return { page, next, fields: browserResults.fields };
  `);
  assert.deepEqual(Object.keys(result.page.elements[0]), result.fields);
  assert.equal(result.page.elements[0].text, 'First');
  assert.equal(result.page.limit, 2);
  assert.equal(result.page.truncated, true);
  assert.equal(result.page.nextOffset, 2);
  assert.equal(result.page.totalMatched, null);
  assert.equal(result.next.elements[0].text, 'Third');
  assert.equal(result.next.truncated, false);
  assert.equal(result.next.totalMatched, 3);
  assert.equal(result.next.nextOffset, null);
  assert.equal(result.page.encodedBytes, Buffer.byteLength(JSON.stringify(result.page.elements)));
});

test('field selection reduces output and retains usable IDs and exact attributes', async () => {
  const result = await evaluate(`${fixture}
    const full = browserResults.query('a', 2, 0);
    const page = await browserResults.run('querySelectorAll', { fields: ['text'], attributes: ['href', 'aria-label', 'data-missing'], limit: 2 });
    const item = page.elements[0];
    const target = document.querySelector('a');
    let clicked = false; target.addEventListener('click', event => { event.preventDefault(); clicked = true; });
    browserResults.click(item.id);
    return { page, tag: browserResults.lookup(item.id), clicked, fullBytes: JSON.stringify(full).length, projectedBytes: JSON.stringify(page).length };
  `);
  const [first, second] = result.page.elements;
  assert.deepEqual(Object.keys(first), ['id', 'text', 'attributes']);
  assert.deepEqual(first.attributes, { href: '/first', 'aria-label': 'First link', 'data-missing': null });
  assert.equal(second.attributes['aria-label'], null);
  assert.equal(result.tag, 'A');
  assert.equal(result.clicked, true);
  assert.ok(result.projectedBytes < result.fullBytes / 2);
  assert.equal(result.page.encodedBytes, Buffer.byteLength(JSON.stringify(result.page.elements)));
  console.log(`Browser fixture result: ${result.fullBytes} -> ${result.projectedBytes} characters`);
});

test('all descriptor fields remain selectable and form state is preserved', async () => {
  const result = await evaluate(`${fixture}
    return { full: browserResults.query('input', 1), selected: browserResults.query('input', 1, 0, browserResults.fields),
      form: browserResults.query('input, select', 2, 0, ['value', 'enabled', 'readonly', 'selectedValues', 'bounds']),
      ids: browserResults.query('a', 1, 0, []), attributesOnly: browserResults.query('a', 1, 0, [], ['href']) };
  `);
  assert.deepEqual(result.selected, result.full);
  assert.equal(result.form.elements[0].enabled, false);
  assert.equal(result.form.elements[0].readonly, true);
  assert.equal(result.form.elements[0].value, 'sample');
  assert.deepEqual(result.form.elements[1].selectedValues, ['one', 'two']);
  assert.equal(typeof result.form.elements[0].bounds.x, 'number');
  assert.deepEqual(Object.keys(result.ids.elements[0]), ['id']);
  assert.deepEqual(Object.keys(result.attributesOnly.elements[0]), ['id', 'attributes']);
});

test('bounded list projection returns requested links with substantially less text', async () => {
  const result = await evaluate(`document.body.innerHTML = '';
    for (let index = 0; index < 60; index++) {
      const link = document.createElement('a'); link.textContent = 'Reference ' + index; link.setAttribute('href', '/reference/' + index); document.body.append(link);
    }
    const full = browserResults.query('a', 60);
    const selected = browserResults.query('a', 60, 0, ['text'], ['href']);
    return { count: selected.elements.length, full: JSON.stringify(full).length, selected: JSON.stringify(selected).length,
      last: selected.elements.at(-1), fields: Object.keys(selected.elements[0]) };
  `);
  assert.equal(result.count, 60);
  assert.equal(result.last.attributes.href, '/reference/59');
  assert.deepEqual(result.fields, ['id', 'text', 'attributes']);
  assert.ok(result.selected < result.full * 0.3);
  console.log(`60-element browser result: ${result.full} -> ${result.selected} characters`);
});

test('single-element queries support projection, no-match results and default descriptors', async () => {
  const result = await evaluate(`${fixture}
    const actions = ['querySelector', 'queryXPath', 'queryText', 'queryRole', 'queryLabel', 'queryPlaceholder', 'queryCoordinates', 'findInFrame'];
    const reads = await Promise.all(actions.map(action => browserResults.run(action, { fields: ['text'], attributes: ['href'] })));
    const missing = await browserResults.run('querySelector', { fields: ['text'] }, '.absent');
    const full = await browserResults.run('querySelector');
    return { reads, missing, full, empty: browserResults.query('.absent', 1, 0, ['text']) };
  `);
  for (const read of result.reads) { assert.equal(read.text, 'First'); assert.equal(read.attributes.href, '/first'); }
  assert.equal(result.missing, null);
  assert.equal(result.empty.totalMatched, 0);
  assert.deepEqual(result.empty.elements, []);
  assert.ok(result.full.bounds);
});

test('invalid options fail even when no elements match and existing limits remain enforced', async () => {
  const errors = await evaluate(`${fixture}
    return [['text', undefined], [['unknown'], undefined], [[1], undefined], [undefined, 'href'], [undefined, ['']]].map(([fields, attributes]) => {
      try { browserResults.query('.absent', 1, 0, fields, attributes); return null; } catch (error) { return error.message; }
    }).concat([0, 5001].map(limit => { try { browserResults.query('a', limit); return null; } catch (error) { return error.message; } }));
  `);
  assert.ok(errors.every(error => typeof error === 'string' && error.length > 0));
});

test('long Unicode text and attributes retain truthful truncation metadata', async () => {
  const result = await evaluate(`${fixture}
    const link = document.querySelector('a'); link.textContent = '🧭'.repeat(2000); link.setAttribute('data-value', '🧭'.repeat(2000));
    return browserResults.query('a', 1, 0, ['text'], ['data-value']).elements[0];
  `);
  assert.ok(result.text.length <= 2048);
  assert.ok(result.attributes['data-value'].length <= 2048);
  assert.ok(result.outputLimits.stringTruncationCount > 0);
  assert.doesNotMatch(result.text, /[\uD800-\uDBFF]$/);
  assert.doesNotMatch(result.attributes['data-value'], /[\uD800-\uDBFF]$/);
});

test('projection preserves open shadow-root traversal and independent frame queries', async () => {
  const result = await evaluate(`${fixture}
    const host = document.createElement('section'); document.body.append(host);
    host.attachShadow({ mode: 'open' }).innerHTML = '<a href="/shadow">Shadow</a>';
    const shadow = browserResults.query('a', 10, 0, ['text'], ['href']);
    const frame = document.createElement('iframe'); document.body.append(frame);
    frame.contentDocument.body.innerHTML = '<a href="/frame">Frame</a>';
    frame.contentWindow.eval(${JSON.stringify(bundle)});
    const page = frame.contentWindow.browserResults.query('a', 1, 0, ['text'], ['href']);
    return { shadow, page };
  `);
  assert.equal(result.shadow.elements.at(-1).text, 'Shadow');
  assert.equal(result.shadow.elements.at(-1).attributes.href, '/shadow');
  assert.equal(result.page.elements[0].text, 'Frame');
  assert.equal(result.page.elements[0].attributes.href, '/frame');
});

test('projected pages respect the existing aggregate byte budget', async () => {
  const result = await evaluate(`document.body.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 3500; index++) { const link = document.createElement('a'); link.textContent = 'x'.repeat(2048); fragment.append(link); }
    document.body.append(fragment);
    const page = browserResults.query('a', 3500, 0, ['text']);
    return { ...page, elements: undefined, actualBytes: new TextEncoder().encode(JSON.stringify(page.elements)).length };
  `);
  assert.equal(result.truncated, true);
  assert.equal(result.truncationReason, 'byteLimit');
  assert.equal(result.nextOffset, result.returnedElementCount);
  assert.ok(result.actualBytes <= result.byteLimit);
  assert.equal(result.encodedBytes, result.actualBytes);
});

test('MCP read tool preserves engine, frame, revision and projection arguments', async () => {
  let callback;
  const requests = [];
  registerQueryTool({ registerTool: (_name, _options, handler) => { callback = handler; } }, {
    execute: async request => { requests.push(request); return { id: request.id, success: true, engine: 'dom', data: {}, durationMs: 0 }; },
  });
  for (const engine of ['auto', 'dom']) {
    const input = { action: 'querySelectorAll', engine, expectedRevision: 7,
      target: { tabId: 2, frameId: 3, documentId: 'document', locator: { selector: 'a' } },
      params: { fields: ['text'], attributes: ['href'], limit: 10, offset: 20 } };
    await callback(input, { mcpReq: { signal: new AbortController().signal } });
    assert.deepEqual(requests.at(-1).target, input.target);
    assert.deepEqual(requests.at(-1).params, input.params);
    assert.equal(requests.at(-1).engine, engine);
    assert.equal(requests.at(-1).expectedRevision, 7);
  }
  assert.match(actionParameterOverrides.querySelectorAll, /params.fields/);
  assert.match(actionParameterOverrides.querySelectorAll, /params.attributes/);
  for (const engine of ['browser', 'native']) {
    await assert.rejects(callback({ action: 'querySelectorAll', engine }, { mcpReq: { signal: new AbortController().signal } }), /does not support/);
  }
  await assert.rejects(callback({ action: 'clickElement' }, { mcpReq: { signal: new AbortController().signal } }), /read-only/);
});

test('focused capability discovery documents field selection for every input setting', async () => {
  for (const inputEngine of ['auto', 'browser', 'native']) {
    let callback;
    registerCapabilitiesTool({ registerTool: (_name, _options, handler) => { callback = handler; } }, {
      inputEngine: () => inputEngine,
      execute: async request => ({ id: request.id, success: true, engine: 'browser', data: {}, durationMs: 0 }),
    });
    const result = await callback({ actions: ['querySelectorAll', 'queryRole'] }, { mcpReq: { signal: new AbortController().signal } });
    const data = result.structuredContent;
    assert.equal(data.inputEngine, inputEngine);
    assert.deepEqual(data.actions.map(action => action.name), ['querySelectorAll', 'queryRole']);
    assert.match(data.categoryParameterGuides.inspect, /params.fields/);
    assert.match(data.categoryParameterGuides.inspect, /params.attributes/);
    assert.match(data.categoryParameterGuides.inspect, /Element IDs are always retained/);
  }
});
