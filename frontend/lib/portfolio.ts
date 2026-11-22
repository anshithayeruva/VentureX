import type { Tone } from "@/components/ui";
import type { Holding, TransactionType, ValuationSource } from "@/types";

export const TXN_LABEL: Record<TransactionType, string> = {
  investment: "Investment",
  follow_on: "Follow-on",
  distribution: "Distribution",
  dividend: "Dividend",
  exit_proceeds: "Exit proceeds",
  interest: "Interest",
  fee: "Fee",
};

/** Money leaving the investor (cost) vs coming back (returns). */
export const COST_TYPES: TransactionType[] = ["investment", "follow_on", "fee"];

export const STATUS_TAG: Record<Holding["status"], { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "accent" },
  exited: { label: "Exited", tone: "positive" },
  written_off: { label: "Written off", tone: "neutral" },
};

export const SOURCE_LABEL: Record<ValuationSource, string> = {
  self_reported: "Your estimate",
  company_report: "Company report",
  funding_round: "Priced funding round",
  third_party: "Third-party valuation",
};
