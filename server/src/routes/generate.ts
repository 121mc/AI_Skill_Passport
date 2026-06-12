import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { LlmConfig } from "../config.js";
import { generateTaskResponse } from "../services/generate.js";
import type { LlmAdapter } from "../services/llm/types.js";
import type { JsonStore } from "../services/store.js";
import { ensureSelectedCardsExist, parseSelectedCards } from "./context.js";

type GenerateRouteDeps = {
  store: JsonStore;
  adapter: LlmAdapter;
  config: LlmConfig;
};

type AsyncRouteHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export function createGenerateRouter(deps: GenerateRouteDeps): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (request, response) => {
      const body = request.body as { task?: unknown; selectedCards?: unknown } | undefined;
      const selectedCards = parseSelectedCards(body?.selectedCards);
      const db = await deps.store.read();
      ensureSelectedCardsExist(selectedCards, db.cards.map((card) => card.id));
      const result = await generateTaskResponse(
        {
          task: String(body?.task || ""),
          selectedCards
        },
        deps
      );

      response.json(result);
    })
  );

  return router;
}

function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}
