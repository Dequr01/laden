"""OpenAI enrichment service for clinical lead generation."""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
logger = logging.getLogger("OPENAI")


def get_openai_client() -> Optional[OpenAI]:
    """Retrieve OpenAI client if API key is present."""
    api_key = os.getenv("API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("No API_KEY or OPENAI_API_KEY found in environment. AI enrichment disabled.")
        return None
    return OpenAI(api_key=api_key.strip())


def enrich_lead_batch(leads: List[Dict[str, Any]], batch_size: int = 5) -> List[Dict[str, Any]]:
    """
    Enrich a batch of leads with custom sales talking points and front-desk phone scripts.
    Falls back gracefully to default templates if OpenAI is not available.
    """
    client = get_openai_client()
    if not client:
        logger.info("Using baseline default cold-call scripts for %d leads (no OpenAI client)", len(leads))
        return leads
    if not leads:
        return leads

    total_chunks = (len(leads) + batch_size - 1) // batch_size
    logger.info("Starting AI script generation for %d leads in %d batch(es) (model: gpt-4o-mini)...", len(leads), total_chunks)

    # Process in manageable chunks
    for idx, i in enumerate(range(0, len(leads), batch_size), start=1):
        chunk = leads[i : i + batch_size]
        logger.info("Dispatching chunk %d/%d (%d leads) to OpenAI...", idx, total_chunks, len(chunk))
        items_payload = []
        for lead in chunk:
            items_payload.append({
                "npi": lead["npi"],
                "facility_name": lead["facility_name"],
                "specialty": lead["specialty"],
                "city": lead["city"],
                "state": lead["state"],
                "official_contact": lead["official_contact"],
                "target_person": lead["target_person_to_ask"],
                "pain_point": lead["purpose_of_contact"],
            })

        prompt = f"""
You are an expert sales strategist for clinical revenue cycle management (RCM) and medical billing services.
Generate a concise Purpose of Contact and a natural 2-sentence Front Desk Calling Script for each medical provider below.

Target provider data:
{json.dumps(items_payload, indent=2)}

Output a valid JSON array of objects with these exact keys:
[
  {{
    "npi": "provider npi",
    "purpose_of_contact": "1-2 sentences: the specific billing/authorization pain point to discuss with their office",
    "calling_script": "2 sentences: conversational phone opener for the sales rep speaking to the front desk to reach the office manager / decision maker"
  }}
]
Respond with JSON only, no markdown ticks.
"""
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a specialized medical sales assistant. Return strictly valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                max_tokens=1500,
            )
            raw_text = response.choices[0].message.content.strip()
            # Clean markdown formatting if present
            if raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:].strip()
            
            enrichments = json.loads(raw_text)
            lookup = {item["npi"]: item for item in enrichments if "npi" in item}

            for lead in chunk:
                if lead["npi"] in lookup:
                    lead["purpose_of_contact"] = lookup[lead["npi"]].get("purpose_of_contact", lead["purpose_of_contact"])
                    lead["calling_script"] = lookup[lead["npi"]].get("calling_script", lead["calling_script"])

            logger.info("Chunk %d/%d successfully enriched (%d scripts generated)", idx, total_chunks, len(enrichments))

        except Exception as e:
            logger.error("Error enriching chunk %d/%d with OpenAI: %s", idx, total_chunks, e)
            # Keep original default values on error

    logger.info("OpenAI lead enrichment complete for all %d leads", len(leads))
    return leads

