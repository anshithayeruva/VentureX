import type { Tone } from "@/components/ui";

/** Deal stages in order, with the plain-language label shown to people. */
export const DEAL_STAGES: { id: string; label: string }[] = [
  { id: "INTRO_ACCEPTED", label: "Intro accepted" },
  { id: "DUE_DILIGENCE", label: "Due diligence" },
  { id: "PARTNER_MEETING", label: "Partner meeting" },
  { id: "TERM_SHEET", label: "Term sheet" },
  { id: "CLOSED", label: "Closed" },
];

export function stageLabel(stage: string): string {
  if (stage === "PASSED") return "Passed";
  return DEAL_STAGES.find((s) => s.id === stage)?.label ?? stage.replace(/_/g, " ").toLowerCase();
}

export function stageTone(stage: string): Tone {
  if (stage === "CLOSED" || stage === "TERM_SHEET") return "positive";
  if (stage === "PASSED") return "neutral";
  if (stage === "INTRO_ACCEPTED") return "accent";
  return "warning";
}
