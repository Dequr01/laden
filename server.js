/**
 * Main application entry point for the Clinical Lead Generator in Node.js.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { TARGET_STATES, SPECIALTIES } from './config.js';
import { searchLeadsForSpecialty } from './nppesClient.js';
import { enrichLeadBatch } from './aiEnricher.js';
import { generateExcelBuffer, generateCsvBuffer } from './exporter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Static assets (Single Page Application UI)
app.use(express.static(path.join(__dirname, 'static')));

/**
 * GET /api/config
 * Returns available states and specialties.
 */
app.get('/api/config', (req, res) => {
  res.json({
    states: TARGET_STATES,
    specialties: SPECIALTIES,
  });
});

/**
 * POST /api/leads/search
 * Search leads across selected specialties and state, enriched with AI.
 */
app.post('/api/leads/search', async (req, res) => {
  const startTime = Date.now();
  const state = req.body.state || 'MA';
  const specialties = Array.isArray(req.body.specialties) ? req.body.specialties : [];
  const limitPerSpecialty = parseInt(req.body.limit_per_specialty, 10) || 10;
  const aiEnrich = Boolean(req.body.ai_enrich);
  const excludeNpis = Array.isArray(req.body.exclude_npis) ? req.body.exclude_npis : [];

  console.log(`--> [SEARCH START] State: '${state}' | Specialties: [${specialties.join(', ')}] | Limit/Spec: ${limitPerSpecialty} | AI: ${aiEnrich} | Excluded: ${excludeNpis.length}`);

  try {
    // Concurrently fetch leads across all selected specialties
    const specialtyPromises = specialties.map(async (specKey, idx) => {
      const specStart = Date.now();
      const leads = await searchLeadsForSpecialty(state, specKey, limitPerSpecialty, null, excludeNpis);
      console.log(`   [${idx + 1}/${specialties.length}] Retrieved ${leads.length} leads for '${specKey}' in ${Date.now() - specStart}ms`);
      return leads;
    });

    const specialtyResults = await Promise.all(specialtyPromises);
    let allLeads = specialtyResults.flat();

    // AI Enrichment if requested
    if (aiEnrich && allLeads.length > 0) {
      console.log(`[AI-ENRICHER] Starting OpenAI script enrichment for ${allLeads.length} leads...`);
      const enrichStart = Date.now();
      allLeads = await enrichLeadBatch(allLeads, 6);
      console.log(`[AI-ENRICHER] Completed AI script generation in ${Date.now() - enrichStart}ms`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`<-- [SEARCH COMPLETE] Succeeded in ${duration}s | Total Leads: ${allLeads.length} | State: '${state}'`);

    res.json({
      total: allLeads.length,
      state,
      leads: allLeads,
    });
  } catch (err) {
    console.error('Error during search:', err);
    res.status(500).json({ error: 'Failed to search leads', message: err.message });
  }
});

/**
 * POST /api/leads/export/excel
 * Export leads to formatted Excel (.xlsx) file.
 */
app.post('/api/leads/export/excel', async (req, res) => {
  const leads = Array.isArray(req.body.leads) ? req.body.leads : [];
  try {
    const buffer = await generateExcelBuffer(leads);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="clinical_leads.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Error generating Excel export:', err);
    res.status(500).json({ error: 'Excel generation failed', message: err.message });
  }
});

/**
 * POST /api/leads/export/csv
 * Export leads to CSV file.
 */
app.post('/api/leads/export/csv', (req, res) => {
  const leads = Array.isArray(req.body.leads) ? req.body.leads : [];
  try {
    const buffer = generateCsvBuffer(leads);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clinical_leads.csv"');
    res.send(buffer);
  } catch (err) {
    console.error('Error generating CSV export:', err);
    res.status(500).json({ error: 'CSV generation failed', message: err.message });
  }
});

/**
 * Serve Single Page Dashboard on root
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

/**
 * CLI mode runner
 */
export async function runCliMode(state, specialty, limit, outputFile, enrich) {
  console.log(`[*] Searching NPPES for ${specialty} in ${state} (limit=${limit})...`);
  let leads = await searchLeadsForSpecialty(state, specialty, limit);
  console.log(`[+] Found ${leads.length} leads.`);

  if (enrich && leads.length > 0) {
    console.log('[*] Generating calling scripts with OpenAI...');
    leads = await enrichLeadBatch(leads);
  }

  if (outputFile.endsWith('.xlsx')) {
    const buffer = await generateExcelBuffer(leads);
    fs.writeFileSync(outputFile, buffer);
    console.log(`[✓] Saved Excel leads to ${outputFile}`);
  } else {
    const buffer = generateCsvBuffer(leads);
    fs.writeFileSync(outputFile, buffer);
    console.log(`[✓] Saved CSV leads to ${outputFile}`);
  }
}

// Start server if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const isCli = args.includes('--cli');

  if (isCli) {
    const getArg = (flag, def) => {
      const idx = args.indexOf(flag);
      return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
    };
    const state = getArg('--state', 'MA');
    const specialty = getArg('--specialty', 'orthopaedic');
    const limit = parseInt(getArg('--limit', '10'), 10);
    const output = getArg('--output', 'leads.xlsx');
    const noAi = args.includes('--no-ai');

    runCliMode(state, specialty, limit, output, !noAi);
  } else {
    const port = process.env.PORT || 8000;
    app.listen(port, () => {
      console.log(`Clinical Lead Generator (Node.js) server running at http://localhost:${port}`);
    });
  }
}
