/**
 * CMS NPPES API Client for retrieving US medical practices and clinics in Node.js.
 */

import { SPECIALTIES } from './config.js';

export const NPPES_API_URL = 'https://npiregistry.cms.hhs.gov/api/';

/**
 * Helper to convert strings to Title Case.
 */
export function toTitleCase(s) {
  return s ? String(s).toLowerCase().replace(/\b([a-z])/g, (_, c) => String.fromCharCode(c.charCodeAt(0) ^ 0x20)).trim() : '';
}

/**
 * Format 10-digit phone number as (XXX) XXX-XXXX.
 */
export function formatPhone(p) {
  if (!p) return '';
  const d = String(p).replace(/\D/g, ''), n = d.length;
  return (n === 10 || (n === 11 && d.charCodeAt(0) === 0x31)) ? ((o) => `\x28${d.slice(o, o + 3)}\x29 ${d.slice(o + 3, o + 6)}\x2d${d.slice(o + 6)}`)(n & 1) : String(p).trim();
}

/**
 * Extract clean lead fields from an NPPES API result.
 */
export function parseProviderRecord(res, specialtyKey, targetState) {
  const basic = res.basic || {};
  const enumType = res.enumeration_type || '';
  const npi = String(res.number || '');

  // Find practice location address (preferred over mailing)
  const addresses = res.addresses || [];
  let locAddress = addresses.find(a => a.address_purpose === 'LOCATION');
  if (!locAddress && addresses.length > 0) {
    locAddress = addresses[0];
  }

  // Verify state matches target state
  const leadState = (locAddress?.state || '').toUpperCase();
  if (!leadState) return null;
  if (targetState.toUpperCase() !== 'ALL' && leadState !== targetState.toUpperCase()) {
    return null;
  }

  // Determine Facility / Practice Name
  let practiceName = '';
  if (enumType === 'NPI-2') {
    practiceName = toTitleCase(basic.organization_name || '');
  } else {
    const first = toTitleCase(basic.first_name || '');
    const last = toTitleCase(basic.last_name || '');
    const credential = (basic.credential || '').trim();
    practiceName = `${first} ${last}`.trim();
    if (credential) {
      practiceName += `, ${credential}`;
    }
  }

  if (!practiceName) return null;

  // Front Desk Phone (Location Phone)
  const phone = formatPhone(locAddress?.telephone_number);
  const fax = formatPhone(locAddress?.fax_number);

  // Authorized Official / Office Contact
  const officialFirst = toTitleCase(basic.authorized_official_first_name || '');
  const officialLast = toTitleCase(basic.authorized_official_last_name || '');
  const officialTitle = toTitleCase(basic.authorized_official_title_or_position || '');
  const officialPhone = formatPhone(basic.authorized_official_telephone_number);

  let officialContact = '';
  if (officialFirst || officialLast) {
    const contactName = `${officialFirst} ${officialLast}`.trim();
    officialContact = officialTitle ? `${contactName} (${officialTitle})` : contactName;
  } else if (enumType === 'NPI-1') {
    officialContact = practiceName;
  } else {
    officialContact = 'Office Manager / Practice Administrator';
  }

  // Address
  const addressLine1 = toTitleCase(locAddress?.address_1 || '');
  const addressLine2 = toTitleCase(locAddress?.address_2 || '');
  const city = toTitleCase(locAddress?.city || '');
  const state = leadState;
  let postal = String(locAddress?.postal_code || '').trim();
  if (postal.length > 5) {
    postal = `${postal.slice(0, 5)}-${postal.slice(5, 9)}`;
  }
  const fullStreet = `${addressLine1} ${addressLine2}`.trim();

  // Taxonomy / Specialty info
  const taxonomies = res.taxonomies || [];
  const primaryTax = taxonomies.find(t => t.primary) || taxonomies[0] || {};
  const taxonomyDesc = primaryTax.desc || '';
  const taxonomyCode = primaryTax.code || '';

  const specInfo = SPECIALTIES[specialtyKey] || {};
  const specialtyLabel = specInfo.label || toTitleCase(specialtyKey);
  const defaultPain = specInfo.default_pain_point || '';
  const askFor = specInfo.ask_for || 'Practice Administrator';

  return {
    npi,
    type: enumType === 'NPI-2' ? 'Facility/Org' : 'Provider/Practice',
    facility_name: practiceName,
    specialty: specialtyLabel,
    taxonomy_desc: taxonomyDesc,
    taxonomy_code: taxonomyCode,
    front_desk_phone: phone,
    fax,
    official_contact: officialContact,
    official_phone: officialPhone || phone,
    target_person_to_ask: askFor,
    street_address: fullStreet,
    city,
    state,
    zip_code: postal,
    purpose_of_contact: defaultPain,
    calling_script: `Hi, I'm calling for the ${askFor}. We help ${specialtyLabel.toLowerCase()} practices resolve ${defaultPain.toLowerCase()}`,
  };
}

/**
 * Query NPPES for a specific specialty and state, excluding already shown NPIs.
 */
export async function searchLeadsForSpecialty(
  state,
  specialtyKey,
  limit = 25,
  enumerationType = null,
  excludeNpis = []
) {
  const specInfo = SPECIALTIES[specialtyKey];
  if (!specInfo) return [];

  const taxQuery = specInfo.taxonomy_query;
  const leads = [];
  const seenNpis = new Set((excludeNpis || []).map(n => String(n).trim()));

  const fetchLimit = Math.min(Math.max(limit * 2, 20), 200);
  const typesToQuery = enumerationType ? [enumerationType] : ['NPI-2', 'NPI-1'];

  for (const etype of typesToQuery) {
    if (leads.length >= limit) break;

    let skip = 0;
    let maxPages = Math.max(6, Math.floor(limit / 15) + 3);

    while (leads.length < limit && maxPages > 0) {
      maxPages--;

      const params = new URLSearchParams({
        version: '2.1',
        taxonomy_description: taxQuery,
        limit: String(fetchLimit),
        skip: String(skip),
      });

      if (state.toUpperCase() !== 'ALL') {
        params.set('state', state.toUpperCase());
      }
      if (etype) {
        params.set('enumeration_type', etype);
      }

      const url = `${NPPES_API_URL}?${params.toString()}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
          console.warn(`CMS NPPES returned HTTP ${resp.status} for taxonomy '${taxQuery}'`);
          break;
        }

        const data = await resp.json();
        const results = data.results || [];
        if (results.length === 0) break;

        for (const item of results) {
          const parsed = parseProviderRecord(item, specialtyKey, state);
          if (parsed && !seenNpis.has(String(parsed.npi))) {
            seenNpis.add(String(parsed.npi));
            leads.push(parsed);
            if (leads.length >= limit) break;
          }
        }

        skip += results.length;
        if (results.length < fetchLimit) break;

      } catch (err) {
        console.error(`Error querying NPPES for ${specialtyKey} (${etype}):`, err.message);
        break;
      }
    }
  }

  return leads.slice(0, limit);
}

/**
 * Concurrent lead search across multiple specialties.
 */
export async function searchLeadsForMultipleSpecialties(state, specialties, limit = 10, excludeNpis = []) {
  const promises = specialties.map(specKey =>
    searchLeadsForSpecialty(state, specKey, limit, null, excludeNpis)
  );
  const results = await Promise.all(promises);
  return results.flat();
}
