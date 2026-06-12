import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { JsonStore } from "../services/store.js";

type TimelineRouteDeps = {
  store: JsonStore;
};

type AsyncRouteHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export function createTimelineRouter(deps: TimelineRouteDeps): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (_request, response) => {
      const db = await deps.store.read();
      response.json(db.timeline);
    })
  );

  return router;
}

function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}
