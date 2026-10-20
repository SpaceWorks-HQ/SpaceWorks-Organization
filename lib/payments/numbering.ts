/** Document numbers. Pure and client-safe; allocation lives in lib/payments/documents.ts. */

export type DocumentSeries = "R" | "C";

export const RECEIPT_PREFIX_PATTERN = /^[A-Z0-9]{0,4}$/;

/**
 * "SWO-2627-00042" for payment documents and "SWO-2627-C00042" for credit notes. The financial year is
 * written compactly ("2026-27" becomes "2627"; a calendar year stays "2026"). At most 16 characters, the
 * GST limit, while the sequence stays within five digits.
 */
export function formatDocumentNumber(prefix: string, series: DocumentSeries, financialYear: string, sequence: number) {
  const year = financialYear.length === 7 ? `${financialYear.slice(2, 4)}${financialYear.slice(5)}` : financialYear;
  const serial = `${series === "C" ? "C" : ""}${String(sequence).padStart(5, "0")}`;
  return `${prefix ? `${prefix}-` : ""}${year}-${serial}`;
}

export const DOCUMENT_KIND_LABELS = {
  RECEIPT: "Receipt",
  TAX_INVOICE: "Tax invoice",
  BILL_OF_SUPPLY: "Bill of supply",
  CREDIT_NOTE: "Credit note",
} as const;
