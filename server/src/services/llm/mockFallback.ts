import type { LlmAdapter, LlmGenerateInput, LlmGenerateResult } from "./types.js";

export function createMockFallbackAdapter(model = "mock-fallback"): LlmAdapter {
  return {
    async generate(input: LlmGenerateInput): Promise<LlmGenerateResult> {
      const task = input.messages.at(-1)?.content ?? "the requested task";
      return {
        text: [
          "[本地降级内容] 当前真实模型不可用或尚未配置，因此返回本地文本示例。",
          "",
          "1. 标题：AI 技能护照",
          "2. 背景：用户在不同 AI 任务中会反复使用相似的协作偏好。",
          "3. 问题：这些习惯通常藏在旧提示词里，难以看见、复用和调整。",
          "4. 概念：技能卡片把可复用习惯变成可编辑、可选择的对象。",
          "5. 流程：创建卡片、获得推荐、选择全部或部分应用、预览上下文、再生成文本结果。",
          "6. HCI 价值：用户控制、透明度、隐私和可迁移的协作流程。",
          "7. 分享：快照链接可以预览、导入和复刻，不暴露原始私有卡片。",
          "8. 总结：这个演示说明可见的习惯可以影响模型输出，同时让用户保留控制权。",
          "",
          `原始任务：${task}`
        ].join("\n"),
        provider: "mock",
        model
      };
    }
  };
}
