import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';

const workspace = process.env.INIT_CWD || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playground = path.join(workspace, 'test-playground', 'browser-results');
const executable = () => [
  process.env.BROWSER_TEST_EXECUTABLE,
  path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/microsoft-edge',
].find((candidate) => candidate && fs.existsSync(candidate));

export const openBrowser = async () => {
  const binary = executable();
  if (!binary) throw new Error('Set BROWSER_TEST_EXECUTABLE to an installed Chromium browser.');
  fs.mkdirSync(playground, { recursive: true });
  const profile = fs.mkdtempSync(path.join(playground, 'profile-'));
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><html><body></body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browserProcess = spawn(binary, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  let sequence = 0;
  const pending = new Map();
  const request = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const close = async () => {
    socket?.readyState === WebSocket.OPEN && await request('Browser.close').catch(() => {});
    socket?.terminate();
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser closed')); }
    pending.clear();
    if (browserProcess.exitCode === null) {
      const exited = once(browserProcess, 'exit');
      const timer = setTimeout(() => browserProcess.kill(), 2000);
      await exited;
      clearTimeout(timer);
    }
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    const relative = path.relative(playground, fs.realpathSync(profile));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid browser test profile path.');
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  };
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Browser debugging endpoint unavailable')), 15000);
      browserProcess.once('error', (error) => { clearTimeout(timer); reject(error); });
      browserProcess.once('exit', () => { clearTimeout(timer); reject(new Error('Browser exited during startup')); });
      browserProcess.stderr.on('data', (chunk) => {
        output += chunk.toString();
        const url = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
        url && (clearTimeout(timer), resolve(url));
      });
    });
    socket = new WebSocket(endpoint);
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString());
      const entry = pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(message.id);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    });
    socket.on('close', () => {
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Browser connection closed')); }
      pending.clear();
    });
    await once(socket, 'open');
    const target = await request('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await request('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    await request('Page.enable', {}, sessionId);
    const loaded = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Browser test page did not load')), 15000);
      const read = (data) => {
        const event = JSON.parse(data.toString());
        if (event.method !== 'Page.loadEventFired' || event.sessionId !== sessionId) return;
        clearTimeout(timer);
        socket.off('message', read);
        resolve();
      };
      socket.on('message', read);
    });
    await request('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` }, sessionId);
    await loaded;
    const evaluate = async (expression) => {
      const response = await request('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
      return response.result.value;
    };
    return { evaluate, close };
  } catch (error) { await close(); throw error; }
};
