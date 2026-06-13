import { describe, expect, it } from "vitest";
import type { SkillCard } from "../../shared/types.js";
import { buildContextPreview } from "../src/services/promptBuilder.js";

const card: SkillCard = {
  id: "classroom-presentation",
  name: "Classroom Presentation",
  description: "Course presentation habits.",
  scenarios: ["HCI report"],
  tone: ["formal but natural"],
  structure: ["background", "problem", "solution"],
  styleRules: ["one key idea per slide"],
  constraints: ["avoid slogans"],
  examples: ["8-slide outline"],
  tags: ["ppt", "hci"],
  privacy: "private",
  compatibility: { chat: 80, ppt: 98, writing: 70, coding: 10 },
  usageCount: 0,
  createdAt: "2026-06-12T09:00:00.000Z",
  updatedAt: "2026-06-12T09:00:00.000Z"
};

describe("buildContextPreview", () => {
  it("includes every controlled field for all mode", () => {
    const result = buildContextPreview("Make an HCI PPT", [card], [
      { cardId: card.id, mode: "all", selectedFields: [] }
    ]);

    expect(result.appliedCards[0].fields).toEqual(["tone", "structure", "styleRules", "constraints", "examples"]);
    expect(result.context).toContain("[技能卡片: Classroom Presentation]");
    expect(result.context).toContain("语气: formal but natural");
    expect(result.context).toContain("结构: background -> problem -> solution");
    expect(result.context).toContain("约束: avoid slogans");
  });

  it("uses Chinese labels and asks the model for text-only output", () => {
    const result = buildContextPreview("帮我写一份 HCI 项目展示讲稿", [card], [
      { cardId: card.id, mode: "all", selectedFields: [] }
    ]);

    expect(result.context).toContain("用户选择的 AI 工作习惯");
    expect(result.context).toContain("语气: formal but natural");
    expect(result.context).toContain("控制规则");
    expect(result.context).toContain("当前 AI 接入只生成文本，请不要要求生成图片、PPT 文件或其他非文本产物。");
    expect(result.context).toContain("当前任务:\n帮我写一份 HCI 项目展示讲稿");
  });

  it("keeps all mode deterministic after a caller mutates returned fields", () => {
    const firstResult = buildContextPreview("Make an HCI PPT", [card], [
      { cardId: card.id, mode: "all", selectedFields: [] }
    ]);

    firstResult.appliedCards[0].fields.pop();

    const secondResult = buildContextPreview("Make another HCI PPT", [card], [
      { cardId: card.id, mode: "all", selectedFields: [] }
    ]);

    expect(secondResult.appliedCards[0].fields).toEqual(["tone", "structure", "styleRules", "constraints", "examples"]);
  });

  it("includes only selected fields for partial mode", () => {
    const result = buildContextPreview("Make an HCI PPT", [card], [
      { cardId: card.id, mode: "partial", selectedFields: ["styleRules"] }
    ]);

    expect(result.appliedCards[0].fields).toEqual(["styleRules"]);
    expect(result.context).toContain("风格规则: one key idea per slide");
    expect(result.context).not.toContain("语气: formal but natural");
    expect(result.context).not.toContain("结构: background");
  });

  it("excludes selected card ids that are absent from the library", () => {
    const result = buildContextPreview("Make an HCI PPT", [card], [
      { cardId: "missing-card", mode: "all", selectedFields: [] }
    ]);

    expect(result.appliedCards).toEqual([]);
    expect(result.context).toContain("未应用技能卡片。");
  });
});
