import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadLlmConfig } from "../src/config.js";
import { createMockFallbackAdapter } from "../src/services/llm/mockFallback.js";
import { createJsonStore } from "../src/services/store.js";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "skill-passport-api-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("api routes", () => {
  it("returns seed cards", async () => {
    const app = makeTestApp();

    const response = await request(app).get("/api/cards").expect(200);

    expect(response.body[0].id).toBe("classroom-presentation");
  });

  it("excludes sensitive config fields from health responses", async () => {
    const app = makeTestApp({
      config: {
        ...loadLlmConfig({}),
        apiKey: "sk-test-secret",
        baseUrl: "https://api.example.com/v1",
        model: "private-model",
        mockFallback: true
      }
    });

    const response = await request(app).get("/api/health").expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      provider: "openai-compatible",
      modelConfigured: true,
      fallbackEnabled: true
    });
    expect(response.body).not.toHaveProperty("apiKey");
    expect(response.body).not.toHaveProperty("baseUrl");
    expect(response.body).not.toHaveProperty("model");
  });

  it("returns public 404 JSON for missing cards", async () => {
    const app = makeTestApp();

    const response = await request(app).get("/api/cards/missing-card").expect(404);

    expect(response.body).toEqual({ error: "Skill Card not found" });
  });

  it("rejects invalid card creation without persisting malformed data", async () => {
    const app = makeTestApp();

    await request(app)
      .post("/api/cards")
      .send({ name: "Malformed Card", scenarios: "not an array" })
      .expect(400);
    const cards = await request(app).get("/api/cards").expect(200);

    expect(cards.body.some((card: { name?: string }) => card.name === "Malformed Card")).toBe(false);
  });

  it("rejects card creation that tries to set server-owned usage telemetry", async () => {
    const app = makeTestApp();

    await request(app).post("/api/cards").send(validNewCard({ usageCount: 99 })).expect(400);
    const cards = await request(app).get("/api/cards").expect(200);

    expect(cards.body.some((card: { name?: string }) => card.name === "Forged Usage Card")).toBe(false);
  });

  it("rejects card patches that try to mutate server-owned fields", async () => {
    const app = makeTestApp();

    await request(app)
      .patch("/api/cards/classroom-presentation")
      .send({ id: "changed-card-id", name: "Attempted Rename" })
      .expect(400);
    const card = await request(app).get("/api/cards/classroom-presentation").expect(200);

    expect(card.body.id).toBe("classroom-presentation");
    expect(card.body.name).toBe("Classroom Presentation");
  });

  it("rejects card patches that try to mutate usageCount", async () => {
    const app = makeTestApp();

    await request(app).patch("/api/cards/classroom-presentation").send({ usageCount: 999 }).expect(400);
    const card = await request(app).get("/api/cards/classroom-presentation").expect(200);

    expect(card.body.usageCount).toBe(3);
  });

  it("rejects card patches that try to mutate lastUsedAt", async () => {
    const app = makeTestApp();

    await request(app)
      .patch("/api/cards/classroom-presentation")
      .send({ lastUsedAt: "2099-01-01T00:00:00.000Z" })
      .expect(400);
    const card = await request(app).get("/api/cards/classroom-presentation").expect(200);

    expect(card.body.lastUsedAt).toBe("2026-06-12T10:00:00.000Z");
  });

  it("rejects share fork patches that try to mutate server-owned fields", async () => {
    const app = makeTestApp();

    const share = await request(app).post("/api/share").send({ cardId: "classroom-presentation" }).expect(200);
    await request(app)
      .post(`/api/share/${share.body.shareId}/fork`)
      .send({ id: "changed-card-id", name: "Attempted Fork" })
      .expect(400);
    const imported = await request(app).post(`/api/share/${share.body.shareId}/import`).send({}).expect(200);

    expect(imported.body.id).toMatch(/^imported_/);
    expect(imported.body.id).not.toBe("changed-card-id");
  });

  it("returns generic 500 JSON for internal store errors", async () => {
    const dbPath = path.join(tempDir, "broken-db.json");
    await writeFile(dbPath, "{ not json", "utf8");
    const app = makeTestApp({ dbPath });

    const response = await request(app).get("/api/cards").expect(500);

    expect(response.body).toEqual({ error: "Internal server error" });
    expect(response.text).not.toContain(dbPath);
    expect(response.text).not.toContain("Failed to read JSON database");
  });

  it("returns context preview without calling an LLM", async () => {
    const app = makeTestApp();

    const response = await request(app)
      .post("/api/context/preview")
      .send({
        task: "Make an HCI PPT",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      })
      .expect(200);

    expect(response.body.context).toContain("Classroom Presentation");
    expect(response.body.appliedCards[0].fields).toContain("tone");
  });

  it("rejects partial context preview selections missing selectedFields", async () => {
    const app = makeTestApp();

    const response = await request(app)
      .post("/api/context/preview")
      .send({
        task: "Make an HCI PPT",
        selectedCards: [{ cardId: "classroom-presentation", mode: "partial" }]
      })
      .expect(400);

    expect(response.body).toEqual({ error: "Invalid selectedCards" });
  });

  it("rejects context preview selections for unknown cards", async () => {
    const app = makeTestApp();

    const response = await request(app)
      .post("/api/context/preview")
      .send({
        task: "Make an HCI PPT",
        selectedCards: [{ cardId: "missing-card", mode: "all", selectedFields: [] }]
      })
      .expect(400);

    expect(response.body).toEqual({ error: "Unknown selected Skill Card" });
  });

  it("allows all-mode context preview selections without selectedFields", async () => {
    const app = makeTestApp();

    const response = await request(app)
      .post("/api/context/preview")
      .send({
        task: "Make an HCI PPT",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all" }]
      })
      .expect(200);

    expect(response.body.context).toContain("Classroom Presentation");
    expect(response.body.appliedCards[0].fields).toContain("tone");
  });

  it("creates a share snapshot and imports it", async () => {
    const app = makeTestApp();

    const share = await request(app).post("/api/share").send({ cardId: "classroom-presentation" }).expect(200);
    const imported = await request(app).post(`/api/share/${share.body.shareId}/import`).send({}).expect(200);

    expect(share.body.url).toContain("/share/");
    expect(imported.body.id).toMatch(/^imported_/);
  });

  it("generates fallback output through the API in demo mode", async () => {
    const app = makeTestApp();

    const response = await request(app)
      .post("/api/generate")
      .send({
        task: "Make an HCI PPT outline",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      })
      .expect(200);

    expect(response.body.usedFallback).toBe(true);
    expect(response.body.suggestedCard.name).toBe("HCI Project Demo Outline");
  });

  it("returns a safe public error when generation config is missing and fallback is disabled", async () => {
    const app = makeTestApp({
      config: {
        ...loadLlmConfig({}),
        apiKey: "",
        model: "",
        mockFallback: false
      }
    });

    const response = await request(app)
      .post("/api/generate")
      .send({
        task: "Make an HCI PPT outline",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      })
      .expect(503);

    expect(response.body).toEqual({ error: "LLM configuration is missing" });
    expect(response.text).not.toContain("secret");
    expect(response.text).not.toContain("LLM_API_KEY=");
  });

  it("returns a safe public error when the LLM provider fails and fallback is disabled", async () => {
    const app = makeTestApp({
      adapter: {
        generate: vi.fn(async () => {
          throw new Error("provider unavailable with sk-test-secret");
        })
      },
      config: {
        ...loadLlmConfig({}),
        apiKey: "sk-test-secret",
        model: "demo-model",
        mockFallback: false
      }
    });

    const response = await request(app)
      .post("/api/generate")
      .send({
        task: "Make an HCI PPT outline",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      })
      .expect(502);

    expect(response.body).toEqual({ error: "LLM generation failed" });
    expect(response.text).not.toContain("provider unavailable");
    expect(response.text).not.toContain("sk-test-secret");
  });

  it("rejects generate selections for unknown cards without persisting a session", async () => {
    const dbPath = path.join(tempDir, "db.json");
    const store = createJsonStore({
      dbPath,
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const app = createApp({
      store,
      adapter: createMockFallbackAdapter(),
      config: {
        ...loadLlmConfig({}),
        mockFallback: true
      },
      clientOrigin: "http://localhost:5173"
    });

    const response = await request(app)
      .post("/api/generate")
      .send({
        task: "Make an HCI PPT outline",
        selectedCards: [{ cardId: "missing-card", mode: "all", selectedFields: [] }]
      })
      .expect(400);
    const db = await store.read();

    expect(response.body).toEqual({ error: "Unknown selected Skill Card" });
    expect(db.sessions).toHaveLength(0);
  });

  it("rejects malformed generate selections without persisting a session", async () => {
    const dbPath = path.join(tempDir, "db.json");
    const store = createJsonStore({
      dbPath,
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const app = createApp({
      store,
      adapter: createMockFallbackAdapter(),
      config: {
        ...loadLlmConfig({}),
        mockFallback: true
      },
      clientOrigin: "http://localhost:5173"
    });

    const response = await request(app)
      .post("/api/generate")
      .send({
        task: "Make an HCI PPT outline",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: "not-array" }]
      })
      .expect(400);
    const db = await store.read();

    expect(response.body).toEqual({ error: "Invalid selectedCards" });
    expect(db.sessions).toHaveLength(0);
  });
});

function makeTestApp(options: { adapter?: ReturnType<typeof createMockFallbackAdapter>; dbPath?: string; config?: ReturnType<typeof loadLlmConfig> } = {}) {
  const store = createJsonStore({
    dbPath: options.dbPath ?? path.join(tempDir, "db.json"),
    seedCardsPath: path.resolve("src/data/seedCards.json")
  });

  return createApp({
    store,
    adapter: options.adapter ?? createMockFallbackAdapter(),
    config: options.config ?? {
      ...loadLlmConfig({}),
      mockFallback: true
    },
    clientOrigin: "http://localhost:5173"
  });
}

function validNewCard(overrides: Record<string, unknown> = {}) {
  return {
    name: "Forged Usage Card",
    description: "A valid card body except for forbidden telemetry fields.",
    scenarios: ["api test"],
    tone: ["clear"],
    structure: ["context", "answer"],
    styleRules: ["brief"],
    constraints: ["stay focused"],
    examples: ["short output"],
    tags: ["test"],
    privacy: "private",
    compatibility: { chat: 80, ppt: 50, writing: 60, coding: 10 },
    ...overrides
  };
}
