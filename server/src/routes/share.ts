import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { CardPatch } from "../services/cards.js";
import { createShareService } from "../services/share.js";
import type { JsonStore } from "../services/store.js";

type UnknownRecord = Record<string, unknown>;

type ShareRouteDeps = {
  store: JsonStore;
  clientOrigin: string;
};

type AsyncRouteHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

const arrayFields = ["scenarios", "tone", "structure", "styleRules", "constraints", "examples", "tags"] as const;
const compatibilityFields = ["chat", "ppt", "writing", "coding"] as const;
const forkPatchFields = new Set([
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

export function createShareRouter(deps: ShareRouteDeps): Router {
  const router = Router();
  const shares = createShareService(deps.store, deps.clientOrigin);

  router.post(
    "/",
    asyncHandler(async (request, response) => {
      const body = request.body as { cardId?: unknown } | undefined;
      const cardId = cardIdFrom(body?.cardId);
      await ensureCardExists(deps.store, cardId);
      response.json(await shares.create(cardId));
    })
  );

  router.get(
    "/:shareId",
    asyncHandler(async (request, response) => {
      const share = await shares.get(request.params.shareId);
      if (!share) {
        throw publicHttpError(404, "Share link not found");
      }
      response.json(share);
    })
  );

  router.post(
    "/:shareId/import",
    asyncHandler(async (request, response) => {
      await ensureShareExists(shares, request.params.shareId);
      response.json(await shares.import(request.params.shareId));
    })
  );

  router.post(
    "/:shareId/fork",
    asyncHandler(async (request, response) => {
      await ensureShareExists(shares, request.params.shareId);
      response.json(await shares.fork(request.params.shareId, parseForkPatch(request.body ?? {})));
    })
  );

  return router;
}

function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

function cardIdFrom(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw publicHttpError(400, "Invalid share request");
  }
  return value;
}

async function ensureCardExists(store: JsonStore, cardId: string): Promise<void> {
  const db = await store.read();
  if (!db.cards.some((card) => card.id === cardId)) {
    throw publicHttpError(404, "Skill Card not found");
  }
}

async function ensureShareExists(shares: ReturnType<typeof createShareService>, shareId: string): Promise<void> {
  const share = await shares.get(shareId);
  if (!share) {
    throw publicHttpError(404, "Share link not found");
  }
}

function parseForkPatch(body: unknown): CardPatch {
  const value = recordFrom(body, "Invalid Skill Card patch");
  const patch: CardPatch = {};

  for (const key of Object.keys(value)) {
    if (!forkPatchFields.has(key)) {
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

function requiredStringArray(value: UnknownRecord, key: string, publicMessage: string): string[] {
  const field = value[key];
  if (!Array.isArray(field) || field.some((item) => typeof item !== "string")) {
    throw publicHttpError(400, publicMessage);
  }
  return field;
}

function requiredPrivacy(value: UnknownRecord, publicMessage: string): NonNullable<CardPatch["privacy"]> {
  const field = value.privacy;
  if (typeof field !== "string" || !privacyValues.has(field)) {
    throw publicHttpError(400, publicMessage);
  }
  return field as NonNullable<CardPatch["privacy"]>;
}

function requiredCompatibility(value: UnknownRecord, publicMessage: string): NonNullable<CardPatch["compatibility"]> {
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
