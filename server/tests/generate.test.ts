import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmConfig } from "../src/config.js";
import type { LlmAdapter } from "../src/services/llm/types.js";
import { createOpenAiCompatibleAdapter } from "../src/services/llm/openaiCompatible.js";
import { generateTaskResponse } from "../src/services/generate.js";
import { createJsonStore } from "../src/services/store.js";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "skill-passport-generate-"));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(tempDir, { recursive: true, force: true });
});

function createTestStore() {
  return createJsonStore({
    dbPath: path.join(tempDir, "db.json"),
    seedCardsPath: path.resolve("src/data/seedCards.json")
  });
}

function llmConfig(overrides: Partial<LlmConfig> = {}): LlmConfig {
  return {
    provider: "openai-compatible",
    baseUrl: "https://api.example.com/v1",
    apiKey: "secret",
    model: "demo-model",
    timeoutMs: 30000,
    mockFallback: false,
    ...overrides
  };
}

function successfulAdapter(text = "Real model outline using classroom presentation habits."): LlmAdapter {
  return {
    generate: vi.fn(async () => ({
      text,
      provider: "openai-compatible",
      model: "demo-model",
      raw: { ok: true }
    }))
  };
}

describe("generateTaskResponse", () => {
  it("calls the injected LLM adapter with selected card context", async () => {
    const store = createTestStore();
    const adapter = successfulAdapter();

    const result = await generateTaskResponse(
      {
        task: "帮我为 HCI 课程做一个 8 页项目展示 PPT 大纲，主题是 AI Skill Passport。",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      },
      {
        store,
        adapter,
        config: llmConfig()
      }
    );

    expect(adapter.generate).toHaveBeenCalledTimes(1);
    expect(vi.mocked(adapter.generate).mock.calls[0][0].messages[1].content).toContain("Classroom Presentation");
    expect(result.usedFallback).toBe(false);
    expect(result.suggestedCard.name).toBe("HCI Project Demo Outline");
  });

  it("returns clearly marked fallback only when fallback is enabled", async () => {
    const store = createTestStore();
    const adapter: LlmAdapter = {
      generate: vi.fn(async () => {
        throw new Error("provider unavailable");
      })
    };

    const result = await generateTaskResponse(
      {
        task: "Make an HCI PPT outline",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      },
      {
        store,
        adapter,
        config: llmConfig({ mockFallback: true })
      }
    );

    expect(result.usedFallback).toBe(true);
    expect(result.output).toContain("[Fallback content]");
  });

  it("rejects adapter failures without fallback and does not persist a session", async () => {
    const store = createTestStore();
    const adapter: LlmAdapter = {
      generate: vi.fn(async () => {
        throw new Error("provider unavailable");
      })
    };

    await expect(
      generateTaskResponse(
        {
          task: "Make an HCI PPT outline",
          selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
        },
        {
          store,
          adapter,
          config: llmConfig({ mockFallback: false })
        }
      )
    ).rejects.toThrow("provider unavailable");

    const db = await store.read();
    expect(db.sessions).toHaveLength(0);
  });

  it.each([
    { apiKey: "", model: "demo-model" },
    { apiKey: "secret", model: "" }
  ])("returns marked fallback when required LLM config is missing", async (config) => {
    const store = createTestStore();
    const adapter = successfulAdapter();

    const result = await generateTaskResponse(
      {
        task: "Make an HCI PPT outline",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      },
      {
        store,
        adapter,
        config: llmConfig({ ...config, mockFallback: true })
      }
    );

    expect(adapter.generate).not.toHaveBeenCalled();
    expect(result.usedFallback).toBe(true);
    expect(result.output).toContain("[Fallback content]");
  });

  it("increments usage for non-temporary selected cards only", async () => {
    const store = createTestStore();
    const before = await store.read();
    const classroomBefore = before.cards.find((card) => card.id === "classroom-presentation");
    const temporaryBefore = before.cards.find((card) => card.id === "minimal-visual-style");

    await generateTaskResponse(
      {
        task: "Make an HCI PPT outline",
        selectedCards: [
          { cardId: "classroom-presentation", mode: "all", selectedFields: [] },
          { cardId: "minimal-visual-style", mode: "temporary", selectedFields: [] }
        ]
      },
      {
        store,
        adapter: successfulAdapter(),
        config: llmConfig()
      }
    );

    const after = await store.read();
    const classroomAfter = after.cards.find((card) => card.id === "classroom-presentation");
    const temporaryAfter = after.cards.find((card) => card.id === "minimal-visual-style");

    expect(classroomBefore).toBeDefined();
    expect(temporaryBefore).toBeDefined();
    expect(classroomAfter?.usageCount).toBe((classroomBefore?.usageCount ?? 0) + 1);
    expect(classroomAfter?.lastUsedAt).toBeDefined();
    expect(temporaryAfter?.usageCount).toBe(temporaryBefore?.usageCount);
    expect(temporaryAfter?.lastUsedAt).toBe(temporaryBefore?.lastUsedAt);

    const usedEvents = after.timeline.filter((event) => event.type === "used");
    expect(usedEvents).toHaveLength(1);
    expect(usedEvents[0]).toMatchObject({
      cardId: "classroom-presentation",
      detail: "Classroom Presentation",
      title: "Used Skill Card"
    });
  });

  it("persists successful generation as a completed session", async () => {
    const store = createTestStore();
    const output = "Persisted model output";

    const result = await generateTaskResponse(
      {
        task: "Make an HCI PPT outline",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      },
      {
        store,
        adapter: successfulAdapter(output),
        config: llmConfig()
      }
    );

    const db = await store.read();
    expect(db.sessions).toHaveLength(1);
    expect(db.sessions[0]).toMatchObject({
      id: result.sessionId,
      generatedContext: result.context,
      modelProvider: "openai-compatible",
      modelName: "demo-model",
      output,
      status: "completed",
      usedFallback: false,
      suggestedCard: result.suggestedCard
    });
  });
});

describe("createOpenAiCompatibleAdapter", () => {
  it("does not leak provider error bodies into thrown messages", async () => {
    const apiKey = "sk-test-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: "upstream echoed Authorization: Bearer sk-test-secret",
            apiKey,
            messages: [{ content: "private prompt content" }]
          }),
          {
            status: 502,
            statusText: "Bad Gateway",
            headers: {
              "x-request-id": "req_safe_123"
            }
          }
        );
      })
    );

    const adapter = createOpenAiCompatibleAdapter({
      provider: "openai-compatible",
      baseUrl: "https://api.example.com/v1",
      apiKey,
      model: "demo-model",
      timeoutMs: 30000,
      mockFallback: false
    });

    let error: unknown;
    try {
      await adapter.generate({
        messages: [{ role: "user", content: "private prompt content" }]
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("502");
    expect(message).toContain("Bad Gateway");
    expect(message).toContain("req_safe_123");
    expect(message).not.toContain(apiKey);
    expect(message).not.toContain("Bearer");
    expect(message).not.toContain("Authorization");
    expect(message).not.toContain("private prompt content");
  });
});
