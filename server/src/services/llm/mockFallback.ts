import type { LlmAdapter, LlmGenerateInput, LlmGenerateResult } from "./types.js";

export function createMockFallbackAdapter(model = "mock-fallback"): LlmAdapter {
  return {
    async generate(input: LlmGenerateInput): Promise<LlmGenerateResult> {
      const task = input.messages.at(-1)?.content ?? "the requested task";
      return {
        text: [
          "[Fallback content] This response was generated locally because the real LLM provider was unavailable or not configured.",
          "",
          "1. Title: AI Skill Passport",
          "2. Background: Users repeat collaboration preferences across AI tasks.",
          "3. Problem: Habits stay hidden inside old prompts and are hard to reuse.",
          "4. Concept: Skill Cards turn reusable habits into editable, selectable objects.",
          "5. Flow: Create cards, receive recommendations, select full or partial use, preview context, generate with the model.",
          "6. HCI Value: User control, transparency, privacy, and transferable routines.",
          "7. Sharing: Snapshot links allow preview, import, and fork without exposing the original private card.",
          "8. Summary: The demo proves that visible habits can shape model output while keeping users in control.",
          "",
          `Original task: ${task}`
        ].join("\n"),
        provider: "mock",
        model
      };
    }
  };
}
