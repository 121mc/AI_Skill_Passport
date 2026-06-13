import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createShareService } from "../src/services/share.js";
import { createJsonStore } from "../src/services/store.js";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "skill-passport-share-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("share service", () => {
  it("creates an immutable share snapshot", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const service = createShareService(store, "http://localhost:5173");

    const share = await service.create("classroom-presentation");
    await store.update((db) => {
      const card = db.cards.find((item) => item.id === "classroom-presentation");
      if (!card) {
        throw new Error("Seed card not found: classroom-presentation");
      }
      card.name = "被修改的课堂展示助手";
      card.description = "This edit should not change the share snapshot.";
      card.updatedAt = new Date().toISOString();
    });
    const preview = await service.get(share.shareId);

    expect(share.url).toBe("http://localhost:5173/share/" + share.shareId);
    expect(preview?.snapshot.id).toBe("classroom-presentation");
    expect(preview?.snapshot.name).toBe("课堂展示助手");
    expect(preview?.snapshot.description).toBe("用于 HCI 或课程汇报，生成清晰、自然、有课堂感的文本型展示大纲。");
    expect(preview?.snapshot.presetPrompt).toContain("只输出文本");
  });

  it("imports a shared card as a local user-owned copy", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const service = createShareService(store, "http://localhost:5173");

    const share = await service.create("minimal-visual-style");
    const imported = await service.import(share.shareId);
    const db = await store.read();

    expect(imported.id).toMatch(/^imported_/);
    expect(imported.id).not.toBe("minimal-visual-style");
    expect(imported.name).toBe("开放设计文本助手");
    expect(db.shares[0].importCount).toBe(1);
    expect(db.timeline[0].type).toBe("imported");
  });

  it("forks a shared card with user edits", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const service = createShareService(store, "http://localhost:5173");

    const share = await service.create("minimal-visual-style");
    const forked = await service.fork(share.shareId, { name: "My Minimal Deck Style", privacy: "private" });

    expect(forked.id).toMatch(/^fork_/);
    expect(forked.name).toBe("My Minimal Deck Style");
    expect(forked.privacy).toBe("private");
  });
});
