import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createCardService, type CardPatch, type NewSkillCard } from "../services/cards.js";
import type { JsonStore } from "../services/store.js";

type UnknownRecord = Record<string, unknown>;

type CardsRouteDeps = {
  store: JsonStore;
};

type AsyncRouteHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

const arrayFields = ["scenarios", "tone", "structure", "styleRules", "constraints", "examples", "tags"] as const;
const compatibilityFields = ["chat", "ppt", "writing", "coding"] as const;
const createFields = new Set([
  "name",
  "description",
  "presetPrompt",
  "scenarios",
  "tone",
  "structure",
  "styleRules",
  "constraints",
  "examples",
  "tags",
  "privacy",
  "compatibility"
]);
const patchFields = new Set([
  "name",
  "description",
  "presetPrompt",
  "scenarios",
  "tone",
  "structure",
  "styleRules",
  "constraints",
  "examples",
  "tags",
  "privacy",
  "compatibility"
]);
const privacyValues = new Set(["private", "link", "team", "public"]);

export function createCardsRouter(deps: CardsRouteDeps): Router {
  const router = Router();
  const cards = createCardService(deps.store);

  router.get(
    "/",
    asyncHandler(async (_request, response) => {
      const allCards = await cards.list();
      response.json(allCards.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (request, response) => {
      const card = await cards.get(request.params.id);
      if (!card) {
        throw publicHttpError(404, "Skill Card not found");
      }
      response.json(card);
    })
  );

  router.post(
    "/",
    asyncHandler(async (request, response) => {
      const card = await cards.create(parseNewCard(request.body));
      response.status(201).json(card);
    })
  );

  router.patch(
    "/:id",
    asyncHandler(async (request, response) => {
      await ensureCardExists(cards, request.params.id);
      response.json(await cards.update(request.params.id, parseCardPatch(request.body)));
    })
  );

  router.post(
    "/:id/use",
    asyncHandler(async (request, response) => {
      await ensureCardExists(cards, request.params.id);
      response.json(await cards.markUsed(request.params.id));
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (request, response) => {
      await ensureCardExists(cards, request.params.id);
      response.json(await cards.remove(request.params.id));
    })
  );

  return router;
}

function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

function parseNewCard(body: unknown): NewSkillCard {
  const value = recordFrom(body, "Invalid Skill Card");
  for (const key of Object.keys(value)) {
    if (!createFields.has(key)) {
      throw publicHttpError(400, "Invalid Skill Card");
    }
  }

  const presetPrompt = optionalString(value, "presetPrompt", "Invalid Skill Card");

  return {
    name: requiredString(value, "name", "Invalid Skill Card"),
    description: requiredString(value, "description", "Invalid Skill Card"),
    ...(presetPrompt !== undefined ? { presetPrompt } : {}),
    scenarios: requiredStringArray(value, "scenarios", "Invalid Skill Card"),
    tone: requiredStringArray(value, "tone", "Invalid Skill Card"),
    structure: requiredStringArray(value, "structure", "Invalid Skill Card"),
    styleRules: requiredStringArray(value, "styleRules", "Invalid Skill Card"),
    constraints: requiredStringArray(value, "constraints", "Invalid Skill Card"),
    examples: requiredStringArray(value, "examples", "Invalid Skill Card"),
    tags: requiredStringArray(value, "tags", "Invalid Skill Card"),
    privacy: requiredPrivacy(value, "Invalid Skill Card"),
    compatibility: requiredCompatibility(value, "Invalid Skill Card")
  };
}

function parseCardPatch(body: unknown): CardPatch {
  const value = recordFrom(body, "Invalid Skill Card patch");
  const patch: CardPatch = {};

  for (const key of Object.keys(value)) {
    if (!patchFields.has(key)) {
      throw publicHttpError(400, "Invalid Skill Card patch");
    }
  }

  if ("name" in value) {
    patch.name = requiredString(value, "name", "Invalid Skill Card patch");
  }
  if ("description" in value) {
    patch.description = requiredString(value, "description", "Invalid Skill Card patch");
  }
  if ("presetPrompt" in value) {
    patch.presetPrompt = requiredString(value, "presetPrompt", "Invalid Skill Card patch");
  }
  for (const field of arrayFields) {
    if (field in value) {
      patch[field] = requiredStringArray(value, field, "Invalid Skill Card patch");
    }
  }
  if ("privacy" in value) {
    patch.privacy = requiredPrivacy(value, "Invalid Skill Card patch");
  }
  if ("compatibility" in value) {
    patch.compatibility = requiredCompatibility(value, "Invalid Skill Card patch");
  }

  return patch;
}

async function ensureCardExists(cards: ReturnType<typeof createCardService>, id: string): Promise<void> {
  const card = await cards.get(id);
  if (!card) {
    throw publicHttpError(404, "Skill Card not found");
  }
}

function recordFrom(value: unknown, publicMessage: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw publicHttpError(400, publicMessage);
  }
  return value as UnknownRecord;
}

function requiredString(value: UnknownRecord, key: string, publicMessage: string): string {
  const field = value[key];
  if (typeof field !== "string") {
    throw publicHttpError(400, publicMessage);
  }
  return field;
}

function optionalString(value: UnknownRecord, key: string, publicMessage: string): string | undefined {
  const field = value[key];
  if (field === undefined) {
    return undefined;
  }
  if (typeof field !== "string") {
    throw publicHttpError(400, publicMessage);
  }
  return field;
}

function requiredStringArray(value: UnknownRecord, key: string, publicMessage: string): string[] {
  const field = value[key];
  if (!Array.isArray(field) || field.some((item) => typeof item !== "string")) {
    throw publicHttpError(400, publicMessage);
  }
  return field;
}

function requiredPrivacy(value: UnknownRecord, publicMessage: string): NewSkillCard["privacy"] {
  const field = value.privacy;
  if (typeof field !== "string" || !privacyValues.has(field)) {
    throw publicHttpError(400, publicMessage);
  }
  return field as NewSkillCard["privacy"];
}

function requiredCompatibility(value: UnknownRecord, publicMessage: string): NewSkillCard["compatibility"] {
  const field = value.compatibility;
  if (!field || typeof field !== "object" || Array.isArray(field)) {
    throw publicHttpError(400, publicMessage);
  }

  const compatibility = field as UnknownRecord;
  for (const key of compatibilityFields) {
    if (typeof compatibility[key] !== "number") {
      throw publicHttpError(400, publicMessage);
    }
  }

  return {
    chat: compatibility.chat as number,
    ppt: compatibility.ppt as number,
    writing: compatibility.writing as number,
    coding: compatibility.coding as number
  };
}

function publicHttpError(status: number, publicMessage: string): Error & { status: number; publicMessage: string } {
  return Object.assign(new Error(publicMessage), { status, publicMessage });
}
