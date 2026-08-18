import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRequirementMatch } from '../src/lib/matching.js';

test('requirement matching is transparent and bounded', () => {
  const result = calculateRequirementMatch(
    { skills: 'React, TypeScript, PostgreSQL', minExperience: 5, location: 'Hyderabad', visaRequirements: 'H1B', maxRate: 80 },
    { skills: 'React, TypeScript, Node.js', experienceYears: 6, visaStatus: 'H1B', ratePerHour: 75, marketingStatus: 'Active', customData: { location: 'Hyderabad' } },
  );
  assert.equal(result.matched.skills.length, 2);
  assert.deepEqual(result.missing.skills, ['postgresql']);
  assert.ok(result.percentage >= 0 && result.percentage <= 100);
});
