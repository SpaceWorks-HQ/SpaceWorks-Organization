import type { OrgTaxSettings, PaymentLineKind, TaxDocumentKind } from "@prisma/client";

/**
 * Tax maths for payments and credit notes. Pure and client-safe; docs/GST.md explains every rule.
 * All amounts are integer minor units of one currency.
 */

export const TAX_SNAPSHOT_VERSION = 1;

/** Tax configuration frozen onto a payment when it is created. */
export type TaxSnapshot = {
  version: number;
  mode: "GST" | "SIMPLE" | "NONE";
  documentKind: Exclude<TaxDocumentKind, "CREDIT_NOTE">;
  /** Effective rate in basis points: 0 when exempt, composition, zero-rated or untaxed. */
  rateBps: number;
  inclusive: boolean;
  taxName: string;
  supplierState: string | null;
  gstin: string | null;
  legalName: string | null;
  address: string | null;
  sac: string | null;
  zeroRatedExport: boolean;
  lutNumber: string | null;
};

type TaxSettings = Pick<OrgTaxSettings, "mode" | "scheme" | "gstin" | "legalName" | "address" | "stateCode" | "sacCode" | "rateBps" | "inclusive" | "exempt" | "foreignCurrencyTax" | "lutNumber" | "simpleTaxName">;

/** What a payment in `currency` is taxed at under the organisation's current settings. */
export function resolveTaxSnapshot(settings: TaxSettings | null, currency: string): TaxSnapshot {
  const base: TaxSnapshot = {
    version: TAX_SNAPSHOT_VERSION,
    mode: "NONE",
    documentKind: "RECEIPT",
    rateBps: 0,
    inclusive: true,
    taxName: "Tax",
    supplierState: settings?.stateCode ?? null,
    gstin: null,
    legalName: settings?.legalName ?? null,
    address: settings?.address ?? null,
    sac: null,
    zeroRatedExport: false,
    lutNumber: null,
  };
  if (!settings || settings.mode === "NONE") return base;
  if (settings.mode === "SIMPLE") {
    return { ...base, mode: "SIMPLE", rateBps: settings.rateBps, inclusive: settings.inclusive, taxName: settings.simpleTaxName || "Tax" };
  }
  const gst: TaxSnapshot = { ...base, mode: "GST", taxName: "GST", gstin: settings.gstin, sac: settings.sacCode, inclusive: settings.inclusive };
  if (currency !== "INR") {
    // Plans priced abroad: an export of services under LUT (zero-rated), or outside GST altogether.
    return settings.foreignCurrencyTax === "EXPORT_LUT"
      ? { ...gst, documentKind: "TAX_INVOICE", zeroRatedExport: true, lutNumber: settings.lutNumber }
      : { ...gst, documentKind: "RECEIPT", sac: null };
  }
  if (settings.scheme === "COMPOSITION" || settings.exempt) return { ...gst, documentKind: "BILL_OF_SUPPLY" };
  return { ...gst, documentKind: "TAX_INVOICE", rateBps: settings.rateBps };
}

/** Place of supply: the member's state, falling back to the supplier's (IGST Act s.12(2)(b)). */
export function placeOfSupply(memberState: string | null | undefined, snapshot: Pick<TaxSnapshot, "supplierState">): string | null {
  return memberState || snapshot.supplierState || null;
}

export type TaxSplit = { amountMinor: number; taxableMinor: number; cgstMinor: number; sgstMinor: number; igstMinor: number; otherTaxMinor: number };

/**
 * Split one charge into taxable value and tax. `priceMinor` is the plan price: the total when pricing is
 * inclusive, the taxable value when exclusive. CGST and SGST are equal halves; an odd paisa moves into the
 * taxable value so the halves match and the total is unchanged.
 */
