# Clinical & Medical Practice Lead Generator

An office tool to search US medical providers, enrich them with front-desk calling scripts, and export directly to Excel (.xlsx) and CSV.

---

## Features

- **Live US Provider Data:** Connects directly to the CMS NPPES NPI Registry.
- **Target States:** High disposable income states (Massachusetts prioritized, NY, CA, NJ, CT, etc.).
- **11 Medical Specialties:**
  - Imaging & Radiology
  - Dialysis & Specialty Clinics
  - Behavioral Health / TMS
  - Surgery Centers (ASCs)
  - Emergency Physician Groups
  - Orthopaedic
  - Neurology
  - Dermatology
  - Endocrinology
  - GP / Family Practice
  - Physicians & Clinics
- **OpenAI Calling Script Generator:** Writes 2-sentence conversational phone scripts for office callers.
- **Office Exports:** Formatted Excel (`.xlsx`) with styling and clean CSV (`.csv`).

---

## How to Run

### Option 1: Web Dashboard with Node.js (Recommended)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the web app:
   ```bash
   npm start
   ```
   *(or run `./start.sh`)*
3. Open in your browser:
   **[http://localhost:8000](http://localhost:8000)**

4. Run tests:
   ```bash
   npm test
   ```

---

### Option 2: Command Line (CLI)

Generate leads directly into an Excel file:

```bash
# Node.js CLI:
node server.js --cli --state MA --specialty orthopaedic --limit 10 --output leads.xlsx

# Python CLI (alternative):
python3 main.py --cli --state MA --specialty orthopaedic --limit 10 --output leads.xlsx
```

