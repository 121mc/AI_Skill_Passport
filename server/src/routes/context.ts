import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { SelectedCard } from "../../../shared/types.js";
import { buildContextPreview } from "../services/promptBuilder.js";
import type { JsonStore } from "../services/store.js";

type UnknownRecord = Record<string, unknown>;

type ContextRouteDeps = {
  store: JsonStore;
};

type AsyncRouteHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;
const selectionModes = new Set(["all", "partial", "temporary"]);
const selectedFieldValues = new Set(["tone", "structure", "styleRules", "constraints", "examples"]);

export function createContextRouter(deps: ContextRouteDeps): Router {
  const router = Router();

  router.post(
    "/preview",
    asyncHandler(async (request, response) => {
      const db = await deps.store.read();
      const body = request.body as { task?: unknown; selectedCards?: unknown } | undefined;
      const selectedCards = parseSelectedCards(body?.selectedCards);
      ensureSelectedCardsExist(selectedCards, db.cards.map((card) => card.id));
      response.json(buildContextPreview(String(body?.task || ""), db.cards, selectedCards));
    })
  );

  return router;
}

export function parseSelectedCards(value: unknown): SelectedCard[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw publicHttpError(400, "Invalid selectedCards");
  }

  return value.map(parseSelectedCard);
}

function parseSelectedCard(value: unknown): SelectedCard {
  const selection = recordFrom(value);
  const cardId = selection.cardId;
  const mode = selection.mode;

  if (typeof cardId !== "string" || !selectionModes.has(String(mode))) {
    throw publicHttpError(400, "Invalid selectedCards");
  }

  if (mode === "all" || mode === "temporary") {
    if (selection.selectedFields !== undefined) {
      validateSelectedFields(selection.selectedFields);
    }
    return {
      cardId,
      mode,
      selectedFields: []
    };
  }

  if (mode === "partial") {
    return {
      cardId,
      mode,
      selectedFields: validateSelectedFields(selection.selectedFields)
    };
  }

  throw publicHttpError(400, "Invalid selectedCards");
}

function recordFrom(value: unknown): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw publicHttpError(400, "Invalid selectedCards");
  }
  return value as UnknownRecord;
}

function validateSelectedFields(value: unknown): SelectedCard["selectedFields"] {
  if (!Array.isArray(value) || value.some((field) => typeof field !== "string" || !selectedFieldValues.has(field))) {
    throw publicHttpError(400, "Invalid selectedCards");
  }
  return value as SelectedCard["selectedFields"];
}

export function ensureSelectedCardsExist(selectedCards: SelectedCard[], cardIds: string[]): void {
  const knownCardIds = new Set(cardIds);
  if (selectedCards.some((selection) => !knownCardIds.has(selection.cardId))) {
    throw publicHttpError(400, "Unknown selected Skill Card");
  }
}

function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

function publicHttpError(status: number, publicMessage: string): Error & { status: number; publicMessage: string } {
  return Object.assign(new Error(publicMessage), { status, publicMessage });
}
