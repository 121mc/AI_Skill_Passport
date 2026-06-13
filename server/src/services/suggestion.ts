import type { SkillCard, SuggestedCard } from "../../../shared/types.js";

export function suggestHabitFromTask(task: string, selectedCards: SkillCard[]): SuggestedCard {
  const isHciPpt = task.toLowerCase().includes("hci") || task.includes("项目展示") || task.toLowerCase().includes("ppt");
  const sourceNames = selectedCards.map((card) => card.name).join(", ");

  return {
    name: isHciPpt ? "HCI Project Demo Outline" : "Reusable Task Outline",
    description: sourceNames
      ? `Reusable habit distilled from this task and selected cards: ${sourceNames}.`
      : "Reusable habit distilled from the completed task.",
    scenarios: isHciPpt ? ["HCI project presentation", "course demo", "PPT outline"] : ["AI task planning", "structured output"],
    tone: ["formal but natural", "clear and user-controlled"],
    structure: isHciPpt
      ? ["background", "problem", "concept", "interaction flow", "HCI value", "sharing and import", "summary"]
      : ["context", "task", "structured answer", "next step"],
    styleRules: ["make selected habits visible", "keep each section concise", "avoid dense paragraphs"],
    constraints: ["do not save automatically without user confirmation", "show how user control affects the output"],
    examples: [task],
    tags: isHciPpt ? ["hci", "ppt", "demo", "outline"] : ["task", "outline", "habit"],
    privacy: "private"
  };
}
