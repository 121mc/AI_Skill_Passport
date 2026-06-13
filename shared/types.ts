export type PrivacyLevel = "private" | "link" | "team" | "public";

export type SkillField = "tone" | "structure" | "styleRules" | "constraints" | "examples";

export type SkillCard = {
  id: string;
  name: string;
  description: string;
  presetPrompt?: string;
  scenarios: string[];
  tone: string[];
  structure: string[];
  styleRules: string[];
  constraints: string[];
  examples: string[];
  tags: string[];
  privacy: PrivacyLevel;
  compatibility: {
    chat: number;
    ppt: number;
    writing: number;
    coding: number;
  };
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
};

export type SelectedCard = {
  cardId: string;
  mode: "all" | "partial" | "temporary";
  selectedFields: SkillField[];
};

export type AppliedCardSummary = {
  cardId: string;
  name: string;
  mode: SelectedCard["mode"];
  fields: SkillField[];
};

export type TaskSession = {
  id: string;
  userTask: string;
  selectedCards: SelectedCard[];
  generatedContext: string;
  modelProvider: string;
  modelName: string;
  output: string;
  status: "draft" | "generating" | "completed" | "failed";
  usedFallback: boolean;
  suggestedCard?: SuggestedCard;
  createdAt: string;
};

export type SuggestedCard = {
  name: string;
  description: string;
  presetPrompt?: string;
  scenarios: string[];
  tone: string[];
  structure: string[];
  styleRules: string[];
  constraints: string[];
  examples: string[];
  tags: string[];
  privacy: PrivacyLevel;
};

export type ShareLink = {
  id: string;
  cardId: string;
  snapshot: SkillCard;
  createdAt: string;
  expiresAt?: string;
  importCount: number;
};

export type MemoryEvent = {
  id: string;
  type: "created" | "used" | "updated" | "shared" | "imported" | "suggested";
  cardId?: string;
  taskSessionId?: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type DatabaseShape = {
  cards: SkillCard[];
  shares: ShareLink[];
  sessions: TaskSession[];
  timeline: MemoryEvent[];
};

export type ContextPreviewResponse = {
  context: string;
  appliedCards: AppliedCardSummary[];
};

export type Recommendation = {
  card: SkillCard;
  score: number;
  reasons: string[];
};

export type GenerateResponse = {
  sessionId: string;
  context: string;
  output: string;
  provider: string;
  model: string;
  usedFallback: boolean;
  suggestedCard: SuggestedCard;
};
