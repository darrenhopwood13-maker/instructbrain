import { createFileRoute } from "@tanstack/react-router";
import { ReviewList } from "@/components/review-list";
import { AppShell } from "@/components/app-shell";
import { snaggingDefinition } from "@/lib/survey-definitions";
import type { Finding } from "@/lib/types";

export const Route = createFileRoute("/tmp-audit")({ component: Audit });

const snapshot = snaggingDefinition;
const long =
  "Persistent moisture staining observed to the underside of the soffit board adjacent to the rainwater outlet, extending approximately 1.2m along the eaves line with associated paint blistering and localised timber softening consistent with prolonged saturation ReferenceNumberWithoutSpaces-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.jpg";

const findings: Finding[] = [1, 2].map((n) => ({
  id: `f${n}`,
  ref: `F-00${n}`,
  title: long.slice(0, 90),
  location: "Level 3 / East elevation / Bay 12 / VeryLongZoneIdentifierWithoutAnySpacesAtAll",
  trade: "Roofing",
  status: n === 1 ? "not_assessed" : "fail",
  aiDrafted: true,
  confirmed: false,
  isConfidential: false,
  photoIds: [],
  note: long,
  description: long,
  remedial: long,
  likelyCause: long,
  regulatoryReference: null,
}));

function Audit() {
  return (
    <AppShell>
      <ReviewList snapshot={snapshot} findings={findings} />
    </AppShell>
  );
}
