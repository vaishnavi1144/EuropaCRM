import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeJobPayload } from '../src/lib/payloadNormalization.js';

test('job payloads normalize blank legacy rate types to C2C', () => {
  const result = normalizeJobPayload({ rateType: '' });

  assert.equal(result.rateType, 'C2C');
});
