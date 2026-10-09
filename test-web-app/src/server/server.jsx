import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaults, languages, routes } from '../settings.mjs';
import { records } from './fixtures.mjs';
import { handleApi } from './api.mjs';
import { renderApp, renderFrame } from './render.jsx';

const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const port = Number(process.env.BROWSER_USE_RELAY_MCP_TEST_WEB_APP || defaults.port);
const output = dirname(fileURLToPath(import.meta.url));
let framePort;
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };
const handle = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedLanguage = url.searchParams.get('lang');
  const lang = languages.some((language) => language.id === requestedLanguage) ? requestedLanguage : defaults.language;
  try {
    if (url.pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    if (url.pathname.startsWith('/assets/')) {
      const bytes = await readFile(resolve(output, 'assets', url.pathname.slice('/assets/'.length)));
      response.writeHead(200, { 'Content-Type': mime[extname(url.pathname)] || 'application/octet-stream' }); response.end(bytes); return;
    }
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    if (url.pathname === '/frame') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(renderFrame(url, lang)); return; }
    const known = url.pathname === '/' || routes.some((route) => `/${route.id}` === url.pathname);
    if (!known) { response.writeHead(404); response.end('404'); return; }
    const frameUrl = new URL(url.origin); frameUrl.port = String(framePort);
    const html = await renderApp({ pathname: url.pathname, search: url.search, lang, frameOrigin: frameUrl.origin, records: records.slice(0, 60) });
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end(error.message);
  }
};
const main = createServer(handle), frames = createServer(handle);
const listen = (server, value) => new Promise((done, fail) => { server.once('error', fail); server.listen(value, defaults.host, done); });
await listen(frames, 0); framePort = frames.address().port;
try { await listen(main, port); } catch (error) { frames.close(); throw error; }
process.stdout.write(`Browser test app: http://localhost:${main.address().port}\n`);
const shutdown = () => {
  main.closeAllConnections(); frames.closeAllConnections(); main.close(); frames.close();
  if (process.connected) process.disconnect();
};
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
process.on('message', (message) => message === 'shutdown' && shutdown());
