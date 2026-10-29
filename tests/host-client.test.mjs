import assert from 'node:assert/strict';
import test from 'node:test';
import { createHostClient } from '../src/client/api/host-client.js';

function environment(fetch, base = 'https://host.example.test/workspace/') {
  return { fetch, getBaseURI: () => base, getOrigin: () => 'https://host.example.test' };
}

test('Host client uses the DSH base path and preserves the authenticated action envelope', async () => {
  const calls = [];
  const api = createHostClient(environment(async (url, options) => {
    calls.push({ url, options });
    return Response.json({ ok: true, models: [] });
  }));
  const result = await api.call('models', { category: 'video' });
  assert.deepEqual(result, { ok: true, models: [] });
  assert.equal(calls[0].url, 'https://host.example.test/workspace/api/mote-media');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), { action: 'models', category: 'video' });
});

test('a non-JSON missing route falls back and the working endpoint is reused', async () => {
  const urls = [];
  const api = createHostClient(environment(async (url) => {
    urls.push(url);
    return url.includes('/workspace/') ? new Response('missing', { status: 404 }) : Response.json({ ok: true });
  }));
  await api.call('state');
  await api.call('models');
  assert.deepEqual(urls, [
    'https://host.example.test/workspace/api/mote-media',
    'https://host.example.test/api/mote-media',
    'https://host.example.test/api/mote-media',
  ]);
});

test('network fallback, endpoint de-duplication and per-instance state remain intact', async () => {
  const urls = [];
  const api = createHostClient(environment(async (url) => {
    urls.push(url);
    if (url.startsWith('https:')) throw new Error('offline');
    return Response.json({ ok: true });
  }, 'https://host.example.test/'));
  await api.call('state');
  await api.call('state');
  assert.deepEqual(urls, ['https://host.example.test/api/mote-media', '/api/mote-media', '/api/mote-media']);
  let freshUrl;
  await createHostClient(environment(async (url) => { freshUrl = url; return Response.json({ ok: true }); })).call('state');
  assert.equal(freshUrl, 'https://host.example.test/workspace/api/mote-media');
});

test('Host errors are surfaced without trying a different route', async () => {
  let calls = 0;
  const api = createHostClient(environment(async () => { calls += 1; return Response.json({ ok: false, error: { message: 'channel unavailable' } }); }));
  await assert.rejects(api.call('state'), /channel unavailable/);
  assert.equal(calls, 1);
  const invalid = createHostClient(environment(async () => new Response('bad response', { status: 502, statusText: 'Bad Gateway' })));
  await assert.rejects(invalid.call('state'), /HTTP 502 Bad Gateway.*bad response/);
});

test('an invalid base URI still permits the origin route and exhausted requests report the last failure', async () => {
  let url;
  const fallback = createHostClient(environment(async (value) => { url = value; return Response.json({ ok: true }); }, 'invalid/'));
  await fallback.call('state');
  assert.equal(url, 'https://host.example.test/api/mote-media');
  const offline = createHostClient(environment(async () => { throw new Error('offline'); }, ''));
  await assert.rejects(offline.call('state'), /\/api\/mote-media · offline/);
});

test('a lost generation response is unknown and never tries another endpoint', async () => {
  const calls = [];
  const api = createHostClient(environment(async (url) => { calls.push(url); throw new Error('response lost'); }));
  await assert.rejects(api.call('generate', { submissionId: 'fixed-intent' }), (error) => error.submissionUnknown === true && error.code === 'submission_unknown');
  assert.equal(calls.length, 1);
  const invalid = createHostClient(environment(async () => new Response('<html>gateway error</html>', { status: 502 })));
  await assert.rejects(invalid.call('generate', { submissionId: 'fixed-intent' }), (error) => error.submissionUnknown === true);
});
