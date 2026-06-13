export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmGenerateInput = {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type LlmGenerateResult = {
  text: string;
  provider: string;
  model: string;
  raw?: unknown;
};

export type LlmAdapter = {
  generate(input: LlmGenerateInput): Promise<LlmGenerateResult>;
};
