import type { LlmConfig } from "../../config.js";
import type { LlmAdapter, LlmGenerateInput, LlmGenerateResult } from "./types.js";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export function createOpenAiCompatibleAdapter(config: LlmConfig): LlmAdapter {
  return {
    async generate(input: LlmGenerateInput): Promise<LlmGenerateResult> {
      if (!config.apiKey || !config.model) {
        throw new Error("LLM_API_KEY and LLM_MODEL are required for real generation.");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: config.model,
            messages: input.messages,
            temperature: input.temperature ?? 0.4,
            max_tokens: input.maxTokens ?? 1200
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(providerErrorMessage(response));
        }

        const raw = (await response.json()) as ChatCompletionResponse;
        const text = raw.choices?.[0]?.message?.content?.trim();
        if (!text) {
          throw new Error("LLM provider returned an empty response.");
        }

        return {
          text,
          provider: config.provider,
          model: config.model,
          raw
        };
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

function providerErrorMessage(response: Response): string {
  const statusText = response.statusText ? ` ${sanitizeStatusText(response.statusText)}` : "";
  const requestId = safeRequestId(response.headers);
  const requestIdText = requestId ? ` (request id: ${requestId})` : "";

  return `LLM provider returned ${response.status}${statusText}${requestIdText}.`;
}

function safeRequestId(headers: Headers): string | undefined {
  for (const headerName of ["x-request-id", "request-id", "openai-request-id", "x-correlation-id"]) {
    const value = headers.get(headerName);
    if (value && /^[\w.:-]{1,128}$/.test(value)) {
      return value;
    }
  }
  return undefined;
}

function sanitizeStatusText(value: string): string {
  return value
    .replace(/[^\w .:-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 128);
}
