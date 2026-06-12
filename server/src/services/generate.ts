import { randomUUID } from "node:crypto";
import type { GenerateResponse, MemoryEvent, SelectedCard, TaskSession } from "../../../shared/types.js";
import type { LlmConfig } from "../config.js";
import { createMockFallbackAdapter } from "./llm/mockFallback.js";
import type { LlmAdapter } from "./llm/types.js";
import { buildContextPreview } from "./promptBuilder.js";
import { suggestHabitFromTask } from "./suggestion.js";
import type { JsonStore } from "./store.js";

export type GenerateInput = {
  task: string;
  selectedCards: SelectedCard[];
};

export type GenerateDeps = {
  store: JsonStore;
  adapter: LlmAdapter;
  config: LlmConfig;
};

const systemMessage = [
  "You are the task assistant inside the AI Skill Passport demo.",
  "Your goal is not only to answer the user. You must visibly apply the Skill Cards selected by the user.",
  "If a long-term habit conflicts with the current task, the current task wins.",
  "The output should reflect the selected tone, structure, style rules, and constraints."
].join("\n");

export async function generateTaskResponse(input: GenerateInput, deps: GenerateDeps): Promise<GenerateResponse> {
  const db = await deps.store.read();
  const preview = buildContextPreview(input.task, db.cards, input.selectedCards);
  const selectedCardRecords = input.selectedCards
    .map((selection) => db.cards.find((card) => card.id === selection.cardId))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));

  const messages = [
    { role: "system" as const, content: systemMessage },
    { role: "user" as const, content: preview.context }
  ];

  let usedFallback = false;
  let provider = deps.config.provider;
  let model = deps.config.model;
  let output: string;

  try {
    if (!deps.config.apiKey || !deps.config.model) {
      throw new Error("LLM configuration is missing.");
    }
    const result = await deps.adapter.generate({ messages, temperature: 0.4, maxTokens: 1200 });
    output = result.text;
    provider = result.provider;
    model = result.model;
  } catch (error) {
    if (!deps.config.mockFallback) {
      throw error;
    }
    usedFallback = true;
    const fallback = await createMockFallbackAdapter().generate({ messages, temperature: 0.4, maxTokens: 1200 });
    output = fallback.text;
    provider = fallback.provider;
    model = fallback.model;
  }

  const suggestedCard = suggestHabitFromTask(input.task, selectedCardRecords);
  const sessionId = `session_${randomUUID()}`;

  await deps.store.update((writeDb) => {
    const session: TaskSession = {
      id: sessionId,
      userTask: input.task,
      selectedCards: input.selectedCards,
      generatedContext: preview.context,
      modelProvider: provider,
      modelName: model,
      output,
      status: "completed",
      usedFallback,
      suggestedCard,
      createdAt: new Date().toISOString()
    };
    writeDb.sessions.unshift(session);

    for (const selection of input.selectedCards) {
      if (selection.mode !== "temporary") {
        const card = writeDb.cards.find((item) => item.id === selection.cardId);
        if (card) {
          card.usageCount += 1;
          card.lastUsedAt = session.createdAt;
          card.updatedAt = session.createdAt;
        }
      }
    }

    writeDb.timeline.unshift(event("suggested", "Suggested new Skill Card", suggestedCard.name, { taskSessionId: sessionId }));
  });

  return {
    sessionId,
    context: preview.context,
    output,
    provider,
    model,
    usedFallback,
    suggestedCard
  };
}

function event(
  type: MemoryEvent["type"],
  title: string,
  detail: string,
  ids: Pick<MemoryEvent, "cardId" | "taskSessionId"> = {}
): MemoryEvent {
  return {
    id: `event_${randomUUID()}`,
    type,
    title,
    detail,
    createdAt: new Date().toISOString(),
    ...ids
  };
}
