import type {
  ContextPreviewResponse,
  GenerateResponse,
  MemoryEvent,
  Recommendation,
  SelectedCard,
  ShareLink,
  SkillCard,
  SuggestedCard
} from "@shared/types";

const apiBase = "/api";

export type HealthResponse = {
  ok: boolean;
  provider: string;
  modelConfigured: boolean;
  fallbackEnabled: boolean;
};

export type EditableCardPayload = Pick<
  SkillCard,
  | "name"
  | "description"
  | "presetPrompt"
  | "scenarios"
  | "tone"
  | "structure"
  | "styleRules"
  | "constraints"
  | "examples"
  | "tags"
  | "privacy"
  | "compatibility"
>;

export type CardCreateInput = Omit<EditableCardPayload, "compatibility"> &
  Partial<Pick<EditableCardPayload, "compatibility">>;

export type CardPatchInput = Partial<EditableCardPayload>;

const defaultCompatibility: SkillCard["compatibility"] = {
  chat: 70,
  ppt: 70,
  writing: 70,
  coding: 20
};

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: response.statusText }))) as { error?: string };
    throw new Error(body.error || response.statusText);
  }

  return (await response.json()) as T;
}

function toCardCreatePayload(card: CardCreateInput | SuggestedCard): EditableCardPayload {
  return {
    name: card.name,
    description: card.description,
    presetPrompt: card.presetPrompt,
    scenarios: card.scenarios,
    tone: card.tone,
    structure: card.structure,
    styleRules: card.styleRules,
    constraints: card.constraints,
    examples: card.examples,
    tags: card.tags,
    privacy: card.privacy,
    compatibility: "compatibility" in card && card.compatibility ? card.compatibility : defaultCompatibility
  };
}

function toCardPatchPayload(patch: CardPatchInput): CardPatchInput {
  const payload: CardPatchInput = {};

  if (patch.name !== undefined) {
    payload.name = patch.name;
  }
  if (patch.description !== undefined) {
    payload.description = patch.description;
  }
  if (patch.presetPrompt !== undefined) {
    payload.presetPrompt = patch.presetPrompt;
  }
  if (patch.scenarios !== undefined) {
    payload.scenarios = patch.scenarios;
  }
  if (patch.tone !== undefined) {
    payload.tone = patch.tone;
  }
  if (patch.structure !== undefined) {
    payload.structure = patch.structure;
  }
  if (patch.styleRules !== undefined) {
    payload.styleRules = patch.styleRules;
  }
  if (patch.constraints !== undefined) {
    payload.constraints = patch.constraints;
  }
  if (patch.examples !== undefined) {
    payload.examples = patch.examples;
  }
  if (patch.tags !== undefined) {
    payload.tags = patch.tags;
  }
  if (patch.privacy !== undefined) {
    payload.privacy = patch.privacy;
  }
  if (patch.compatibility !== undefined) {
    payload.compatibility = patch.compatibility;
  }

  return payload;
}

export const api = {
  cards: () => requestJson<SkillCard[]>("/cards"),
  card: (id: string) => requestJson<SkillCard>(`/cards/${id}`),
  updateCard: (id: string, patch: CardPatchInput) =>
    requestJson<SkillCard>(`/cards/${id}`, { method: "PATCH", body: JSON.stringify(toCardPatchPayload(patch)) }),
  createCard: (card: CardCreateInput | SuggestedCard) =>
    requestJson<SkillCard>("/cards", { method: "POST", body: JSON.stringify(toCardCreatePayload(card)) }),
  recommend: (task: string) => requestJson<Recommendation[]>("/recommend", { method: "POST", body: JSON.stringify({ task }) }),
  preview: (task: string, selectedCards: SelectedCard[]) =>
    requestJson<ContextPreviewResponse>("/context/preview", { method: "POST", body: JSON.stringify({ task, selectedCards }) }),
  generate: (task: string, selectedCards: SelectedCard[]) =>
    requestJson<GenerateResponse>("/generate", { method: "POST", body: JSON.stringify({ task, selectedCards }) }),
  share: (cardId: string) =>
    requestJson<{ shareId: string; url: string }>("/share", { method: "POST", body: JSON.stringify({ cardId }) }),
  sharePreview: (shareId: string) => requestJson<ShareLink>(`/share/${shareId}`),
  importShare: (shareId: string) => requestJson<SkillCard>(`/share/${shareId}/import`, { method: "POST", body: JSON.stringify({}) }),
  forkShare: (shareId: string, patch: CardPatchInput) =>
    requestJson<SkillCard>(`/share/${shareId}/fork`, { method: "POST", body: JSON.stringify(toCardPatchPayload(patch)) }),
  timeline: () => requestJson<MemoryEvent[]>("/timeline"),
  health: () => requestJson<HealthResponse>("/health")
};
