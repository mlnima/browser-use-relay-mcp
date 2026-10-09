import { createHash, randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { records, createWave } from './fixtures.mjs';

const uploads = new Map(); const audio = createWave();
const json = (response, data, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(data)); };
export const handleApi = async (request, response, url) => {
  if (url.pathname === '/api/records') {
    await setTimeout(900);
    if (url.searchParams.get('fail') === '1') return json(response, { error: 'fixture-request-failure' }, 503);
    const query = url.searchParams.get('q') || '', page = Number(url.searchParams.get('page')) || 0;
    const matched = records.filter((record) => record.id.includes(query));
    return json(response, { items: matched.slice(page * 9, (page + 1) * 9), total: matched.length });
  }
  if (url.pathname === '/api/upload' && request.method === 'POST') {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const bytes = Buffer.concat(chunks), id = randomUUID(), name = url.searchParams.get('name') || '';
    const result = { id, name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    uploads.set(id, { ...result, content: bytes }); return json(response, result);
  }
  if (url.pathname === '/api/download') {
    const file = uploads.get(url.searchParams.get('id'));
    const bytes = file?.content || Buffer.from('Browser Use Relay MCP\nLocal download fixture.\n');
    response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': bytes.length,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file?.name || 'relay-fixture.txt')}` }); response.end(bytes); return;
  }
  if (url.pathname === '/api/audio') {
    const range = request.headers.range?.match(/bytes=(\d+)-(\d*)/);
    const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), audio.length - 1) : audio.length - 1;
    if (start > end || start >= audio.length) { response.writeHead(416, { 'Content-Range': `bytes */${audio.length}` }); response.end(); return; }
    response.writeHead(range ? 206 : 200, { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1,
      ...(range && { 'Content-Range': `bytes ${start}-${end}/${audio.length}` }) }); response.end(audio.subarray(start, end + 1)); return;
  }
  json(response, { error: 'not-found' }, 404);
};
