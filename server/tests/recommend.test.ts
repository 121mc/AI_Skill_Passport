import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SkillCard } from "../../shared/types.js";
import { recommendCards } from "../src/services/recommend.js";

const demoTask = "帮我为 HCI 课程做一个 8 页项目展示 PPT 大纲，主题是 AI Skill Passport。";

describe("recommendCards", () => {
  it("ranks Classroom Presentation and Minimal Visual Style highest for the demo task", async () => {
    const cards = JSON.parse(await readFile(path.resolve("src/data/seedCards.json"), "utf8")) as SkillCard[];

    const result = recommendCards(demoTask, cards);

    expect(result.slice(0, 2).map((item) => item.card.id)).toEqual([
      "classroom-presentation",
      "minimal-visual-style"
    ]);
    expect(result[0].reasons.join(" ")).toContain("ppt");
    expect(result[0].score).toBeGreaterThan(result[2].score);
  });

  it("does not recommend unrelated cards from PPT compatibility alone", () => {
    const result = recommendCards("Create a PPT about Rust checksum implementation.", [
      skillCard({
        id: "email-only",
        name: "Email Only",
        description: "Creates concise email replies.",
        scenarios: ["email"],
        tags: ["email", "writing"],
        compatibility: { chat: 80, ppt: 100, writing: 95, coding: 10 }
      })
    ]);

    expect(result).toEqual([]);
  });

  it("describes bucket matches without claiming unsupported card-side evidence", () => {
    const result = recommendCards("Make a PPT presentation outline.", [
      skillCard({
        id: "generic-presentation",
        name: "Generic Presentation",
        description: "Supports presentation planning.",
        scenarios: ["presentation"],
        tags: ["deck"]
      })
    ]);

    expect(result[0].reasons.join(" ")).toContain("Task matched PPT terms; card supports presentation");
    expect(result[0].reasons.join(" ")).not.toContain("Matched ppt keyword");
  });
});

function skillCard(overrides: Partial<SkillCard> & Pick<SkillCard, "id" | "name">): SkillCard {
  const { id, name, ...rest } = overrides;

  return {
    id,
    name,
    description: "Reusable task behavior.",
    scenarios: [],
    tone: ["clear"],
    structure: ["context", "answer"],
    styleRules: ["brief"],
    constraints: ["stay focused"],
    examples: ["short output"],
    tags: [],
    privacy: "private",
    compatibility: { chat: 50, ppt: 50, writing: 50, coding: 50 },
    usageCount: 0,
    createdAt: "2026-06-12T09:00:00.000Z",
    updatedAt: "2026-06-12T09:00:00.000Z",
    ...rest
  };
}
