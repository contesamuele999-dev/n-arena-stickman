import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const allowed = new Map([
  ['/index.html', 'text/html; charset=utf-8'],
  ['/sw.js', 'text/javascript; charset=utf-8'],
  ['/manifest.json', 'application/manifest+json'],
  ['/favicon.svg', 'image/svg+xml'],
]);
const port = Number(process.env.PORT || 8775);

createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const asset = path === '/' ? '/index.html' : path;
  if (!['GET', 'HEAD'].includes(request.method) || !allowed.has(asset)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const data = await readFile(fileURLToPath(new URL(asset.slice(1), root)));
    response.writeHead(200, { 'Content-Type': allowed.get(asset), 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(500).end('Unable to read asset');
  }
}).listen(port, '127.0.0.1', () => console.log(`N+ Arena: http://127.0.0.1:${port}`));
