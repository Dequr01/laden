import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enrichLeadBatch } from '../aiEnricher.js';

test('AI Enricher: gracefully handles empty array', async () => {
  const result = await enrichLeadBatch([]);
  assert.deepEqual(result, []);
});

test('AI Enricher: preserves lead properties on default fallback', async () => {
  const sampleLeads = [
    {
      npi: '9999999999',
      facility_name: 'Test Clinic',
      specialty: 'Orthopaedic',
      city: 'Boston',
      state: 'MA',
      official_contact: 'Manager',
      target_person_to_ask: 'Practice Administrator',
      purpose_of_contact: 'Baseline pain point',
      calling_script: 'Baseline script',
    },
  ];

  const result = await enrichLeadBatch(sampleLeads);
  assert.equal(result.length, 1);
  assert.equal(result[0].npi, '9999999999');
  assert.ok(result[0].purpose_of_contact);
  assert.ok(result[0].calling_script);
});

