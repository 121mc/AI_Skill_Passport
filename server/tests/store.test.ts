import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseShape, SkillCard } from "../../shared/types.js";
import { createCardService } from "../src/services/cards.js";
import { createJsonStore } from "../src/services/store.js";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "skill-passport-store-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("json store and card service", () => {
  it("seeds cards when the database is empty", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });

    const db = await store.read();

    expect(db.cards.map((card) => card.id)).toContain("classroom-presentation");
    expect(db.shares).toEqual([]);
    expect(db.sessions).toEqual([]);
  });

  it("seeds Chinese preset cards with text-only preset prompts", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });

    const db = await store.read();
    const cards = db.cards as Array<SkillCard & { presetPrompt?: string }>;

    expect(cards.map((card) => card.name)).toEqual([
      "课堂展示助手",
      "答辩表达助手",
      "中文邮件助手",
      "开放设计文本助手"
    ]);
    expect(cards.every((card) => card.presetPrompt?.includes("只输出文本"))).toBe(true);
    expect(cards.every((card) => card.presetPrompt && card.presetPrompt.length > 20)).toBe(true);
  });

  it("rejects malformed existing database JSON without overwriting it", async () => {
    const dbPath = path.join(tempDir, "db.json");
    const malformedJson = "{ not json";
    await writeFile(dbPath, malformedJson, "utf8");
    const store = createJsonStore({
      dbPath,
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });

    let readError: unknown;
    try {
      await store.read();
    } catch (error) {
      readError = error;
    }
    const persistedJson = await readFile(dbPath, "utf8");

    expect(readError).toBeInstanceOf(Error);
    expect((readError as Error).message).toContain(`Failed to read JSON database at ${dbPath}`);
    expect(persistedJson).toBe(malformedJson);
  });

  it("preserves existing non-card arrays when seeding cards", async () => {
    const dbPath = path.join(tempDir, "db.json");
    const existingDb: DatabaseShape = {
      cards: [],
      shares: [
        {
          id: "share_existing",
          cardId: "existing-card",
          snapshot: existingCard,
          createdAt: "2026-06-12T08:00:00.000Z",
          importCount: 2
        }
      ],
      sessions: [
        {
          id: "session_existing",
          userTask: "Summarize a demo",
          selectedCards: [],
          generatedContext: "Existing context",
          modelProvider: "local",
          modelName: "demo-model",
          output: "Existing output",
          status: "completed",
          usedFallback: false,
          createdAt: "2026-06-12T08:05:00.000Z"
        }
      ],
      timeline: [
        {
          id: "event_existing",
          type: "shared",
          title: "Existing Event",
          detail: "Keep this event",
          createdAt: "2026-06-12T08:10:00.000Z"
        }
      ]
    };
    await writeFile(dbPath, `${JSON.stringify(existingDb, null, 2)}\n`, "utf8");
    const store = createJsonStore({
      dbPath,
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });

    const db = await store.read();

    expect(db.cards.map((card) => card.id)).toContain("classroom-presentation");
    expect(db.shares).toEqual(existingDb.shares);
    expect(db.sessions).toEqual(existingDb.sessions);
    expect(db.timeline).toEqual(existingDb.timeline);
  });

  it("preserves a concurrent first-run card creation while seeding", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const cards = createCardService(store);

    const [, created] = await Promise.all([
      Promise.all(Array.from({ length: 16 }, () => store.read())),
      cards.create({
        name: "Concurrent Habit",
        description: "Survives concurrent first-run seeding.",
        scenarios: ["concurrency"],
        tone: ["clear"],
        structure: ["context", "answer"],
        styleRules: ["brief bullets"],
        constraints: ["keep user control visible"],
        examples: ["short concurrent output"],
        tags: ["concurrency"],
        privacy: "private",
        compatibility: { chat: 80, ppt: 50, writing: 60, coding: 10 }
      })
    ]);
    const db = await store.read();

    expect(db.cards.map((card) => card.id)).toContain("classroom-presentation");
    expect(db.cards.find((card) => card.id === created.id)).toMatchObject({
      id: created.id,
      name: "Concurrent Habit"
    });
    expect(db.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "created",
          cardId: created.id,
          title: "创建技能卡片",
          detail: "Concurrent Habit"
        })
      ])
    );
  });

  it("creates, updates, and deletes a local card copy", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const cards = createCardService(store);

    const created = await cards.create({
      name: "Demo Habit",
      description: "Reusable demo behavior.",
      scenarios: ["demo"],
      tone: ["clear"],
      structure: ["context", "answer"],
      styleRules: ["brief bullets"],
      constraints: ["keep user control visible"],
      examples: ["short demo output"],
      tags: ["demo"],
      privacy: "private",
      compatibility: { chat: 80, ppt: 50, writing: 60, coding: 10 }
    });

    const updated = await cards.update(created.id, { privacy: "link", usageCount: 4 });
    const removed = await cards.remove(created.id);
    const allCards = await cards.list();

    expect(created.id).toMatch(/^card_/);
    expect(updated.privacy).toBe("link");
    expect(updated.usageCount).toBe(4);
    expect(removed.id).toBe(created.id);
    expect(allCards.some((card) => card.id === created.id)).toBe(false);
  });

  it("records card timeline events and marks a card as used", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const cards = createCardService(store);

    const created = await cards.create({
      name: "Timeline Habit",
      description: "Checks timeline behavior.",
      scenarios: ["timeline"],
      tone: ["clear"],
      structure: ["context", "answer"],
      styleRules: ["brief bullets"],
      constraints: ["keep user control visible"],
      examples: ["short timeline output"],
      tags: ["timeline"],
      privacy: "private",
      compatibility: { chat: 80, ppt: 50, writing: 60, coding: 10 }
    });
    await cards.update(created.id, { privacy: "link" });
    const used = await cards.markUsed(created.id);
    const db = await store.read();

    expect(used.usageCount).toBe(1);
    expect(used.lastUsedAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(used.lastUsedAt ?? ""))).toBe(false);
    expect(used.updatedAt).toBe(used.lastUsedAt);
    expect(db.timeline.slice(0, 3).map((event) => event.type)).toEqual(["used", "updated", "created"]);
    expect(db.timeline.slice(0, 3).map((event) => event.cardId)).toEqual([created.id, created.id, created.id]);
    expect(db.timeline[0]).toMatchObject({
      title: "使用技能卡片",
      detail: "Timeline Habit"
    });
    expect(db.timeline[1]).toMatchObject({
      title: "更新技能卡片",
      detail: "Timeline Habit"
    });
    expect(db.timeline[2]).toMatchObject({
      title: "创建技能卡片",
      detail: "Timeline Habit"
    });
  });
});

const existingCard: SkillCard = {
  id: "existing-card",
  name: "Existing Card",
  description: "Existing card snapshot.",
  scenarios: ["existing"],
  tone: ["clear"],
  structure: ["context", "answer"],
  styleRules: ["brief bullets"],
  constraints: ["keep user control visible"],
  examples: ["short output"],
  tags: ["existing"],
  privacy: "private",
  compatibility: { chat: 80, ppt: 50, writing: 60, coding: 10 },
  usageCount: 0,
  createdAt: "2026-06-12T08:00:00.000Z",
  updatedAt: "2026-06-12T08:00:00.000Z"
};
