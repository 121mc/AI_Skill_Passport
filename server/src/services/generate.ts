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
  "你是 AI 技能护照演示中的任务助手。",
  "你的目标不只是回答用户，还要显性应用用户选择的技能卡片。",
  "如果长期习惯与当前任务冲突，以当前任务为准。",
  "输出应体现已选择的语气、结构、风格规则和约束。",
  "当前 AI 接入只支持文本输出；不要声称已经生成图片、PPT 文件、附件或其他非文本产物。"
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
      throw publicHttpError(503, "LLM configuration is missing");
    }
    const result = await deps.adapter.generate({ messages, temperature: 0.4, maxTokens: 1200 });
    output = result.text;
    provider = result.provider;
    model = result.model;
  } catch (error) {
    if (!deps.config.mockFallback) {
      if (isPublicHttpError(error)) {
        throw error;
      }
      throw publicHttpError(502, "LLM generation failed");
    }
    if (isPublicHttpError(error) && error.status !== 503) {
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
          writeDb.timeline.unshift(event("used", "使用技能卡片", card.name, { cardId: card.id, taskSessionId: sessionId }));
        }
      }
    }

    writeDb.timeline.unshift(event("suggested", "建议新技能卡片", suggestedCard.name, { taskSessionId: sessionId }));
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

function publicHttpError(status: number, publicMessage: string): Error & { status: number; publicMessage: string } {
  return Object.assign(new Error(publicMessage), { status, publicMessage });
}

function isPublicHttpError(error: unknown): error is Error & { status: number; publicMessage: string } {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number" &&
    "publicMessage" in error &&
    typeof (error as { publicMessage?: unknown }).publicMessage === "string"
  );
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
