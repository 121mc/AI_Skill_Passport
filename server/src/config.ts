import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
dotenv.config();

export type LlmConfig = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  mockFallback: boolean;
};

export function loadLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  return {
    provider: env.LLM_PROVIDER || "openai-compatible",
    baseUrl: env.LLM_BASE_URL || "https://api.openai.com/v1",
    apiKey: env.LLM_API_KEY || "",
    model: env.LLM_MODEL || "",
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 30000),
    mockFallback: env.LLM_MOCK_FALLBACK !== "false"
  };
}
