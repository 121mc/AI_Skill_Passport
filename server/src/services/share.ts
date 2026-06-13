import { randomUUID } from "node:crypto";
import type { MemoryEvent, ShareLink, SkillCard } from "../../../shared/types.js";
import type { CardPatch } from "./cards.js";
import type { JsonStore } from "./store.js";

export function createShareService(store: JsonStore, clientOrigin: string) {
  return {
    async create(cardId: string): Promise<{ shareId: string; url: string }> {
      return store.update((db) => {
        const card = db.cards.find((item) => item.id === cardId);
        if (!card) {
          throw new Error(`Skill Card not found: ${cardId}`);
        }
        const shareId = `share_${randomUUID()}`;
        const share: ShareLink = {
          id: shareId,
          cardId,
          snapshot: structuredClone(card),
          createdAt: new Date().toISOString(),
          importCount: 0
        };
        db.shares.unshift(share);
        db.timeline.unshift(event("shared", "创建分享链接", card.name, { cardId }));
        return {
          shareId,
          url: `${clientOrigin}/share/${shareId}`
        };
      });
    },

    async get(shareId: string): Promise<ShareLink | undefined> {
      const db = await store.read();
      return db.shares.find((share) => share.id === shareId);
    },

    async import(shareId: string): Promise<SkillCard> {
      return copyFromShare(store, shareId, "imported_", {});
    },

    async fork(shareId: string, patch: CardPatch): Promise<SkillCard> {
      return copyFromShare(store, shareId, "fork_", patch);
    }
  };
}

async function copyFromShare(
  store: JsonStore,
  shareId: string,
  idPrefix: "imported_" | "fork_",
  patch: CardPatch
): Promise<SkillCard> {
  return store.update((db) => {
    const share = db.shares.find((item) => item.id === shareId);
    if (!share) {
      throw new Error(`Share link not found: ${shareId}`);
    }
    const now = new Date().toISOString();
    const copied: SkillCard = {
      ...structuredClone(share.snapshot),
      ...patch,
      id: `${idPrefix}${randomUUID()}`,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: undefined
    };
    db.cards.push(copied);
    share.importCount += 1;
    db.timeline.unshift(
      event("imported", idPrefix === "fork_" ? "复刻分享技能卡片" : "导入分享技能卡片", copied.name, {
        cardId: copied.id
      })
    );
    return copied;
  });
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
