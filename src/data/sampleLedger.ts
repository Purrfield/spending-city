export interface LedgerEntry {
  category: string;
  /** Amount spent in CNY for the month. */
  amount: number;
  /** Hex color used for the building and the legend. */
  color: string;
}

/**
 * Sample ledger for November 2026. Hardcoded on purpose: the first PR is
 * scaffold-only, no OCR yet. Real receipts replace this file later.
 */
export const sampleLedger: LedgerEntry[] = [
  { category: "Food", amount: 850, color: "#f97316" },
  { category: "Subscriptions", amount: 540, color: "#8b5cf6" },
  { category: "Shopping", amount: 410, color: "#22c55e" },
  { category: "Transport", amount: 320, color: "#3b82f6" },
  { category: "Entertainment", amount: 180, color: "#ef4444" },
];

export const sampleMonth = "2026-11";

export const sampleTotal = sampleLedger.reduce((sum, e) => sum + e.amount, 0);
