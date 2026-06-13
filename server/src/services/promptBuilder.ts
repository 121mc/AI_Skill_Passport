import type {
  AppliedCardSummary,
  ContextPreviewResponse,
  SelectedCard,
  SkillCard,
  SkillField
} from "../../../shared/types.js";

const allFields: readonly SkillField[] = ["tone", "structure", "styleRules", "constraints", "examples"];

const labels: Record<SkillField, string> = {
  tone: "语气",
  structure: "结构",
  styleRules: "风格规则",
  constraints: "约束",
  examples: "示例"
};

const modeLabels: Record<SelectedCard["mode"], string> = {
  all: "全部应用",
  partial: "部分字段",
  temporary: "仅本次任务"
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
      `[技能卡片: ${card.name}]`,
      `应用方式: ${modeLabels[selection.mode]}`,
      `适用场景: ${card.scenarios.join(", ")}`
    ];

    if (card.presetPrompt) {
      lines.push(`预设提示词: ${card.presetPrompt}`);
    }

    for (const field of fields) {
      const values = card[field];
      if (values.length > 0) {
        lines.push(`${labels[field]}: ${joinField(field, values)}`);
      }
    }

    blocks.push(lines.join("\n"));
  }

  const body = blocks.length > 0 ? blocks.join("\n\n") : "未应用技能卡片。";

  return {
    appliedCards,
    context: [
      "用户选择的 AI 工作习惯:",
      body,
      "",
      "控制规则:",
      "- 当前任务与长期习惯冲突时，以当前任务为准。",
      "- 部分应用只包含用户勾选的字段。",
      "- 仅本次任务不会自动保存为长期习惯。",
      "- 新习惯建议必须由用户明确确认后才能保存。",
      "- 当前 AI 接入只生成文本，请不要要求生成图片、PPT 文件或其他非文本产物。",
      "",
      "当前任务:",
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
