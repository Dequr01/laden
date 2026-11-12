import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../server.js';

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('Server: GET / serves HTML single-page application', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('Clinical & Medical Practice Lead Generator') || html.includes('LeadPulse'));
  assert.ok(html.includes('id="stateSelect"'));
  assert.ok(html.includes('id="limitSelect"'));
});

test('Server: GET /api/config returns states and specialties', async () => {
  const res = await fetch(`${baseUrl}/api/config`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.states));
  assert.ok(data.specialties && typeof data.specialties === 'object');
  assert.ok(data.specialties.orthopaedic);
});

test('Server: POST /api/leads/search queries CMS and returns leads', async () => {
  const payload = {
    state: 'MA',
    specialties: ['orthopaedic'],
    limit_per_specialty: 2,
    ai_enrich: false,
    exclude_npis: [],
  };

  const res = await fetch(`${baseUrl}/api/leads/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.state, 'MA');
  assert.ok(Array.isArray(data.leads));
  assert.equal(data.leads.length, 2);
  assert.ok(data.leads[0].facility_name);
  assert.ok(data.leads[0].npi);
  assert.equal(data.leads[0].specialty, 'Orthopaedic');
});

test('Server: POST /api/leads/export/excel returns formatted Excel sheet', async () => {
  const sampleLeads = [
    {
      npi: '1234567890',
      facility_name: 'Test Surgery Center',
      specialty: 'Surgery Centers / ASCs',
      front_desk_phone: '(617) 555-1111',
      city: 'Boston',
      state: 'MA',
    },
  ];

  const res = await fetch(`${baseUrl}/api/leads/export/excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads: sampleLeads }),
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const buffer = await res.arrayBuffer();
  assert.ok(buffer.byteLength > 500);
});

test('Server: POST /api/leads/export/csv returns valid CSV stream', async () => {
  const sampleLeads = [
    {
      npi: '1234567890',
      facility_name: 'Test Surgery Center',
      specialty: 'Surgery Centers / ASCs',
      front_desk_phone: '(617) 555-1111',
      city: 'Boston',
      state: 'MA',
    },
  ];

  const res = await fetch(`${baseUrl}/api/leads/export/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads: sampleLeads }),
  });

  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/csv'));
  const text = await res.text();
  assert.ok(text.includes('Test Surgery Center'));
  assert.ok(text.includes('1234567890'));
});
