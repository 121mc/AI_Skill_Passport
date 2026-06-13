import type {
  AppliedCardSummary,
  ContextPreviewResponse,
  SelectedCard,
  SkillCard,
  SkillField
} from "../../../shared/types.js";

const allFields: readonly SkillField[] = ["tone", "structure", "styleRules", "constraints", "examples"];

const labels: Record<SkillField, string> = {
  tone: "Tone",
  structure: "Structure",
  styleRules: "Style rules",
  constraints: "Constraints",
  examples: "Examples"
};

export function buildContextPreview(
  task: string,
  cards: SkillCard[],
  selectedCards: SelectedCard[]
): ContextPreviewResponse {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const appliedCards: AppliedCardSummary[] = [];
  const blocks: string[] = [];

  for (const selection of selectedCards) {
    const card = cardById.get(selection.cardId);
    if (!card) {
      continue;
    }

    const fields = fieldsForSelection(selection);
    appliedCards.push({
      cardId: card.id,
      name: card.name,
      mode: selection.mode,
      fields
    });

    const lines = [
      `[Skill Card: ${card.name}]`,
      `Apply mode: ${selection.mode}`,
      `Scenarios: ${card.scenarios.join(", ")}`
    ];

    for (const field of fields) {
      const values = card[field];
      if (values.length > 0) {
        lines.push(`${labels[field]}: ${joinField(field, values)}`);
      }
    }

    blocks.push(lines.join("\n"));
  }

  const body = blocks.length > 0 ? blocks.join("\n\n") : "No Skill Cards were applied.";

  return {
    appliedCards,
    context: [
      "User-selected AI work habits:",
      body,
      "",
      "Control rules:",
      "- The current task overrides long-term habits when they conflict.",
      "- Partial mode includes only the fields listed in the selection.",
      "- Temporary mode applies only to this generation and does not save a new habit automatically.",
      "- A suggested habit requires explicit user confirmation before it is saved.",
      "",
      "Current user task:",
      task
    ].join("\n")
  };
}

function fieldsForSelection(selection: SelectedCard): SkillField[] {
  if (selection.mode === "all" || selection.mode === "temporary") {
    return [...allFields];
  }
  return allFields.filter((field) => selection.selectedFields.includes(field));
}

function joinField(field: SkillField, values: string[]): string {
  if (field === "structure") {
    return values.join(" -> ");
  }
  return values.join("; ");
}
