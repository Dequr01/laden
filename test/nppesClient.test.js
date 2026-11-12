import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPhone,
  toTitleCase,
  parseProviderRecord,
  searchLeadsForSpecialty,
} from '../nppesClient.js';

test('NPPES Client: formatPhone formats phone numbers correctly', () => {
  assert.equal(formatPhone('6175551234'), '(617) 555-1234');
  assert.equal(formatPhone('16175551234'), '(617) 555-1234');
  assert.equal(formatPhone('(617) 555-1234'), '(617) 555-1234');
  assert.equal(formatPhone(''), '');
  assert.equal(formatPhone(null), '');
  assert.equal(formatPhone('555-123'), '555-123');
});

test('NPPES Client: toTitleCase formats strings properly', () => {
  assert.equal(toTitleCase('BOSTON MEDICAL CENTER'), 'Boston Medical Center');
  assert.equal(toTitleCase('john doe'), 'John Doe');
  assert.equal(toTitleCase(''), '');
  assert.equal(toTitleCase(null), '');
});

test('NPPES Client: parseProviderRecord parses NPI-2 facility record', () => {
  const mockRecord = {
    number: '1234567890',
    enumeration_type: 'NPI-2',
    basic: {
      organization_name: 'BAYSTATE ORTHOPEDIC SURGERY LLC',
      authorized_official_first_name: 'SARAH',
      authorized_official_last_name: 'CONNOR',
      authorized_official_title_or_position: 'PRACTICE MANAGER',
      authorized_official_telephone_number: '6175559999',
    },
    addresses: [
      {
        address_purpose: 'LOCATION',
        address_1: '100 MAIN STREET',
        address_2: 'SUITE 400',
        city: 'BOSTON',
        state: 'MA',
        postal_code: '021151234',
        telephone_number: '6175551234',
        fax_number: '6175551235',
      },
    ],
    taxonomies: [
      {
        code: '207X00000X',
        desc: 'Orthopaedic Surgery',
        primary: true,
      },
    ],
  };

  const lead = parseProviderRecord(mockRecord, 'orthopaedic', 'MA');
  assert.ok(lead, 'Parsed lead should not be null');
  assert.equal(lead.npi, '1234567890');
  assert.equal(lead.type, 'Facility/Org');
  assert.equal(lead.facility_name, 'Baystate Orthopedic Surgery Llc');
  assert.equal(lead.specialty, 'Orthopaedic');
  assert.equal(lead.front_desk_phone, '(617) 555-1234');
  assert.equal(lead.official_contact, 'Sarah Connor (Practice Manager)');
  assert.equal(lead.city, 'Boston');
  assert.equal(lead.state, 'MA');
  assert.equal(lead.zip_code, '02115-1234');
  assert.equal(lead.street_address, '100 Main Street Suite 400');
  assert.ok(lead.calling_script.includes('Orthopaedic Practice Administrator'));
});

test('NPPES Client: parseProviderRecord rejects non-matching state', () => {
  const mockRecord = {
    number: '1234567890',
    enumeration_type: 'NPI-2',
    basic: { organization_name: 'NY HEALTH' },
    addresses: [{ address_purpose: 'LOCATION', state: 'NY' }],
  };

  const lead = parseProviderRecord(mockRecord, 'orthopaedic', 'MA');
  assert.equal(lead, null, 'Should return null if lead state does not match target state');
});

test('NPPES Client: Live search and exclusion deduplication', async () => {
  // Query batch 1 (2 leads)
  const batch1 = await searchLeadsForSpecialty('MA', 'orthopaedic', 2, null, []);
  assert.ok(Array.isArray(batch1));
  assert.equal(batch1.length, 2, 'Should return 2 leads');
  const npis1 = batch1.map(l => l.npi);

  // Query batch 2 excluding batch 1
  const batch2 = await searchLeadsForSpecialty('MA', 'orthopaedic', 2, null, npis1);
  assert.ok(Array.isArray(batch2));
  assert.equal(batch2.length, 2, 'Should return 2 leads in batch 2');
  const npis2 = batch2.map(l => l.npi);

  const overlap = npis1.filter(n => npis2.includes(n));
  assert.equal(overlap.length, 0, `Expected 0 overlap between batches, but got ${overlap.join(', ')}`);
});
