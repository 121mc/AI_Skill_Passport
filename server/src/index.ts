import path from "node:path";
import { createApp } from "./app.js";
import { loadLlmConfig } from "./config.js";
import { createOpenAiCompatibleAdapter } from "./services/llm/openaiCompatible.js";
import { createJsonStore } from "./services/store.js";

const config = loadLlmConfig();
const store = createJsonStore({
  dbPath: path.resolve(process.cwd(), "src/data/db.json"),
  seedCardsPath: path.resolve(process.cwd(), "src/data/seedCards.json")
});
const adapter = createOpenAiCompatibleAdapter(config);
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const port = Number(process.env.PORT || 8787);

const app = createApp({
  store,
  adapter,
  config,
  clientOrigin
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Skill Passport API listening on http://127.0.0.1:${port}`);
});
