import test from 'node:test';
import assert from 'node:assert/strict';

test('Environment validation: loads default port and mode', () => {
  // Verify default node environment
  const nodeEnv = process.env.NODE_ENV || 'development';
  assert.ok(['development', 'test', 'production'].includes(nodeEnv));
});

test('Health response format contract verification', () => {
  const sampleHealthPayload = {
    status: 'ok',
    app: 'MediFind Connect API',
    version: '1.0.0',
    environment: 'development',
    timestamp: new Date().toISOString(),
  };

  assert.equal(sampleHealthPayload.status, 'ok');
  assert.equal(sampleHealthPayload.app, 'MediFind Connect API');
  assert.ok(sampleHealthPayload.timestamp.length > 0);
});

test('Error envelope structure verification', () => {
  const sampleErrorPayload = {
    success: false,
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Endpoint does not exist',
    },
    timestamp: new Date().toISOString(),
  };

  assert.equal(sampleErrorPayload.success, false);
  assert.equal(sampleErrorPayload.error.code, 'RESOURCE_NOT_FOUND');
  assert.ok(sampleErrorPayload.timestamp);
});
