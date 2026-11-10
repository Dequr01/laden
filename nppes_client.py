"""CMS NPPES API Client for retrieving US medical practices and clinics."""

import re
import logging
from typing import List, Dict, Any, Optional
import requests
from config import SPECIALTIES

logger = logging.getLogger("NPPES")
NPPES_API_URL = "https://npiregistry.cms.hhs.gov/api/"


def format_phone(phone_raw: Optional[str]) -> str:
    """Format 10-digit phone number as (XXX) XXX-XXXX."""
    if not phone_raw:
        return ""
    digits = re.sub(r"\D", "", phone_raw)
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits.startswith("1"):
        return f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    return phone_raw.strip()


def parse_provider_record(res: Dict[str, Any], specialty_key: str, target_state: str) -> Optional[Dict[str, Any]]:
    """Extract clean lead fields from an NPPES API result."""
    basic = res.get("basic", {})
    enum_type = res.get("enumeration_type", "")
    npi = str(res.get("number", ""))

    # Find practice location address (preferred over mailing)
    addresses = res.get("addresses", [])
    loc_address = next((a for a in addresses if a.get("address_purpose") == "LOCATION"), None)
    if not loc_address and addresses:
        loc_address = addresses[0]

    # Verify state matches target state
    lead_state = (loc_address.get("state") or "").upper() if loc_address else ""
    if not lead_state:
        return None
    if target_state.upper() != "ALL" and lead_state != target_state.upper():
        return None

    # Determine Facility / Practice Name
    if enum_type == "NPI-2":
        practice_name = basic.get("organization_name", "").strip().title()
    else:
        first = basic.get("first_name", "").strip().title()
        last = basic.get("last_name", "").strip().title()
        credential = basic.get("credential", "").strip()
        practice_name = f"{first} {last}"
        if credential:
            practice_name += f", {credential}"

    if not practice_name:
        return None

    # Front Desk Phone (Location Phone)
    phone = format_phone(loc_address.get("telephone_number"))
    fax = format_phone(loc_address.get("fax_number"))

    # Authorized Official / Office Contact
    official_first = basic.get("authorized_official_first_name", "").strip().title()
    official_last = basic.get("authorized_official_last_name", "").strip().title()
    official_title = basic.get("authorized_official_title_or_position", "").strip().title()
    official_phone = format_phone(basic.get("authorized_official_telephone_number"))

    if official_first or official_last:
        contact_name = f"{official_first} {official_last}".strip()
        if official_title:
            official_contact = f"{contact_name} ({official_title})"
        else:
            official_contact = contact_name
    elif enum_type == "NPI-1":
        official_contact = practice_name
    else:
        official_contact = "Office Manager / Practice Administrator"

    # Address
    address_line1 = (loc_address.get("address_1") or "").strip().title()
    address_line2 = (loc_address.get("address_2") or "").strip().title()
    city = (loc_address.get("city") or "").strip().title()
    state = lead_state
    postal = (loc_address.get("postal_code") or "").strip()
    if len(postal) > 5:
        postal = f"{postal[:5]}-{postal[5:9]}"

    full_street = f"{address_line1} {address_line2}".strip()

    # Taxonomy / Specialty info
    taxonomies = res.get("taxonomies", [])
    primary_tax = next((t for t in taxonomies if t.get("primary")), taxonomies[0] if taxonomies else {})
    taxonomy_desc = primary_tax.get("desc", "")
    taxonomy_code = primary_tax.get("code", "")

    spec_info = SPECIALTIES.get(specialty_key, {})
    specialty_label = spec_info.get("label", specialty_key.title())
    default_pain = spec_info.get("default_pain_point", "")
    ask_for = spec_info.get("ask_for", "Practice Administrator")

    return {
        "npi": npi,
        "type": "Facility/Org" if enum_type == "NPI-2" else "Provider/Practice",
        "facility_name": practice_name,
        "specialty": specialty_label,
        "taxonomy_desc": taxonomy_desc,
        "taxonomy_code": taxonomy_code,
        "front_desk_phone": phone,
        "fax": fax,
        "official_contact": official_contact,
        "official_phone": official_phone or phone,
        "target_person_to_ask": ask_for,
        "street_address": full_street,
        "city": city,
        "state": state,
        "zip_code": postal,
        "purpose_of_contact": default_pain,
        "calling_script": f"Hi, I'm calling for the {ask_for}. We help {specialty_label.lower()} practices resolve {default_pain.lower()}",
    }


def search_leads_for_specialty(
    state: str,
    specialty_key: str,
    limit: int = 25,
    enumeration_type: Optional[str] = None,
    exclude_npis: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Query NPPES for a specific specialty and state, excluding already shown NPIs."""
    spec_info = SPECIALTIES.get(specialty_key)
    if not spec_info:
        return []

    tax_query = spec_info["taxonomy_query"]
    leads: List[Dict[str, Any]] = []
    seen_npis = set(str(n).strip() for n in (exclude_npis or []))

    fetch_limit = min(max(limit * 2, 20), 200)
    types_to_query = [enumeration_type] if enumeration_type else ["NPI-2", "NPI-1"]

    for etype in types_to_query:
        if len(leads) >= limit:
            break

        skip = 0
        max_pages = 6  # Paginate up to 6 batches to filter out previously shown records
        max_pages = max(6, (limit // 15) + 3)  # Dynamic pagination to satisfy custom lead counts and exclusions

        while len(leads) < limit and max_pages > 0:
            max_pages -= 1
            params = {
                "version": "2.1",
                "taxonomy_description": tax_query,
                "limit": fetch_limit,
                "skip": skip,
            }
            if state.upper() != "ALL":
                params["state"] = state.upper()
            if etype:
                params["enumeration_type"] = etype

            logger.info(
                "Querying CMS API: taxonomy='%s' | state='%s' | type='%s' | skip=%d | fetch_limit=%d",
                tax_query,
                state.upper(),
                etype or "ALL",
                skip,
                fetch_limit,
            )

            try:
                resp = requests.get(NPPES_API_URL, params=params, timeout=12)
                if resp.status_code != 200:
                    logger.warning("CMS NPPES returned HTTP %d for taxonomy '%s'", resp.status_code, tax_query)
                    break

                data = resp.json()
                results = data.get("results", [])
                logger.info("Received %d records from CMS NPPES (type=%s, skip=%d)", len(results), etype or "ALL", skip)
                if not results:
                    break

                accepted_in_batch = 0
                for item in results:
                    parsed = parse_provider_record(item, specialty_key, state)
                    if parsed and str(parsed["npi"]) not in seen_npis:
                        seen_npis.add(str(parsed["npi"]))
                        leads.append(parsed)
                        accepted_in_batch += 1
                        if len(leads) >= limit:
                            break

                logger.info(
                    "Processed batch: accepted %d new unseen leads (current total: %d / target: %d)",
                    accepted_in_batch,
                    len(leads),
                    limit,
                )

                skip += len(results)
                if len(results) < fetch_limit:
                    break

            except Exception as e:
                logger.error("Error querying NPPES for %s (%s): %s", specialty_key, etype, e)
                break

    return leads[:limit]

