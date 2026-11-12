import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TARGET_STATES, SPECIALTIES } from '../config.js';

test('Config: TARGET_STATES has required structure and includes MA and ALL', () => {
  assert.ok(Array.isArray(TARGET_STATES), 'TARGET_STATES should be an array');
  assert.ok(TARGET_STATES.length >= 10, 'Should contain at least 10 states');
  
  const codes = TARGET_STATES.map(s => s.code);
  assert.ok(codes.includes('ALL'), 'Should include ALL state code');
  assert.ok(codes.includes('MA'), 'Should include MA state code');

  for (const item of TARGET_STATES) {
    assert.ok(item.code, 'State item must have code');
    assert.ok(item.name, 'State item must have name');
  }
});

test('Config: SPECIALTIES has all required keys and properties', () => {
  const keys = Object.keys(SPECIALTIES);
  assert.ok(keys.length >= 7, 'Should have at least 7 specialties');

  const expectedSpecialties = [
    'imaging_radiology',
    'dialysis_specialty',
    'behavioral_health',
    'surgery_centers',
    'emergency_physicians',
    'orthopaedic',
    'neurology',
  ];

  for (const exp of expectedSpecialties) {
    assert.ok(SPECIALTIES[exp], `Specialty ${exp} should exist`);
    const s = SPECIALTIES[exp];
    assert.ok(s.label, `${exp} must have label`);
    assert.ok(s.taxonomy_query, `${exp} must have taxonomy_query`);
    assert.ok(s.default_pain_point, `${exp} must have default_pain_point`);
    assert.ok(s.ask_for, `${exp} must have ask_for`);
  }
});

