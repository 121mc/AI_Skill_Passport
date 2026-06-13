import { randomUUID } from "node:crypto";
import type { MemoryEvent, SkillCard } from "../../../shared/types.js";
import type { JsonStore } from "./store.js";

export type NewSkillCard = Omit<SkillCard, "id" | "createdAt" | "updatedAt" | "usageCount" | "lastUsedAt"> & {
  usageCount?: number;
};

export type CardPatch = Partial<Omit<SkillCard, "id" | "createdAt">>;

export function createCardService(store: JsonStore) {
  return {
    async list(): Promise<SkillCard[]> {
      const db = await store.read();
      return [...db.cards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async get(id: string): Promise<SkillCard | undefined> {
      const db = await store.read();
      return db.cards.find((card) => card.id === id);
    },

    async create(input: NewSkillCard): Promise<SkillCard> {
      return store.update((db) => {
        const now = new Date().toISOString();
        const card: SkillCard = {
          ...input,
          id: `card_${randomUUID()}`,
          usageCount: input.usageCount ?? 0,
          createdAt: now,
          updatedAt: now
        };
        db.cards.push(card);
        db.timeline.unshift(event("created", "创建技能卡片", card.name, { cardId: card.id }));
        return card;
      });
    },

    async update(id: string, patch: CardPatch): Promise<SkillCard> {
      return store.update((db) => {
        const card = db.cards.find((item) => item.id === id);
        if (!card) {
          throw new Error(`Skill Card not found: ${id}`);
        }
        Object.assign(card, patch, { updatedAt: new Date().toISOString() });
        db.timeline.unshift(event("updated", "更新技能卡片", card.name, { cardId: id }));
        return card;
      });
    },

    async markUsed(id: string): Promise<SkillCard> {
      return store.update((db) => {
        const card = db.cards.find((item) => item.id === id);
        if (!card) {
          throw new Error(`Skill Card not found: ${id}`);
        }
        card.usageCount += 1;
        card.lastUsedAt = new Date().toISOString();
        card.updatedAt = card.lastUsedAt;
        db.timeline.unshift(event("used", "使用技能卡片", card.name, { cardId: id }));
        return card;
      });
    },

    async remove(id: string): Promise<SkillCard> {
      return store.update((db) => {
        const index = db.cards.findIndex((item) => item.id === id);
        if (index === -1) {
          throw new Error(`Skill Card not found: ${id}`);
        }
        const [removed] = db.cards.splice(index, 1);
        return removed;
      });
    }
  };
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
