/**
 * OpenAI enrichment service for clinical lead generation in Node.js.
 */

import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

/**
 * Retrieve OpenAI client if API key is present.
 */
export function getOpenAIClient() {
  const apiKey = (process.env.API_KEY || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

/**
 * Enrich a batch of leads with custom sales talking points and front-desk phone scripts.
 * Falls back gracefully to default templates if OpenAI is not available.
 */
export async function enrichLeadBatch(leads, batchSize = 5) {
  const client = getOpenAIClient();
  if (!client) {
    console.log(`[OPENAI] Using baseline default cold-call scripts for ${leads.length} leads (no API key configured)`);
    return leads;
  }
  if (!leads || leads.length === 0) {
    return leads;
  }

  const totalChunks = Math.ceil(leads.length / batchSize);
  console.log(`[OPENAI] Starting AI script generation for ${leads.length} leads in ${totalChunks} batch(es) (model: gpt-4o-mini)...`);

  for (let i = 0; i < leads.length; i += batchSize) {
    const chunk = leads.slice(i, i + batchSize);
    const chunkIndex = Math.floor(i / batchSize) + 1;
    console.log(`[OPENAI] Dispatching chunk ${chunkIndex}/${totalChunks} (${chunk.length} leads) to OpenAI...`);

    const itemsPayload = chunk.map(lead => ({
      npi: lead.npi,
      facility_name: lead.facility_name,
      specialty: lead.specialty,
      city: lead.city,
      state: lead.state,
      official_contact: lead.official_contact,
      target_person: lead.target_person_to_ask,
      pain_point: lead.purpose_of_contact,
    }));

    const prompt = `
You are an expert sales strategist for clinical revenue cycle management (RCM) and medical billing services.
Generate a concise Purpose of Contact and a natural 2-sentence Front Desk Calling Script for each medical provider below.

Target provider data:
${JSON.stringify(itemsPayload, null, 2)}

Output a valid JSON array of objects with these exact keys:
[
  {
    "npi": "provider npi",
    "purpose_of_contact": "1-2 sentences: the specific billing/authorization pain point to discuss with their office",
    "calling_script": "2 sentences: conversational phone opener for the sales rep speaking to the front desk to reach the office manager / decision maker"
  }
]
Respond with JSON only, no markdown ticks.
`;

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a specialized medical sales assistant. Return strictly valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      });

      let rawText = (response.choices[0]?.message?.content || '').trim();
      if (rawText.startsWith('```')) {
        rawText = rawText.split('```')[1] || '';
        if (rawText.startsWith('json')) {
          rawText = rawText.slice(4).trim();
        }
      }

      const enrichments = JSON.parse(rawText);
      const lookup = new Map();
      if (Array.isArray(enrichments)) {
        for (const item of enrichments) {
          if (item && item.npi) {
            lookup.set(String(item.npi), item);
          }
        }
      }

      for (const lead of chunk) {
        const enriched = lookup.get(String(lead.npi));
        if (enriched) {
          if (enriched.purpose_of_contact) lead.purpose_of_contact = enriched.purpose_of_contact;
          if (enriched.calling_script) lead.calling_script = enriched.calling_script;
        }
      }

      console.log(`[OPENAI] Chunk ${chunkIndex}/${totalChunks} successfully enriched (${lookup.size} scripts generated)`);

    } catch (err) {
      console.error(`[OPENAI] Error enriching chunk ${chunkIndex}/${totalChunks} with OpenAI:`, err.message);
      // Keep original default values on error
    }
  }

  console.log(`[OPENAI] Lead enrichment complete for all ${leads.length} leads`);
  return leads;
}
