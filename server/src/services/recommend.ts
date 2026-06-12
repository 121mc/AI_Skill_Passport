import type { Recommendation, SkillCard } from "../../../shared/types.js";

const keywordMap: Record<string, string[]> = {
  ppt: ["ppt", "slides", "slide", "presentation", "展示", "汇报", "大纲", "演示"],
  hci: ["hci", "human-computer", "人机交互", "课程", "项目"],
  writing: ["email", "邮件", "写作", "message"],
  defense: ["defense", "答辩", "论文", "研究"],
  visual: ["visual", "style", "设计", "视觉", "极简", "版式"]
};

export function recommendCards(task: string, cards: SkillCard[]): Recommendation[] {
  const normalizedTask = task.toLowerCase();

  return cards
    .map((card) => {
      const cardText = searchableCardText(card);
      const reasons: string[] = [];
      let hasSemanticMatch = false;
      let score = 0;

      for (const tag of card.tags) {
        if (normalizedTask.includes(tag.toLowerCase())) {
          hasSemanticMatch = true;
          score += 12;
          reasons.push(`Matched tag "${tag}"`);
        }
      }

      for (const [bucket, words] of Object.entries(keywordMap)) {
        const taskMatches = words.filter((word) => normalizedTask.includes(word.toLowerCase()));
        if (taskMatches.length === 0) {
          continue;
        }
        const supportTerms = cardSupportTerms(bucket, words, cardText);
        if (supportTerms.length > 0) {
          hasSemanticMatch = true;
          score += taskMatches.length * 8;
          reasons.push(`Task matched ${formatBucketLabel(bucket)} terms; card supports ${supportTerms.join("/")}`);
        }
      }

      if (normalizedTask.includes("hci") && card.tags.includes("hci")) {
        hasSemanticMatch = true;
        score += 18;
        reasons.push("HCI task fit");
      }

      if (
        (normalizedTask.includes("展示") || normalizedTask.includes("presentation")) &&
        card.scenarios.join(" ").toLowerCase().includes("presentation")
      ) {
        hasSemanticMatch = true;
        score += 10;
        reasons.push("Presentation scenario fit");
      }

      if (hasSemanticMatch && normalizedTask.includes("ppt")) {
        score += Math.round(card.compatibility.ppt / 10);
        reasons.push(`PPT compatibility ${card.compatibility.ppt}`);
      }

      return { card, score, reasons, hasSemanticMatch };
    })
    .filter((item) => item.hasSemanticMatch)
    .map(({ card, score, reasons }) => ({ card, score, reasons }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.card.compatibility.ppt - a.card.compatibility.ppt ||
        a.card.name.localeCompare(b.card.name)
    );
}

function searchableCardText(card: SkillCard): string {
  return [
    card.name,
    card.description,
    card.scenarios.join(" "),
    card.tone.join(" "),
    card.structure.join(" "),
    card.styleRules.join(" "),
    card.tags.join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

function cardSupportTerms(bucket: string, words: string[], cardText: string): string[] {
  return Array.from(
    new Set([
      ...words.filter((word) => cardText.includes(word.toLowerCase())),
      ...(cardText.includes(bucket) ? [bucket] : [])
    ])
  );
}

function formatBucketLabel(bucket: string): string {
  if (bucket === "ppt" || bucket === "hci") {
    return bucket.toUpperCase();
  }
  return bucket;
}
