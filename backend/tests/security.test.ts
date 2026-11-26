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

test('CORS: allows permitted localhost origin and sets credentials header', async () => {
  const res = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: 'http://localhost:5173',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
});

test('CORS: handles preflight OPTIONS request correctly', async () => {
  const res = await fetch(`${baseUrl}/api/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
    },
  });

  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.ok(res.headers.get('access-control-allow-methods')?.includes('GET'));
});

test('CORS: rejects unauthorized origin by omitting Access-Control-Allow-Origin', async () => {
  const res = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: 'https://malicious-site.example.com',
    },
  });

  // Request completes but CORS header is NOT returned for untrusted origin
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});
