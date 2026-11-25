import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { Server } from 'node:http';

let server: Server;
let baseUrl: string;

test.before(() => {
  return new Promise<void>((resolve) => {
    // Start on ephemeral port for integration tests
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

test('GET /api/health returns 200 OK with correct schema', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    success: boolean;
    message?: string;
    data: {
      status: string;
      message: string;
      app: string;
      version: string;
      environment: string;
      timestamp: string;
    };
    timestamp: string;
  };

  assert.equal(body.success, true);
  assert.equal(body.message, 'MediFind Connect API is running');
  assert.equal(body.data.status, 'ok');
  assert.equal(body.data.message, 'MediFind Connect API is running');
  assert.equal(body.data.app, 'MediFind Connect API');
  assert.equal(body.data.version, '1.0.0');
  assert.ok(body.data.timestamp);
});

test('GET /api/readiness returns valid connectivity report', async () => {
  const res = await fetch(`${baseUrl}/api/readiness`);
  assert.equal(res.status, 200);

  const body = (await res.json()) as {
    success: boolean;
    data: {
      status: string;
      database: {
        configured: boolean;
        connected: boolean;
        message: string;
      };
    };
  };

  assert.equal(body.success, true);
  assert.ok(['ready', 'degraded'].includes(body.data.status));
  assert.equal(typeof body.data.database.configured, 'boolean');
  assert.equal(typeof body.data.database.connected, 'boolean');
  assert.ok(body.data.database.message.length > 0);
});

test('GET /api/unknown-endpoint returns 404 with standard error envelope', async () => {
  const res = await fetch(`${baseUrl}/api/unknown-route-12345`);
  assert.equal(res.status, 404);

  const body = (await res.json()) as {
    success: boolean;
    error: {
      code: string;
      message: string;
    };
  };

  assert.equal(body.success, false);
  assert.equal(body.error.code, 'RESOURCE_NOT_FOUND');
  assert.ok(body.error.message.includes('RESOURCE_NOT_FOUND') || body.error.message.includes('does not exist'));
});
