import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { recommendCards } from "../services/recommend.js";
import type { JsonStore } from "../services/store.js";

type RecommendRouteDeps = {
  store: JsonStore;
};

type AsyncRouteHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export function createRecommendRouter(deps: RecommendRouteDeps): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (request, response) => {
      const db = await deps.store.read();
      const body = request.body as { task?: unknown } | undefined;
      response.json(recommendCards(String(body?.task || ""), db.cards));
    })
  );

  return router;
}

function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}
