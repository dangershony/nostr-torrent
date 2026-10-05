/* Local selected-file transport. No BrowserServer, broadcasts or keepalive. */
const scope = new URL(self.registration.scope);
const prefix = `${scope.pathname}webtorrent/`;
const sessions = new Map();
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  const d = event.data, port = event.ports[0], owner = event.source;
  if (!port || !owner || owner.type !== 'window' || !d || d.type !== 'bind' ||
      !/^[a-f0-9]{64}$/.test(d.cap) || !Number.isSafeInteger(d.length) || d.length <= 0 || d.length > 67108864) { port?.close(); return; }
  event.waitUntil((async () => {
    const actual = await self.clients.get(owner.id);
    if (!actual || actual.url !== owner.url || ![scope.href, new URL('index.html', scope).href].includes(actual.url) || sessions.has(d.cap)) { port.close(); return; }
    const session = { owner: owner.id, port, length: d.length, streams: new Map(), next: 0 };
    sessions.set(d.cap, session);
    const revoke = () => {
      sessions.delete(d.cap);
      for (const stream of session.streams.values()) stream.finish(new Error('Session revoked'));
      port.close();
    };
    port.onmessageerror = revoke;
    port.onmessage = ({ data: m }) => {
      if (!m || m.cap !== d.cap) return;
      if (m.type === 'revoke') { revoke(); return; }
      const stream = session.streams.get(m.id);
      if (!stream || !stream.pending) return;
      if (m.type === 'chunk' && m.bytes instanceof Uint8Array && m.bytes.byteLength > 0 && m.bytes.byteLength <= stream.remaining) {
        clearTimeout(stream.timer); stream.remaining -= m.bytes.byteLength;
        stream.controller.enqueue(m.bytes);
        const resolve = stream.pending; stream.pending = null; resolve();
        if (stream.remaining === 0) stream.finish();
      } else stream.finish(new Error('Invalid stream reply'));
    };
    port.postMessage({ type: 'ready', cap: d.cap, owner: owner.id });
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(prefix)) return;
  event.respondWith((async () => {
    const cap = url.pathname.slice(prefix.length), session = sessions.get(cap);
    // Exact URL, actual fetch client, selected-file capability; no index/path routes.
    if (!session || url.search || url.hash || url.pathname !== prefix + cap || event.clientId !== session.owner) return new Response(null, { status: 403 });
    const owner = await self.clients.get(event.clientId);
    if (!owner || ![scope.href, new URL('index.html', scope).href].includes(owner.url)) return new Response(null, { status: 403 });
    if (!['GET', 'HEAD'].includes(event.request.method)) return new Response(null, { status: 405 });
    let start = 0, end = session.length - 1;
    const range = event.request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return new Response(null, { status: 416 });
      start = Number(match[1]); end = match[2] ? Number(match[2]) : end;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= session.length) return new Response(null, { status: 416 });
      end = Math.min(end, session.length - 1);
    }
    const headers = { 'Content-Type': 'video/mp4', 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${session.length}`;
    if (event.request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
    if (session.streams.size >= 8) return new Response(null, { status: 429 });
    const id = ++session.next;
    const stream = { remaining: end - start + 1, controller: null, pending: null, timer: undefined, finish: null };
    stream.finish = error => {
      if (!session.streams.delete(id)) return;
      clearTimeout(stream.timer);
      session.port.postMessage({ type: 'cancel', cap, id });
      if (error) stream.controller.error(error); else stream.controller.close();
      stream.pending?.(); stream.pending = null;
    };
    const body = new ReadableStream({
      start(controller) { stream.controller = controller; session.streams.set(id, stream); },
      pull() {
        return new Promise(resolve => {
          stream.pending = resolve;
          stream.timer = setTimeout(() => stream.finish(new Error('Peer read timeout')), 20000);
          session.port.postMessage({ type: 'pull', cap, id, start, end });
        });
      },
      cancel() { stream.finish(new Error('Read canceled')); }
    }, { highWaterMark: 0 });
    return new Response(body, { status: range ? 206 : 200, headers });
  })());
});
