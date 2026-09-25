import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeJobPayload } from '../src/lib/payloadNormalization.js';

test('job payloads only normalize rate type when provided', () => {
  const blank = normalizeJobPayload({ rateType: '' });
  assert.equal(blank.rateType, '');

  const c2c = normalizeJobPayload({ rateType: 'c2c' });
  assert.equal(c2c.rateType, 'C2C');

  const w2 = normalizeJobPayload({ rateType: 'w2' });
  assert.equal(w2.rateType, 'W2');
});
