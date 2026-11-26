import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { Server } from 'node:http';

let server: Server;
let baseUrl: string;

test.before(() => {
  return new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

test.after(() => {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

test('CORS: allows exact production Vercel origin and returns credentials header', async () => {
  const res = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: 'https://medi-find-connect.vercel.app',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://medi-find-connect.vercel.app');
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
});

test('CORS: handles preflight OPTIONS request for production Vercel origin', async () => {
  const res = await fetch(`${baseUrl}/api/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://medi-find-connect.vercel.app',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Content-Type,Authorization',
    },
  });

  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://medi-find-connect.vercel.app');
  assert.ok(res.headers.get('access-control-allow-methods')?.includes('GET'));
  assert.ok(res.headers.get('access-control-allow-methods')?.includes('OPTIONS'));
  assert.ok(res.headers.get('access-control-allow-headers')?.includes('Content-Type'));
});

test('CORS: allows Vercel preview deployment URLs', async () => {
  const previewOrigin = 'https://medi-find-connect-preview-branch.vercel.app';
  const res = await fetch(`${baseUrl}/health`, {
    headers: {
      Origin: previewOrigin,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), previewOrigin);
});

test('CORS: allows localhost development origins', async () => {
  const res = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: 'http://localhost:3000',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
});

test('CORS: rejects unauthorized origin without throwing 500 error', async () => {
  const res = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: 'https://malicious-phishing-site.example.com',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('Routing: both /api/health and /health resolve with status: "ok"', async () => {
  const resApi = await fetch(`${baseUrl}/api/health`);
  const bodyApi = await resApi.json();
  assert.equal(resApi.status, 200);
  assert.equal(bodyApi.status, 'ok');

  const resRoot = await fetch(`${baseUrl}/health`);
  const bodyRoot = await resRoot.json();
  assert.equal(resRoot.status, 200);
  assert.equal(bodyRoot.status, 'ok');
  assert.equal(bodyRoot.service, 'backend');
});
