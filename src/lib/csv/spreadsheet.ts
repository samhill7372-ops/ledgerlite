import type { Currency } from '@/types';
import { importGrid, type ImportResult } from './csv';

/**
 * Read an .xls/.xlsx/.xlsm file into expense rows. SheetJS is loaded lazily
 * (its own chunk) so it only downloads when someone actually imports a
 * spreadsheet. Everything runs on the device; nothing is uploaded.
 */
export async function readSpreadsheet(file: File, categories: string[], defaultCurrency: Currency): Promise<ImportResult> {
  let XLSX: typeof import('xlsx');
  try { XLSX = await import('xlsx'); }
  catch { return { rows: [], skipped: 0, error: 'Could not load the spreadsheet reader. Try again, or export the file as CSV.' }; }
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { rows: [], skipped: 0, error: 'The spreadsheet has no sheets.' };
    // header:1 → array of rows; raw:false → formatted text so dates/amounts read like the display.
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][];
    return importGrid(grid, categories, defaultCurrency);
  } catch {
    return { rows: [], skipped: 0, error: "Couldn't read that spreadsheet. If it's password-protected, remove the password or export it as CSV." };
  }
}
