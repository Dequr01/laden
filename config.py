"""Configuration and mappings for clinical lead generation."""

# High disposable income US states (Massachusetts prioritized)
TARGET_STATES = [
    {"code": "ALL", "name": "All Target States (National Outreach)"},
    {"code": "MA", "name": "Massachusetts (Primary Target)"},
    {"code": "NY", "name": "New York"},
    {"code": "CA", "name": "California"},
    {"code": "NJ", "name": "New Jersey"},
    {"code": "CT", "name": "Connecticut"},
    {"code": "WA", "name": "Washington"},
    {"code": "MD", "name": "Maryland"},
    {"code": "VA", "name": "Virginia"},
    {"code": "IL", "name": "Illinois"},
    {"code": "TX", "name": "Texas"},
    {"code": "FL", "name": "Florida"},
]

# Target Specialties with CMS taxonomy queries and baseline pain points
SPECIALTIES = {
    "imaging_radiology": {
        "label": "Imaging & Radiology",
        "taxonomy_query": "Radiology",
        "default_pain_point": "Prior authorizations, medical-necessity denials, high-cost claims, and AR follow-up.",
        "ask_for": "Radiology Practice Manager / Billing Director",
    },
    "dialysis_specialty": {
        "label": "Dialysis & Specialty Clinics",
        "taxonomy_query": "Dialysis",
        "default_pain_point": "Eligibility verification, recurring treatment claims, coordination of benefits, and denial management.",
        "ask_for": "Clinical Administrator / Revenue Cycle Manager",
    },
    "behavioral_health": {
        "label": "Behavioral Health / TMS",
        "taxonomy_query": "Psychiatry",
        "default_pain_point": "Treatment authorizations, session visit limits, clinical documentation, and claim follow-up.",
        "ask_for": "Practice Manager / Clinical Operations Director",
    },
    "surgery_centers": {
        "label": "Surgery Centers / ASCs",
        "taxonomy_query": "Ambulatory Surgical",
        "default_pain_point": "Pre-service surgical authorization, high-dollar implant claims, and out-of-network workflow support.",
        "ask_for": "ASC Administrator / Business Office Director",
    },
    "emergency_physicians": {
        "label": "Emergency Physician Groups",
        "taxonomy_query": "Emergency Medicine",
        "default_pain_point": "High-volume claim follow-up, complex commercial payer issues, and aged AR project recovery.",
        "ask_for": "Practice Executive Director / RCM Lead",
    },
    "orthopaedic": {
        "label": "Orthopaedic",
        "taxonomy_query": "Orthopaedic Surgery",
        "default_pain_point": "Complex surgical pre-authorizations, DME billing, implant reimbursement, and aging surgical AR.",
        "ask_for": "Orthopaedic Practice Administrator / Billing Supervisor",
    },
    "neurology": {
        "label": "Neurology",
        "taxonomy_query": "Neurology",
        "default_pain_point": "Pre-authorization for diagnostic testing (EEG/EMG), chronic care management, and infusion therapy billing.",
        "ask_for": "Clinic Manager / Billing Coordinator",
    },
    "dermatology": {
        "label": "Dermatology",
        "taxonomy_query": "Dermatology",
        "default_pain_point": "Cosmetic vs. medical necessity denials, biopsy coding, and prior authorizations for biologics.",
        "ask_for": "Office Manager / Lead Medical Biller",
    },
    "endocrinology": {
        "label": "Endocrinology",
        "taxonomy_query": "Endocrinology",
        "default_pain_point": "Continuous Glucose Monitor (CGM) and insulin pump authorizations, and multi-payer coordination.",
        "ask_for": "Practice Coordinator / Reimbursement Specialist",
    },
    "gp_family_practice": {
        "label": "GP / Family Practice",
        "taxonomy_query": "Family Medicine",
        "default_pain_point": "High-volume patient access, prior authorization overhead, claim denials, and administrative workflow support.",
        "ask_for": "Front Office Manager / Practice Administrator",
    },
    "physicians_clinics": {
        "label": "Physicians & Multi-Specialty Clinics",
        "taxonomy_query": "Clinic/Center",
        "default_pain_point": "Prior authorization burden, patient access bottlenecks, billing support, and administrative workflows.",
        "ask_for": "Practice Administrator / Office Supervisor",
    },
}

