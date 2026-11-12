import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCsvBuffer, generateExcelBuffer, EXPORT_COLUMNS } from '../exporter.js';

const sampleLeads = [
  {
    npi: '1659319143',
    type: 'Facility/Org',
    facility_name: 'MetroWest Orthopedic Group',
    specialty: 'Orthopaedic',
    front_desk_phone: '(508) 555-1234',
    official_contact: 'Jane Smith (CEO)',
    target_person_to_ask: 'Practice Administrator',
    street_address: '150 Forest St Suite 2',
    city: 'Marlborough',
    state: 'MA',
    zip_code: '01752',
    purpose_of_contact: 'Complex surgical pre-authorizations and aging AR.',
    calling_script: "Hi, I'm calling for the Practice Administrator...",
  },
  {
    npi: '1902949704',
    type: 'Provider/Practice',
    facility_name: 'Dr. John Miller, MD',
    specialty: 'Orthopaedic',
    front_desk_phone: '(617) 555-9876',
    official_contact: 'Dr. John Miller',
    target_person_to_ask: 'Office Manager',
    street_address: '75 Cambridge Pkwy',
    city: 'Cambridge',
    state: 'MA',
    zip_code: '02142',
    purpose_of_contact: 'DME billing and implant reimbursement.',
    calling_script: "Hi, I'm calling for the Office Manager...",
  },
];

test('Exporter: generateCsvBuffer produces valid CSV with BOM and headers', () => {
  const buffer = generateCsvBuffer(sampleLeads);
  assert.ok(Buffer.isBuffer(buffer), 'Should return a Buffer');
  assert.ok(buffer.length > 0, 'Buffer should not be empty');

  const text = buffer.toString('utf-8');
  // Starts with UTF-8 BOM
  assert.equal(text.charCodeAt(0), 0xFEFF, 'Should start with UTF-8 BOM');

  const lines = text.slice(1).split('\r\n');
  assert.equal(lines.length, 3, 'Should have header + 2 data rows');

  // Verify headers match EXPORT_COLUMNS
  for (const col of EXPORT_COLUMNS) {
    assert.ok(lines[0].includes(`"${col.label}"`), `Header should include ${col.label}`);
  }

  // Verify sample lead values are present
  assert.ok(lines[1].includes('"MetroWest Orthopedic Group"'));
  assert.ok(lines[1].includes('"1659319143"'));
  assert.ok(lines[2].includes('"Dr. John Miller, MD"'));
});

test('Exporter: generateExcelBuffer produces valid Excel (.xlsx) file', async () => {
  const buffer = await generateExcelBuffer(sampleLeads);
  assert.ok(Buffer.isBuffer(buffer), 'Should return a Buffer');
  assert.ok(buffer.length > 500, 'Excel buffer should be non-trivial');

  // Check ZIP/XLSX magic bytes (PK\x03\x04)
  assert.equal(buffer[0], 0x50, 'Byte 0 should be P');
  assert.equal(buffer[1], 0x4B, 'Byte 1 should be K');
  assert.equal(buffer[2], 0x03, 'Byte 2 should be 0x03');
  assert.equal(buffer[3], 0x04, 'Byte 3 should be 0x04');
});