export function splitTax(priceMinor: number, snapshot: TaxSnapshot, pos: string | null): TaxSplit {
  const zero = { cgstMinor: 0, sgstMinor: 0, igstMinor: 0, otherTaxMinor: 0 };
  const rate = snapshot.rateBps;
  if (rate <= 0 || priceMinor <= 0) return { amountMinor: priceMinor, taxableMinor: priceMinor, ...zero };
  let taxable = snapshot.inclusive ? Math.round((priceMinor * 10_000) / (10_000 + rate)) : priceMinor;
  let tax = snapshot.inclusive ? priceMinor - taxable : Math.round((priceMinor * rate) / 10_000);
  const amount = taxable + tax;
  if (snapshot.mode !== "GST") return { amountMinor: amount, taxableMinor: taxable, ...zero, otherTaxMinor: tax };
  const intraState = Boolean(pos && snapshot.supplierState && pos === snapshot.supplierState);
  if (!intraState) return { amountMinor: amount, taxableMinor: taxable, ...zero, igstMinor: tax };
  if (tax % 2 === 1) {
    taxable += 1;
    tax -= 1;
  }
  return { amountMinor: amount, taxableMinor: taxable, ...zero, cgstMinor: tax / 2, sgstMinor: tax / 2 };
}

export type ChargeLine = TaxSplit & { kind: PaymentLineKind; description: string };

/** The lines a term is charged: its fee and any joining (or rejoining) fee, each taxed separately. */
export function chargeLines(
  term: { renewal: boolean; rejoining: boolean; priceMinor: number; joiningFeeMinor: number; planName: string },
  snapshot: TaxSnapshot,
  pos: string | null,
): ChargeLine[] {
  const lines: ChargeLine[] = [];
  if (term.priceMinor > 0) lines.push({ kind: "TERM_FEE", description: `${term.planName} membership${term.renewal ? " renewal" : ""}`, ...splitTax(term.priceMinor, snapshot, pos) });
  if (term.joiningFeeMinor > 0) {
    const kind = term.rejoining ? "REJOIN_FEE" : "JOINING_FEE";
    lines.push({ kind, description: kind === "REJOIN_FEE" ? "Rejoining fee" : "Joining fee", ...splitTax(term.joiningFeeMinor, snapshot, pos) });
  }
  return lines;
}

export function sumSplits(lines: TaxSplit[]): TaxSplit {
  return lines.reduce(
    (total, line) => ({
      amountMinor: total.amountMinor + line.amountMinor,
      taxableMinor: total.taxableMinor + line.taxableMinor,
      cgstMinor: total.cgstMinor + line.cgstMinor,
      sgstMinor: total.sgstMinor + line.sgstMinor,
      igstMinor: total.igstMinor + line.igstMinor,
      otherTaxMinor: total.otherTaxMinor + line.otherTaxMinor,
    }),
    { amountMinor: 0, taxableMinor: 0, cgstMinor: 0, sgstMinor: 0, igstMinor: 0, otherTaxMinor: 0 },
  );
}

/** Share `amount` across `weights` in proportion, largest remainder first, so the parts add up exactly. */
export function apportion(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0 || amount <= 0) return weights.map(() => 0);
  const raw = weights.map((weight) => (amount * weight) / total);
  const parts = raw.map(Math.floor);
  let left = amount - parts.reduce((sum, part) => sum + part, 0);
  const order = raw.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    parts[index] += 1;
    left -= 1;
  }
  return parts;
}

const COMPONENTS = ["taxableMinor", "cgstMinor", "sgstMinor", "igstMinor", "otherTaxMinor"] as const;

/**
 * A credit note for a (partial) refund: the refund is shared across the payment's lines by amount, and
 * each line's share across its taxable value and taxes pro rata. A full refund reverses every line exactly.
 */
export function creditNoteLines<T extends TaxSplit & { kind: PaymentLineKind; description: string }>(lines: T[], refundMinor: number): ChargeLine[] {
  const shares = apportion(refundMinor, lines.map((line) => line.amountMinor));
  return lines.map((line, index) => {
    const parts = apportion(shares[index], COMPONENTS.map((key) => line[key]));
    const split = Object.fromEntries(COMPONENTS.map((key, at) => [key, parts[at]])) as Omit<TaxSplit, "amountMinor">;
    return { kind: line.kind, description: line.description, amountMinor: shares[index], ...split };
  }).filter((line) => line.amountMinor > 0);
}
