/**
 * Export utilities for generating formatted Excel (.xlsx) and CSV files in Node.js.
 */

import ExcelJS from 'exceljs';

export const EXPORT_COLUMNS = [
  { key: 'facility_name', label: 'Practice / Facility Name', width: 28 },
  { key: 'specialty', label: 'Target Specialty', width: 22 },
  { key: 'front_desk_phone', label: 'Front Desk Phone', width: 18 },
  { key: 'official_contact', label: 'Authorized Official / Contact', width: 28 },
  { key: 'target_person_to_ask', label: 'Target Decision Maker', width: 25 },
  { key: 'street_address', label: 'Street Address', width: 25 },
  { key: 'city', label: 'City', width: 18 },
  { key: 'state', label: 'State', width: 12 },
  { key: 'zip_code', label: 'ZIP Code', width: 14 },
  { key: 'purpose_of_contact', label: 'Purpose of Contact (Pain Point)', width: 45 },
  { key: 'calling_script', label: 'Front Desk Calling Script', width: 45 },
  { key: 'npi', label: 'NPI Number', width: 16 },
  { key: 'type', label: 'Type', width: 18 },
];

/**
 * Generate professionally formatted Excel workbook buffer matching openpyxl styles.
 */
export async function generateExcelBuffer(leads = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Clinical Lead Generator';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Clinical Leads', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  worksheet.columns = EXPORT_COLUMNS.map(col => ({
    header: col.label,
    key: col.key,
    width: col.width,
  }));

  // Style header row (Navy blue #1E3A8A, bold white text, centered)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };

  // Add data rows with cell styling
  for (const lead of leads) {
    const rowData = {};
    for (const col of EXPORT_COLUMNS) {
      rowData[col.key] = lead[col.key] || '';
    }
    const row = worksheet.addRow(rowData);
    row.height = 24;
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate CSV Buffer with UTF-8 BOM.
 */
export function generateCsvBuffer(l = []) {
  const q = (v) => `\x22${String(v ?? '').replace(/\x22/g, '\x22\x22')}\x22`;
  const h = EXPORT_COLUMNS.map(c => q(c.label)).join('\x2c');
  return Buffer.from(String.fromCharCode(0xfeff) + [h, ...l.map(r => EXPORT_COLUMNS.map(c => q(r[c.key])).join('\x2c'))].join('\x0d\x0a'), 'utf-8');
}
