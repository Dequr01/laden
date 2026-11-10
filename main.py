"""Main application entry point for the Clinical Lead Generator."""

import os
import argparse
import logging
import sys
import time
from typing import List, Optional
from fastapi import FastAPI, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import io

# Configure verbose application logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("APP")

from config import TARGET_STATES, SPECIALTIES
from nppes_client import search_leads_for_specialty
from ai_enricher import enrich_lead_batch
from exporter import generate_excel_bytes, generate_csv_bytes

app = FastAPI(title="Clinical Lead Generator")

# Models
class SearchRequest(BaseModel):
    state: str = "MA"
    specialties: List[str]
    limit_per_specialty: int = 10
    ai_enrich: bool = False
    exclude_npis: List[str] = []

class ExportRequest(BaseModel):
    leads: List[dict]


@app.get("/api/config")
async def get_config():
    """Return available states and specialties."""
    logger.info("API: get_config() called -> returning %d states and %d specialties", len(TARGET_STATES), len(SPECIALTIES))
    return {
        "states": TARGET_STATES,
        "specialties": SPECIALTIES,
    }


@app.post("/api/leads/search")
async def search_leads(req: SearchRequest):
    """Search leads across selected specialties and state, enriched with AI."""
    start_time = time.time()
    logger.info(
        "--> [SEARCH START] Target State: '%s' | Specialties: %s | Limit/Spec: %d | AI: %s | Excluded Shown NPIs: %d",
        req.state,
        req.specialties,
        req.limit_per_specialty,
        req.ai_enrich,
        len(req.exclude_npis),
    )
    all_leads = []
    
    for idx, spec_key in enumerate(req.specialties, start=1):
        spec_start = time.time()
        logger.info(
            "[%d/%d] Fetching leads for specialty '%s' in state '%s' (limit=%d, exclude_npis=%d)...",
            idx,
            len(req.specialties),
            spec_key,
            req.state,
            req.limit_per_specialty,
            len(req.exclude_npis),
        )
        leads = search_leads_for_specialty(
            state=req.state,
            specialty_key=spec_key,
            limit=req.limit_per_specialty,
            exclude_npis=req.exclude_npis,
        )
        all_leads.extend(leads)
        logger.info(
            "[%d/%d] Retrieved %d leads for '%s' in %.2fs (cumulative total: %d)",
            idx,
            len(req.specialties),
            len(leads),
            spec_key,
            time.time() - spec_start,
            len(all_leads),
        )

    if req.ai_enrich and all_leads:
        logger.info("[AI-ENRICHER] Starting OpenAI calling script generation for %d leads...", len(all_leads))
        enrich_start = time.time()
        all_leads = enrich_lead_batch(all_leads, batch_size=6)
        logger.info("[AI-ENRICHER] Completed AI script generation in %.2fs", time.time() - enrich_start)
    else:
        logger.info("[AI-ENRICHER] Skipped (AI script enrichment is disabled)")

    total_time = time.time() - start_time
    logger.info(
        "<-- [SEARCH COMPLETE] Succeeded in %.2fs | Total Leads: %d | State: '%s'",
        total_time,
        len(all_leads),
        req.state,
    )

    return {
        "total": len(all_leads),
        "state": req.state,
        "leads": all_leads,
    }


@app.post("/api/leads/export/excel")
async def export_excel(req: ExportRequest):
    """Export lead list to Excel (.xlsx)."""
    count = len(req.leads)
    logger.info("[EXPORT] Building formatted Excel workbook (.xlsx) for %d leads...", count)
    start_time = time.time()
    excel_data = generate_excel_bytes(req.leads)
    logger.info(
        "[EXPORT] Excel workbook created successfully (%d bytes, took %.2fs)",
        len(excel_data),
        time.time() - start_time,
    )
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="clinical_leads.xlsx"'},
    )


@app.post("/api/leads/export/csv")
async def export_csv(req: ExportRequest):
    """Export lead list to CSV."""
    count = len(req.leads)
    logger.info("[EXPORT] Building CSV (.csv) for %d leads...", count)
    start_time = time.time()
    csv_data = generate_csv_bytes(req.leads)
    logger.info(
        "[EXPORT] CSV created successfully (%d bytes, took %.2fs)",
        len(csv_data),
        time.time() - start_time,
    )
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="clinical_leads.csv"'},
    )


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    """Serve the single page web dashboard."""
    index_file = os.path.join(os.path.dirname(__file__), "static", "index.html")
    with open(index_file, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


def run_cli_mode(state: str, specialty: str, limit: int, output_file: str, enrich: bool):
    """CLI execution for direct terminal use."""
    print(f"[*] Searching NPPES for {specialty} in {state} (limit={limit})...")
    leads = search_leads_for_specialty(state=state, specialty_key=specialty, limit=limit)
    print(f"[+] Found {len(leads)} leads.")
    
    if enrich and leads:
        print("[*] Generating calling scripts with OpenAI...")
        leads = enrich_lead_batch(leads)

    if output_file.endswith(".xlsx"):
        content = generate_excel_bytes(leads)
        with open(output_file, "wb") as f:
            f.write(content)
        print(f"[✓] Saved Excel leads to {output_file}")
    else:
        content = generate_csv_bytes(leads)
        with open(output_file, "wb") as f:
            f.write(content)
        print(f"[✓] Saved CSV leads to {output_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clinical Lead Generator")
    parser.add_argument("--cli", action="store_true", help="Run in CLI mode instead of web server")
    parser.add_argument("--state", type=str, default="MA", help="Target state code (default: MA)")
    parser.add_argument("--specialty", type=str, default="orthopaedic", help="Specialty key")
    parser.add_argument("--limit", type=int, default=10, help="Number of leads")
    parser.add_argument("--output", type=str, default="leads.xlsx", help="Output file (.xlsx or .csv)")
    parser.add_argument("--port", type=int, default=8000, help="Web server port")
    parser.add_argument("--no-ai", action="store_true", help="Disable OpenAI enrichment")

    args = parser.parse_args()

    if args.cli:
        run_cli_mode(
            state=args.state,
            specialty=args.specialty,
            limit=args.limit,
            output_file=args.output,
            enrich=not args.no_ai
        )
    else:
        print(f"Starting Clinical Lead Generator web server on http://localhost:{args.port}")
        uvicorn.run("main:app", host="0.0.0.0", port=args.port, reload=True)

