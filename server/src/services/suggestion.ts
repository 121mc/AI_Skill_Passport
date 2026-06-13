import type { SkillCard, SuggestedCard } from "../../../shared/types.js";

export function suggestHabitFromTask(task: string, selectedCards: SkillCard[]): SuggestedCard {
  const normalizedTask = task.toLowerCase();
  const isHciPpt = normalizedTask.includes("hci") || task.includes("项目展示") || normalizedTask.includes("ppt");
  const sourceNames = selectedCards.map((card) => card.name).join(", ");

  return {
    name: isHciPpt ? "HCI 项目展示大纲" : "可复用任务提纲",
    description: sourceNames
      ? `从本次任务和已选择卡片中提炼出的可复用习惯：${sourceNames}。`
      : "从本次完成任务中提炼出的可复用习惯。",
    presetPrompt: isHciPpt
      ? "请基于当前主题生成一份 HCI 项目展示大纲，只输出文本。内容需要包含页面标题、核心观点和讲述要点，不要生成 PPT 文件或图片。"
      : "请基于当前任务生成一份结构化中文文本，只输出文本。请给出清晰步骤、可复制内容和必要注意事项，不要生成文件或图片。",
    scenarios: isHciPpt ? ["HCI 项目展示", "课程演示", "PPT 大纲"] : ["AI 任务规划", "结构化输出"],
    tone: ["正式但自然", "清晰且体现用户控制"],
    structure: isHciPpt
      ? ["背景", "问题", "概念", "交互流程", "HCI 价值", "分享与导入", "总结"]
      : ["背景", "任务", "结构化回答", "下一步"],
    styleRules: ["让已选择习惯在输出中可见", "每个部分保持简洁", "避免密集长段落"],
    constraints: ["未经用户确认不要自动保存", "说明用户控制如何影响输出", "只输出文本"],
    examples: [task],
    tags: isHciPpt ? ["hci", "ppt", "demo", "outline", "展示"] : ["task", "outline", "habit", "文本"],
    privacy: "private"
  };
}
