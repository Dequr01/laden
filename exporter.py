"""Export utilities for generating Excel (.xlsx) and CSV files."""

import io
import logging
from typing import List, Dict, Any
import pandas as pd
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

logger = logging.getLogger("EXPORTER")


EXPORT_COLUMNS = [
    ("facility_name", "Practice / Facility Name"),
    ("specialty", "Target Specialty"),
    ("front_desk_phone", "Front Desk Phone"),
    ("official_contact", "Authorized Official / Contact"),
    ("target_person_to_ask", "Target Decision Maker"),
    ("street_address", "Street Address"),
    ("city", "City"),
    ("state", "State"),
    ("zip_code", "ZIP Code"),
    ("purpose_of_contact", "Purpose of Contact (Pain Point)"),
    ("calling_script", "Front Desk Calling Script"),
    ("npi", "NPI Number"),
    ("type", "Type"),
]


def leads_to_dataframe(leads: List[Dict[str, Any]]) -> pd.DataFrame:
    """Convert leads list to clean DataFrame with readable column headers."""
    if not leads:
        return pd.DataFrame(columns=[label for _, label in EXPORT_COLUMNS])

    df = pd.DataFrame(leads)
    
    # Ensure all expected columns exist
    for key, _ in EXPORT_COLUMNS:
        if key not in df.columns:
            df[key] = ""

    # Reorder and rename
    keys = [k for k, _ in EXPORT_COLUMNS]
    labels = [l for _, l in EXPORT_COLUMNS]
    df = df[keys]
    df.columns = labels
    return df


def generate_excel_bytes(leads: List[Dict[str, Any]]) -> bytes:
    """Generate professional formatted Excel workbook in memory."""
    df = leads_to_dataframe(leads)
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Clinical Leads", index=False)
        worksheet = writer.sheets["Clinical Leads"]

        # Styling definitions
        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        regular_font = Font(name="Calibri", size=10)
        center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
        left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
        thin_border = Border(
            left=Side(style="thin", color="D1D5DB"),
            right=Side(style="thin", color="D1D5DB"),
            top=Side(style="thin", color="D1D5DB"),
            bottom=Side(style="thin", color="D1D5DB"),
        )

        # Style header row
        worksheet.row_dimensions[1].height = 28
        for cell in worksheet[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align

        # Style data cells & calculate optimal column widths
        for row_idx, row in enumerate(worksheet.iter_rows(min_row=2, max_row=worksheet.max_row, min_col=1, max_col=worksheet.max_column), start=2):
            worksheet.row_dimensions[row_idx].height = 24
            for cell in row:
                cell.font = regular_font
                cell.border = thin_border
                cell.alignment = left_align

        # Auto-adjust column widths with bounds
        for col_idx, col in enumerate(worksheet.columns, start=1):
            col_letter = get_column_letter(col_idx)
            header_title = str(col[0].value or "")
            
            # Default width based on column type
            if "Script" in header_title or "Purpose" in header_title:
                worksheet.column_dimensions[col_letter].width = 45
            elif "Name" in header_title or "Contact" in header_title:
                worksheet.column_dimensions[col_letter].width = 28
            elif "Address" in header_title:
                worksheet.column_dimensions[col_letter].width = 25
            elif "Phone" in header_title:
                worksheet.column_dimensions[col_letter].width = 18
            else:
                worksheet.column_dimensions[col_letter].width = max(len(header_title) + 4, 15)

        # Freeze top row
        worksheet.freeze_panes = "A2"

    output.seek(0)
    data = output.getvalue()
    logger.info("Formatted Excel sheet generated: %d rows x %d cols (%d bytes)", len(df), len(df.columns), len(data))
    return data


def generate_csv_bytes(leads: List[Dict[str, Any]]) -> bytes:
    """Generate CSV bytes."""
    df = leads_to_dataframe(leads)
    csv_bytes = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
    logger.info("CSV generated: %d rows x %d cols (%d bytes)", len(df), len(df.columns), len(csv_bytes))
    return csv_bytes

