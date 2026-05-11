import assert from 'node:assert/strict';
import { Wsmt, WsmtClient } from '../build/index.js';

const server = new Wsmt({
  port: 1234,
  password: 'test-password',
  persistData: false,
  callback: () => {}
});

const client = new WsmtClient({
  name: 'test_service',
  secret: 'test-password',
  address: {
    ip: '127.0.0.1',
    port: 1234
  }
});

assert.equal(typeof server.init, 'function');
assert.equal(typeof server.close, 'function');
assert.equal(typeof client.connect, 'function');
assert.equal(typeof client.disconnect, 'function');

console.log('Smoke test passed');
