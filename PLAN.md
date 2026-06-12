# AI Skill Passport Local Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local full-stack AI Skill Passport demo where users can create, select, combine, share, import, and apply Skill Cards, and selected card content is injected into a real OpenAI-compatible LLM request.

**Architecture:** Use a TypeScript monorepo with a Vite React client on `http://localhost:5173` and an Express API on `http://localhost:8787`. The server owns JSON-file storage, prompt composition, recommendation logic, share snapshots, timeline events, and LLM provider access so API keys never reach the browser.

**Tech Stack:** npm workspaces, Vite, React, TypeScript, React Router, lucide-react, Express, Vitest, Supertest, JSON file storage, dotenv, OpenAI-compatible chat completions.

---

## Source Notes

The requested source file name was `SPCE.md`; the workspace contains `SPEC.md`, so this plan treats `SPEC.md` as the authoritative spec.

## File Structure Map

Create this project inside the current workspace root `D:\AI4HCI_PROJECT`.

```text
D:\AI4HCI_PROJECT\
  SPEC.md
  PLAN.md
  .gitignore
  .env.example
  package.json
  README.md
  shared\
    types.ts
  server\
    package.json
    tsconfig.json
    vitest.config.ts
    src\
      app.ts
      index.ts
      config.ts
      routes\
        cards.ts
        context.ts
        generate.ts
        recommend.ts
        share.ts
        timeline.ts
      services\
        cards.ts
        promptBuilder.ts
        recommend.ts
        share.ts
        store.ts
        suggestion.ts
        llm\
          mockFallback.ts
          openaiCompatible.ts
          types.ts
      data\
        seedCards.json
        db.json
    tests\
      api.test.ts
      generate.test.ts
      promptBuilder.test.ts
      recommend.test.ts
      share.test.ts
      store.test.ts
  client\
    package.json
    tsconfig.json
    tsconfig.node.json
    vite.config.ts
    index.html
    src\
      main.tsx
      App.tsx
      api\
        client.ts
      components\
        FieldPicker.tsx
        PrivacyBadge.tsx
        SkillCardTile.tsx
        TopNav.tsx
      pages\
        CardDetail.tsx
        Dashboard.tsx
        Settings.tsx
        SharePreview.tsx
        TaskComposer.tsx
        Timeline.tsx
      styles\
        app.css
      test\
        setup.ts
      App.test.tsx
```

Responsibilities:

- `shared/types.ts`: shared domain contracts used by both server and client.
- `server/src/services/store.ts`: atomic JSON read/write helper and seed initialization.
- `server/src/services/cards.ts`: card CRUD plus usage and timeline updates.
- `server/src/services/promptBuilder.ts`: deterministic conversion from selected cards into model context.
- `server/src/services/recommend.ts`: keyword and tag scoring for card recommendations.
- `server/src/services/share.ts`: immutable share snapshots, import, and fork behavior.
- `server/src/services/llm/*`: provider-neutral adapter contract, OpenAI-compatible adapter, and clearly labeled mock fallback.
- `server/src/routes/*`: Express route handlers that keep API wiring separate from business logic.
- `client/src/api/client.ts`: typed browser API wrapper.
- `client/src/pages/*`: route-level screens matching the spec information architecture.
- `client/src/components/*`: small reusable UI pieces for cards, privacy, navigation, and field selection.

---

### Task 1: Workspace Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/tsconfig.node.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`

- [ ] **Step 1: Create root workspace metadata**

Create `package.json`:

```json
{
  "name": "ai-skill-passport-local-demo",
  "private": true,
  "version": "0.1.0",
  "workspaces": [
    "client",
    "server"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace server\" \"npm run dev --workspace client\"",
    "build": "npm run build --workspace server && npm run build --workspace client",
    "test": "npm run test --workspace server && npm run test --workspace client",
    "typecheck": "npm run typecheck --workspace server && npm run typecheck --workspace client"
  },
  "devDependencies": {
    "concurrently": "^9.2.0"
  }
}
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.local
env.txt
npm-debug.log*
server/src/data/db.json.tmp
coverage/
```

Create `.env.example`:

```bash
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=
LLM_TIMEOUT_MS=30000
LLM_MOCK_FALLBACK=true
```

- [ ] **Step 2: Create server package and TypeScript config**

Create `server/package.json`:

```json
{
  "name": "@ai-skill-passport/server",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.7",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vitest": "^2.1.8"
  }
}
```

Create `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "..",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": [
      "node"
    ]
  },
  "include": [
    "src/**/*.ts",
    "tests/**/*.ts",
    "../shared/**/*.ts"
  ]
}
```

Create `server/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 10000
  }
});
```

- [ ] **Step 3: Create client package and Vite config**

Create `client/package.json`:

```json
{
  "name": "@ai-skill-passport/client",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5173",
    "build": "tsc -p tsconfig.json && vite build",
    "preview": "vite preview --host 127.0.0.1 --port 5173",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.3",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

Create `client/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": [
      "DOM",
      "DOM.Iterable",
      "ES2020"
    ],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@shared/*": [
        "../shared/*"
      ]
    }
  },
  "include": [
    "src",
    "../shared"
  ],
  "references": [
    {
      "path": "./tsconfig.node.json"
    }
  ]
}
```

Create `client/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": [
    "vite.config.ts"
  ]
}
```

Create `client/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared")
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true
  }
});
```

Create `client/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Skill Passport Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: npm creates `package-lock.json` and installs both workspaces without dependency resolution errors.

- [ ] **Step 5: Commit scaffold**

Run:

```bash
git add package.json package-lock.json .gitignore .env.example server/package.json server/tsconfig.json server/vitest.config.ts client/package.json client/tsconfig.json client/tsconfig.node.json client/vite.config.ts client/index.html
git commit -m "chore: scaffold local demo workspace"
```

Expected: one commit containing only scaffold and configuration files.

---

### Task 2: Shared Types And Seed Cards

**Files:**
- Create: `shared/types.ts`
- Create: `server/src/data/seedCards.json`
- Create: `server/src/data/db.json`

- [ ] **Step 1: Create shared domain types**

Create `shared/types.ts`:

```ts
export type PrivacyLevel = "private" | "link" | "team" | "public";

export type SkillField = "tone" | "structure" | "styleRules" | "constraints" | "examples";

export type SkillCard = {
  id: string;
  name: string;
  description: string;
  scenarios: string[];
  tone: string[];
  structure: string[];
  styleRules: string[];
  constraints: string[];
  examples: string[];
  tags: string[];
  privacy: PrivacyLevel;
  compatibility: {
    chat: number;
    ppt: number;
    writing: number;
    coding: number;
  };
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
};

export type SelectedCard = {
  cardId: string;
  mode: "all" | "partial" | "temporary";
  selectedFields: SkillField[];
};

export type AppliedCardSummary = {
  cardId: string;
  name: string;
  mode: SelectedCard["mode"];
  fields: SkillField[];
};

export type TaskSession = {
  id: string;
  userTask: string;
  selectedCards: SelectedCard[];
  generatedContext: string;
  modelProvider: string;
  modelName: string;
  output: string;
  status: "draft" | "generating" | "completed" | "failed";
  usedFallback: boolean;
  suggestedCard?: SuggestedCard;
  createdAt: string;
};

export type SuggestedCard = {
  name: string;
  description: string;
  scenarios: string[];
  tone: string[];
  structure: string[];
  styleRules: string[];
  constraints: string[];
  examples: string[];
  tags: string[];
  privacy: PrivacyLevel;
};

export type ShareLink = {
  id: string;
  cardId: string;
  snapshot: SkillCard;
  createdAt: string;
  expiresAt?: string;
  importCount: number;
};

export type MemoryEvent = {
  id: string;
  type: "created" | "used" | "updated" | "shared" | "imported" | "suggested";
  cardId?: string;
  taskSessionId?: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type DatabaseShape = {
  cards: SkillCard[];
  shares: ShareLink[];
  sessions: TaskSession[];
  timeline: MemoryEvent[];
};

export type ContextPreviewResponse = {
  context: string;
  appliedCards: AppliedCardSummary[];
};

export type Recommendation = {
  card: SkillCard;
  score: number;
  reasons: string[];
};

export type GenerateResponse = {
  sessionId: string;
  context: string;
  output: string;
  provider: string;
  model: string;
  usedFallback: boolean;
  suggestedCard: SuggestedCard;
};
```

- [ ] **Step 2: Create seeded Skill Cards**

Create `server/src/data/seedCards.json`:

```json
[
  {
    "id": "classroom-presentation",
    "name": "Classroom Presentation",
    "description": "Builds clear HCI or course presentation outlines with a formal but natural classroom tone.",
    "scenarios": ["PPT", "course presentation", "HCI report", "课堂汇报", "项目展示"],
    "tone": ["formal but not stiff", "自然、清晰、有课堂感"],
    "structure": ["background", "problem", "concept", "interaction flow", "value", "summary"],
    "styleRules": ["one key idea per slide", "visible hierarchy", "avoid long paragraphs", "use process and card-based explanations"],
    "constraints": ["avoid empty slogans", "make every slide understandable to a course audience"],
    "examples": ["8-slide HCI project outline", "problem-solution-value presentation flow"],
    "tags": ["ppt", "presentation", "hci", "course", "课堂", "展示"],
    "privacy": "private",
    "compatibility": {
      "chat": 84,
      "ppt": 98,
      "writing": 72,
      "coding": 20
    },
    "usageCount": 3,
    "createdAt": "2026-06-12T09:00:00.000Z",
    "updatedAt": "2026-06-12T09:00:00.000Z",
    "lastUsedAt": "2026-06-12T10:00:00.000Z"
  },
  {
    "id": "defense-presentation",
    "name": "Defense Presentation",
    "description": "Shapes research defense content around evidence, method, contribution, and limitations.",
    "scenarios": ["thesis defense", "research presentation", "project defense", "答辩"],
    "tone": ["confident", "evidence-led", "calm under questioning"],
    "structure": ["research question", "method", "result", "contribution", "limitation"],
    "styleRules": ["emphasize problem-solution logic", "show evidence before claims", "use diagrams for method and results"],
    "constraints": ["do not overclaim", "make limitations explicit"],
    "examples": ["defense script outline", "research contribution summary"],
    "tags": ["defense", "research", "method", "evidence", "答辩"],
    "privacy": "private",
    "compatibility": {
      "chat": 76,
      "ppt": 92,
      "writing": 80,
      "coding": 18
    },
    "usageCount": 1,
    "createdAt": "2026-06-12T09:05:00.000Z",
    "updatedAt": "2026-06-12T09:05:00.000Z"
  },
  {
    "id": "formal-chinese-email",
    "name": "Formal Chinese Email",
    "description": "Creates concise, respectful Chinese emails with clear purpose and next action.",
    "scenarios": ["email", "teacher message", "work request", "中文邮件"],
    "tone": ["polite", "concise", "respectful"],
    "structure": ["greeting", "purpose", "key points", "request", "closing"],
    "styleRules": ["state the request early", "avoid over-explaining", "keep the closing warm but brief"],
    "constraints": ["do not sound pushy", "do not add private personal details"],
    "examples": ["email to an instructor", "formal request for feedback"],
    "tags": ["email", "writing", "chinese", "中文", "礼貌"],
    "privacy": "private",
    "compatibility": {
      "chat": 88,
      "ppt": 20,
      "writing": 96,
      "coding": 10
    },
    "usageCount": 5,
    "createdAt": "2026-06-12T09:10:00.000Z",
    "updatedAt": "2026-06-12T09:10:00.000Z",
    "lastUsedAt": "2026-06-12T11:00:00.000Z"
  },
  {
    "id": "minimal-visual-style",
    "name": "Minimal Visual Style",
    "description": "Keeps generated visual plans restrained, readable, and focused on hierarchy.",
    "scenarios": ["slides", "dashboard", "poster", "visual design", "极简视觉"],
    "tone": ["clean", "direct", "quiet confidence"],
    "structure": ["one idea per section", "clear scan path", "summary after details"],
    "styleRules": ["restrained colors", "clear spacing", "no dense decoration", "use hierarchy before ornament"],
    "constraints": ["avoid excessive decorative language", "keep each visual recommendation inspectable"],
    "examples": ["minimal slide style guide", "card-based dashboard layout"],
    "tags": ["minimal", "visual", "ppt", "design", "style", "极简"],
    "privacy": "link",
    "compatibility": {
      "chat": 62,
      "ppt": 94,
      "writing": 66,
      "coding": 24
    },
    "usageCount": 2,
    "createdAt": "2026-06-12T09:15:00.000Z",
    "updatedAt": "2026-06-12T09:15:00.000Z",
    "lastUsedAt": "2026-06-12T10:30:00.000Z"
  }
]
```

- [ ] **Step 3: Create initial database file**

Create `server/src/data/db.json`:

```json
{
  "cards": [],
  "shares": [],
  "sessions": [],
  "timeline": []
}
```

- [ ] **Step 4: Validate seed JSON after dependencies are installed**

Run:

```bash
node -e "const fs=require('node:fs'); const cards=JSON.parse(fs.readFileSync('server/src/data/seedCards.json','utf8')); if (cards.length !== 4) throw new Error('Expected four seed cards'); console.log(cards.map((card)=>card.id).join(','));"
```

Expected:

```text
classroom-presentation,defense-presentation,formal-chinese-email,minimal-visual-style
```

- [ ] **Step 5: Commit domain model and seed data**

Run:

```bash
git add shared/types.ts server/src/data/seedCards.json server/src/data/db.json
git commit -m "feat: add skill passport domain model"
```

Expected: one commit containing shared types and seed data.

---

### Task 3: JSON Store And Card Service

**Files:**
- Create: `server/tests/store.test.ts`
- Create: `server/src/services/store.ts`
- Create: `server/src/services/cards.ts`

- [ ] **Step 1: Write failing store tests**

Create `server/tests/store.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCardService } from "../src/services/cards.js";
import { createJsonStore } from "../src/services/store.js";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "skill-passport-store-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("json store and card service", () => {
  it("seeds cards when the database is empty", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });

    const db = await store.read();

    expect(db.cards.map((card) => card.id)).toContain("classroom-presentation");
    expect(db.shares).toEqual([]);
    expect(db.sessions).toEqual([]);
  });

  it("creates, updates, and deletes a local card copy", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const cards = createCardService(store);

    const created = await cards.create({
      name: "Demo Habit",
      description: "Reusable demo behavior.",
      scenarios: ["demo"],
      tone: ["clear"],
      structure: ["context", "answer"],
      styleRules: ["brief bullets"],
      constraints: ["keep user control visible"],
      examples: ["short demo output"],
      tags: ["demo"],
      privacy: "private",
      compatibility: { chat: 80, ppt: 50, writing: 60, coding: 10 }
    });

    const updated = await cards.update(created.id, { privacy: "link", usageCount: 4 });
    const removed = await cards.remove(created.id);
    const allCards = await cards.list();

    expect(created.id).toMatch(/^card_/);
    expect(updated.privacy).toBe("link");
    expect(updated.usageCount).toBe(4);
    expect(removed.id).toBe(created.id);
    expect(allCards.some((card) => card.id === created.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing store tests**

Run:

```bash
npm run test --workspace server -- store.test.ts
```

Expected: FAIL because `createJsonStore` and `createCardService` do not exist.

- [ ] **Step 3: Implement JSON store**

Create `server/src/services/store.ts`:

```ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DatabaseShape, SkillCard } from "../../../shared/types.js";

export type JsonStoreOptions = {
  dbPath: string;
  seedCardsPath: string;
};

export type JsonStore = {
  read(): Promise<DatabaseShape>;
  write(db: DatabaseShape): Promise<void>;
  update<T>(mutator: (db: DatabaseShape) => T | Promise<T>): Promise<T>;
};

const emptyDb = (): DatabaseShape => ({
  cards: [],
  shares: [],
  sessions: [],
  timeline: []
});

const parseJson = <T>(text: string): T => JSON.parse(text) as T;

export function createJsonStore(options: JsonStoreOptions): JsonStore {
  let writeQueue = Promise.resolve();

  const ensureSeeded = async (): Promise<DatabaseShape> => {
    await mkdir(path.dirname(options.dbPath), { recursive: true });

    let db: DatabaseShape;
    try {
      db = parseJson<DatabaseShape>(await readFile(options.dbPath, "utf8"));
    } catch {
      db = emptyDb();
    }

    if (db.cards.length === 0) {
      const seedCards = parseJson<SkillCard[]>(await readFile(options.seedCardsPath, "utf8"));
      db = {
        ...emptyDb(),
        ...db,
        cards: seedCards
      };
      await atomicWrite(options.dbPath, db);
    }

    return db;
  };

  return {
    read: ensureSeeded,
    async write(db) {
      await atomicWrite(options.dbPath, db);
    },
    async update(mutator) {
      const run = writeQueue.then(async () => {
        const db = await ensureSeeded();
        const result = await mutator(db);
        await atomicWrite(options.dbPath, db);
        return result;
      });
      writeQueue = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    }
  };
}

async function atomicWrite(dbPath: string, db: DatabaseShape): Promise<void> {
  const tmpPath = `${dbPath}.tmp`;
  await mkdir(path.dirname(dbPath), { recursive: true });
  await writeFile(tmpPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  await rename(tmpPath, dbPath);
}
```

- [ ] **Step 4: Implement card service**

Create `server/src/services/cards.ts`:

```ts
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
        db.timeline.unshift(event("created", "Created Skill Card", card.name, { cardId: card.id }));
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
        db.timeline.unshift(event("updated", "Updated Skill Card", card.name, { cardId: id }));
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
        db.timeline.unshift(event("used", "Used Skill Card", card.name, { cardId: id }));
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
```

- [ ] **Step 5: Run store tests again**

Run:

```bash
npm run test --workspace server -- store.test.ts
```

Expected: PASS for both store and card service tests.

- [ ] **Step 6: Commit store and card service**

Run:

```bash
git add server/tests/store.test.ts server/src/services/store.ts server/src/services/cards.ts
git commit -m "feat: add json store and card service"
```

Expected: one commit with tested persistence and card CRUD behavior.

---

### Task 4: Prompt Builder And Context Preview

**Files:**
- Create: `server/tests/promptBuilder.test.ts`
- Create: `server/src/services/promptBuilder.ts`

- [ ] **Step 1: Write failing prompt builder tests**

Create `server/tests/promptBuilder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SkillCard } from "../../shared/types.js";
import { buildContextPreview } from "../src/services/promptBuilder.js";

const card: SkillCard = {
  id: "classroom-presentation",
  name: "Classroom Presentation",
  description: "Course presentation habits.",
  scenarios: ["HCI report"],
  tone: ["formal but natural"],
  structure: ["background", "problem", "solution"],
  styleRules: ["one key idea per slide"],
  constraints: ["avoid slogans"],
  examples: ["8-slide outline"],
  tags: ["ppt", "hci"],
  privacy: "private",
  compatibility: { chat: 80, ppt: 98, writing: 70, coding: 10 },
  usageCount: 0,
  createdAt: "2026-06-12T09:00:00.000Z",
  updatedAt: "2026-06-12T09:00:00.000Z"
};

describe("buildContextPreview", () => {
  it("includes every controlled field for all mode", () => {
    const result = buildContextPreview("Make an HCI PPT", [card], [
      { cardId: card.id, mode: "all", selectedFields: [] }
    ]);

    expect(result.appliedCards[0].fields).toEqual(["tone", "structure", "styleRules", "constraints", "examples"]);
    expect(result.context).toContain("[Skill Card: Classroom Presentation]");
    expect(result.context).toContain("Tone: formal but natural");
    expect(result.context).toContain("Structure: background -> problem -> solution");
    expect(result.context).toContain("Constraints: avoid slogans");
  });

  it("includes only selected fields for partial mode", () => {
    const result = buildContextPreview("Make an HCI PPT", [card], [
      { cardId: card.id, mode: "partial", selectedFields: ["styleRules"] }
    ]);

    expect(result.appliedCards[0].fields).toEqual(["styleRules"]);
    expect(result.context).toContain("Style rules: one key idea per slide");
    expect(result.context).not.toContain("Tone: formal but natural");
    expect(result.context).not.toContain("Structure: background");
  });

  it("excludes selected card ids that are absent from the library", () => {
    const result = buildContextPreview("Make an HCI PPT", [card], [
      { cardId: "missing-card", mode: "all", selectedFields: [] }
    ]);

    expect(result.appliedCards).toEqual([]);
    expect(result.context).toContain("No Skill Cards were applied.");
  });
});
```

- [ ] **Step 2: Run failing prompt builder tests**

Run:

```bash
npm run test --workspace server -- promptBuilder.test.ts
```

Expected: FAIL because `buildContextPreview` does not exist.

- [ ] **Step 3: Implement prompt builder**

Create `server/src/services/promptBuilder.ts`:

```ts
import type { AppliedCardSummary, ContextPreviewResponse, SelectedCard, SkillCard, SkillField } from "../../../shared/types.js";

const allFields: SkillField[] = ["tone", "structure", "styleRules", "constraints", "examples"];

const labels: Record<SkillField, string> = {
  tone: "Tone",
  structure: "Structure",
  styleRules: "Style rules",
  constraints: "Constraints",
  examples: "Examples"
};

export function buildContextPreview(task: string, cards: SkillCard[], selectedCards: SelectedCard[]): ContextPreviewResponse {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const appliedCards: AppliedCardSummary[] = [];
  const blocks: string[] = [];

  for (const selection of selectedCards) {
    const card = cardById.get(selection.cardId);
    if (!card) {
      continue;
    }

    const fields = fieldsForSelection(selection);
    appliedCards.push({
      cardId: card.id,
      name: card.name,
      mode: selection.mode,
      fields
    });

    const lines = [
      `[Skill Card: ${card.name}]`,
      `Apply mode: ${selection.mode}`,
      `Scenarios: ${card.scenarios.join(", ")}`
    ];

    for (const field of fields) {
      const values = card[field];
      if (values.length > 0) {
        lines.push(`${labels[field]}: ${joinField(field, values)}`);
      }
    }

    blocks.push(lines.join("\n"));
  }

  const body = blocks.length > 0 ? blocks.join("\n\n") : "No Skill Cards were applied.";

  return {
    appliedCards,
    context: [
      "User-selected AI work habits:",
      body,
      "",
      "Control rules:",
      "- The current task overrides long-term habits when they conflict.",
      "- Partial mode includes only the fields listed in the selection.",
      "- Temporary mode applies only to this generation and does not save a new habit automatically.",
      "- A suggested habit requires explicit user confirmation before it is saved.",
      "",
      "Current user task:",
      task
    ].join("\n")
  };
}

function fieldsForSelection(selection: SelectedCard): SkillField[] {
  if (selection.mode === "all" || selection.mode === "temporary") {
    return allFields;
  }
  return allFields.filter((field) => selection.selectedFields.includes(field));
}

function joinField(field: SkillField, values: string[]): string {
  if (field === "structure") {
    return values.join(" -> ");
  }
  return values.join("; ");
}
```

- [ ] **Step 4: Run prompt builder tests again**

Run:

```bash
npm run test --workspace server -- promptBuilder.test.ts
```

Expected: PASS for all prompt builder tests.

- [ ] **Step 5: Commit prompt builder**

Run:

```bash
git add server/tests/promptBuilder.test.ts server/src/services/promptBuilder.ts
git commit -m "feat: build skill card context previews"
```

Expected: one commit with deterministic context generation.

---

### Task 5: Recommendation Service

**Files:**
- Create: `server/tests/recommend.test.ts`
- Create: `server/src/services/recommend.ts`

- [ ] **Step 1: Write failing recommendation tests**

Create `server/tests/recommend.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SkillCard } from "../../shared/types.js";
import { recommendCards } from "../src/services/recommend.js";

const demoTask = "帮我为 HCI 课程做一个 8 页项目展示 PPT 大纲，主题是 AI Skill Passport。";

describe("recommendCards", () => {
  it("ranks Classroom Presentation and Minimal Visual Style highest for the demo task", async () => {
    const cards = JSON.parse(await readFile(path.resolve("src/data/seedCards.json"), "utf8")) as SkillCard[];

    const result = recommendCards(demoTask, cards);

    expect(result.slice(0, 2).map((item) => item.card.id)).toEqual([
      "classroom-presentation",
      "minimal-visual-style"
    ]);
    expect(result[0].reasons.join(" ")).toContain("ppt");
    expect(result[0].score).toBeGreaterThan(result[2].score);
  });

  it("returns an empty list when there are no positive matches", () => {
    const result = recommendCards("calculate a checksum in Rust", []);

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run failing recommendation tests**

Run:

```bash
npm run test --workspace server -- recommend.test.ts
```

Expected: FAIL because `recommendCards` does not exist.

- [ ] **Step 3: Implement recommendation scoring**

Create `server/src/services/recommend.ts`:

```ts
import type { Recommendation, SkillCard } from "../../../shared/types.js";

const keywordMap: Record<string, string[]> = {
  ppt: ["ppt", "slides", "slide", "presentation", "展示", "汇报", "大纲", "演示"],
  hci: ["hci", "human-computer", "人机交互", "课程", "项目"],
  writing: ["email", "邮件", "写作", "message"],
  defense: ["defense", "答辩", "论文", "研究"],
  visual: ["visual", "style", "设计", "视觉", "极简", "版式"]
};

export function recommendCards(task: string, cards: SkillCard[]): Recommendation[] {
  const normalizedTask = task.toLowerCase();

  return cards
    .map((card) => {
      const reasons: string[] = [];
      let score = 0;

      for (const tag of card.tags) {
        if (normalizedTask.includes(tag.toLowerCase())) {
          score += 12;
          reasons.push(`Matched tag "${tag}"`);
        }
      }

      for (const [bucket, words] of Object.entries(keywordMap)) {
        const matched = words.filter((word) => normalizedTask.includes(word.toLowerCase()));
        if (matched.length === 0) {
          continue;
        }
        const cardText = searchableCardText(card);
        const cardMatchesBucket = cardText.includes(bucket) || words.some((word) => cardText.includes(word.toLowerCase()));
        if (cardMatchesBucket) {
          score += matched.length * 8;
          reasons.push(`Matched ${bucket} keyword: ${matched.join(", ")}`);
        }
      }

      if (normalizedTask.includes("ppt")) {
        score += Math.round(card.compatibility.ppt / 10);
        reasons.push(`PPT compatibility ${card.compatibility.ppt}`);
      }

      if (normalizedTask.includes("hci") && card.tags.includes("hci")) {
        score += 18;
        reasons.push("HCI task fit");
      }

      if ((normalizedTask.includes("展示") || normalizedTask.includes("presentation")) && card.scenarios.join(" ").toLowerCase().includes("presentation")) {
        score += 10;
        reasons.push("Presentation scenario fit");
      }

      return { card, score, reasons };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.card.compatibility.ppt - a.card.compatibility.ppt || a.card.name.localeCompare(b.card.name));
}

function searchableCardText(card: SkillCard): string {
  return [
    card.name,
    card.description,
    card.scenarios.join(" "),
    card.tone.join(" "),
    card.structure.join(" "),
    card.styleRules.join(" "),
    card.tags.join(" ")
  ].join(" ").toLowerCase();
}
```

- [ ] **Step 4: Run recommendation tests again**

Run:

```bash
npm run test --workspace server -- recommend.test.ts
```

Expected: PASS and the first two recommendations are `classroom-presentation`, then `minimal-visual-style`.

- [ ] **Step 5: Commit recommendation service**

Run:

```bash
git add server/tests/recommend.test.ts server/src/services/recommend.ts
git commit -m "feat: recommend skill cards from task text"
```

Expected: one commit with deterministic recommendations.

---

### Task 6: Share, Import, Fork, And Timeline Services

**Files:**
- Create: `server/tests/share.test.ts`
- Create: `server/src/services/share.ts`

- [ ] **Step 1: Write failing share tests**

Create `server/tests/share.test.ts`:

```ts
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
    const preview = await service.get(share.shareId);

    expect(share.url).toBe("http://localhost:5173/share/" + share.shareId);
    expect(preview?.snapshot.id).toBe("classroom-presentation");
    expect(preview?.snapshot.name).toBe("Classroom Presentation");
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
    expect(imported.name).toBe("Minimal Visual Style");
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
```

- [ ] **Step 2: Run failing share tests**

Run:

```bash
npm run test --workspace server -- share.test.ts
```

Expected: FAIL because `createShareService` does not exist.

- [ ] **Step 3: Implement share service**

Create `server/src/services/share.ts`:

```ts
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
        db.timeline.unshift(event("shared", "Created share link", card.name, { cardId }));
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

async function copyFromShare(store: JsonStore, shareId: string, idPrefix: "imported_" | "fork_", patch: CardPatch): Promise<SkillCard> {
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
    db.timeline.unshift(event("imported", idPrefix === "fork_" ? "Forked shared Skill Card" : "Imported shared Skill Card", copied.name, { cardId: copied.id }));
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
```

- [ ] **Step 4: Run share tests again**

Run:

```bash
npm run test --workspace server -- share.test.ts
```

Expected: PASS for snapshot, import, and fork behavior.

- [ ] **Step 5: Commit share service**

Run:

```bash
git add server/tests/share.test.ts server/src/services/share.ts
git commit -m "feat: add share import and fork service"
```

Expected: one commit with share snapshot behavior.

---

### Task 7: LLM Adapter And Generation Service

**Files:**
- Create: `server/tests/generate.test.ts`
- Create: `server/src/config.ts`
- Create: `server/src/services/llm/types.ts`
- Create: `server/src/services/llm/openaiCompatible.ts`
- Create: `server/src/services/llm/mockFallback.ts`
- Create: `server/src/services/suggestion.ts`
- Create: `server/src/services/generate.ts`

- [ ] **Step 1: Write failing generation tests**

Create `server/tests/generate.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmAdapter } from "../src/services/llm/types.js";
import { generateTaskResponse } from "../src/services/generate.js";
import { createJsonStore } from "../src/services/store.js";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "skill-passport-generate-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("generateTaskResponse", () => {
  it("calls the injected LLM adapter with selected card context", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const adapter: LlmAdapter = {
      generate: vi.fn(async () => ({
        text: "Real model outline using classroom presentation habits.",
        provider: "openai-compatible",
        model: "demo-model",
        raw: { ok: true }
      }))
    };

    const result = await generateTaskResponse(
      {
        task: "帮我为 HCI 课程做一个 8 页项目展示 PPT 大纲，主题是 AI Skill Passport。",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      },
      {
        store,
        adapter,
        config: {
          provider: "openai-compatible",
          baseUrl: "https://api.example.com/v1",
          apiKey: "secret",
          model: "demo-model",
          timeoutMs: 30000,
          mockFallback: false
        }
      }
    );

    expect(adapter.generate).toHaveBeenCalledTimes(1);
    expect(vi.mocked(adapter.generate).mock.calls[0][0].messages[1].content).toContain("Classroom Presentation");
    expect(result.usedFallback).toBe(false);
    expect(result.suggestedCard.name).toBe("HCI Project Demo Outline");
  });

  it("returns clearly marked fallback only when fallback is enabled", async () => {
    const store = createJsonStore({
      dbPath: path.join(tempDir, "db.json"),
      seedCardsPath: path.resolve("src/data/seedCards.json")
    });
    const adapter: LlmAdapter = {
      generate: vi.fn(async () => {
        throw new Error("provider unavailable");
      })
    };

    const result = await generateTaskResponse(
      {
        task: "Make an HCI PPT outline",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      },
      {
        store,
        adapter,
        config: {
          provider: "openai-compatible",
          baseUrl: "https://api.example.com/v1",
          apiKey: "secret",
          model: "demo-model",
          timeoutMs: 30000,
          mockFallback: true
        }
      }
    );

    expect(result.usedFallback).toBe(true);
    expect(result.output).toContain("[Fallback content]");
  });
});
```

- [ ] **Step 2: Run failing generation tests**

Run:

```bash
npm run test --workspace server -- generate.test.ts
```

Expected: FAIL because generation modules do not exist.

- [ ] **Step 3: Add server configuration loader**

Create `server/src/config.ts`:

```ts
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
dotenv.config();

export type LlmConfig = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  mockFallback: boolean;
};

export function loadLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  return {
    provider: env.LLM_PROVIDER || "openai-compatible",
    baseUrl: env.LLM_BASE_URL || "https://api.openai.com/v1",
    apiKey: env.LLM_API_KEY || "",
    model: env.LLM_MODEL || "",
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 30000),
    mockFallback: env.LLM_MOCK_FALLBACK !== "false"
  };
}
```

- [ ] **Step 4: Add LLM adapter contracts**

Create `server/src/services/llm/types.ts`:

```ts
export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmGenerateInput = {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type LlmGenerateResult = {
  text: string;
  provider: string;
  model: string;
  raw?: unknown;
};

export type LlmAdapter = {
  generate(input: LlmGenerateInput): Promise<LlmGenerateResult>;
};
```

- [ ] **Step 5: Implement OpenAI-compatible adapter**

Create `server/src/services/llm/openaiCompatible.ts`:

```ts
import type { LlmConfig } from "../../config.js";
import type { LlmAdapter, LlmGenerateInput, LlmGenerateResult } from "./types.js";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export function createOpenAiCompatibleAdapter(config: LlmConfig): LlmAdapter {
  return {
    async generate(input: LlmGenerateInput): Promise<LlmGenerateResult> {
      if (!config.apiKey || !config.model) {
        throw new Error("LLM_API_KEY and LLM_MODEL are required for real generation.");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: config.model,
            messages: input.messages,
            temperature: input.temperature ?? 0.4,
            max_tokens: input.maxTokens ?? 1200
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`LLM provider returned ${response.status}: ${body.slice(0, 300)}`);
        }

        const raw = (await response.json()) as ChatCompletionResponse;
        const text = raw.choices?.[0]?.message?.content?.trim();
        if (!text) {
          throw new Error("LLM provider returned an empty response.");
        }

        return {
          text,
          provider: config.provider,
          model: config.model,
          raw
        };
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
```

- [ ] **Step 6: Implement fallback and deterministic suggestion**

Create `server/src/services/llm/mockFallback.ts`:

```ts
import type { LlmAdapter, LlmGenerateInput, LlmGenerateResult } from "./types.js";

export function createMockFallbackAdapter(model = "mock-fallback"): LlmAdapter {
  return {
    async generate(input: LlmGenerateInput): Promise<LlmGenerateResult> {
      const task = input.messages.at(-1)?.content ?? "the requested task";
      return {
        text: [
          "[Fallback content] This response was generated locally because the real LLM provider was unavailable or not configured.",
          "",
          "1. Title: AI Skill Passport",
          "2. Background: Users repeat collaboration preferences across AI tasks.",
          "3. Problem: Habits stay hidden inside old prompts and are hard to reuse.",
          "4. Concept: Skill Cards turn reusable habits into editable, selectable objects.",
          "5. Flow: Create cards, receive recommendations, select full or partial use, preview context, generate with the model.",
          "6. HCI Value: User control, transparency, privacy, and transferable routines.",
          "7. Sharing: Snapshot links allow preview, import, and fork without exposing the original private card.",
          "8. Summary: The demo proves that visible habits can shape model output while keeping users in control.",
          "",
          `Original task: ${task}`
        ].join("\n"),
        provider: "mock",
        model
      };
    }
  };
}
```

Create `server/src/services/suggestion.ts`:

```ts
import type { SkillCard, SuggestedCard } from "../../../shared/types.js";

export function suggestHabitFromTask(task: string, selectedCards: SkillCard[]): SuggestedCard {
  const isHciPpt = task.toLowerCase().includes("hci") || task.includes("项目展示") || task.toLowerCase().includes("ppt");
  const sourceNames = selectedCards.map((card) => card.name).join(", ");

  return {
    name: isHciPpt ? "HCI Project Demo Outline" : "Reusable Task Outline",
    description: sourceNames
      ? `Reusable habit distilled from this task and selected cards: ${sourceNames}.`
      : "Reusable habit distilled from the completed task.",
    scenarios: isHciPpt ? ["HCI project presentation", "course demo", "PPT outline"] : ["AI task planning", "structured output"],
    tone: ["formal but natural", "clear and user-controlled"],
    structure: isHciPpt
      ? ["background", "problem", "concept", "interaction flow", "HCI value", "sharing and import", "summary"]
      : ["context", "task", "structured answer", "next step"],
    styleRules: ["make selected habits visible", "keep each section concise", "avoid dense paragraphs"],
    constraints: ["do not save automatically without user confirmation", "show how user control affects the output"],
    examples: [task],
    tags: isHciPpt ? ["hci", "ppt", "demo", "outline"] : ["task", "outline", "habit"],
    privacy: "private"
  };
}
```

- [ ] **Step 7: Implement generation orchestration**

Create `server/src/services/generate.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { GenerateResponse, MemoryEvent, SelectedCard, TaskSession } from "../../../shared/types.js";
import type { LlmConfig } from "../config.js";
import { buildContextPreview } from "./promptBuilder.js";
import { suggestHabitFromTask } from "./suggestion.js";
import { createMockFallbackAdapter } from "./llm/mockFallback.js";
import type { LlmAdapter } from "./llm/types.js";
import type { JsonStore } from "./store.js";

export type GenerateInput = {
  task: string;
  selectedCards: SelectedCard[];
};

export type GenerateDeps = {
  store: JsonStore;
  adapter: LlmAdapter;
  config: LlmConfig;
};

const systemMessage = [
  "You are the task assistant inside the AI Skill Passport demo.",
  "Your goal is not only to answer the user. You must visibly apply the Skill Cards selected by the user.",
  "If a long-term habit conflicts with the current task, the current task wins.",
  "The output should reflect the selected tone, structure, style rules, and constraints."
].join("\n");

export async function generateTaskResponse(input: GenerateInput, deps: GenerateDeps): Promise<GenerateResponse> {
  const db = await deps.store.read();
  const preview = buildContextPreview(input.task, db.cards, input.selectedCards);
  const selectedCardRecords = input.selectedCards
    .map((selection) => db.cards.find((card) => card.id === selection.cardId))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));

  const messages = [
    { role: "system" as const, content: systemMessage },
    { role: "user" as const, content: preview.context }
  ];

  let usedFallback = false;
  let provider = deps.config.provider;
  let model = deps.config.model;
  let output: string;

  try {
    if (!deps.config.apiKey || !deps.config.model) {
      throw new Error("LLM configuration is missing.");
    }
    const result = await deps.adapter.generate({ messages, temperature: 0.4, maxTokens: 1200 });
    output = result.text;
    provider = result.provider;
    model = result.model;
  } catch (error) {
    if (!deps.config.mockFallback) {
      throw error;
    }
    usedFallback = true;
    const fallback = await createMockFallbackAdapter().generate({ messages, temperature: 0.4, maxTokens: 1200 });
    output = fallback.text;
    provider = fallback.provider;
    model = fallback.model;
  }

  const suggestedCard = suggestHabitFromTask(input.task, selectedCardRecords);
  const sessionId = `session_${randomUUID()}`;

  await deps.store.update((writeDb) => {
    const session: TaskSession = {
      id: sessionId,
      userTask: input.task,
      selectedCards: input.selectedCards,
      generatedContext: preview.context,
      modelProvider: provider,
      modelName: model,
      output,
      status: "completed",
      usedFallback,
      suggestedCard,
      createdAt: new Date().toISOString()
    };
    writeDb.sessions.unshift(session);

    for (const selection of input.selectedCards) {
      if (selection.mode !== "temporary") {
        const card = writeDb.cards.find((item) => item.id === selection.cardId);
        if (card) {
          card.usageCount += 1;
          card.lastUsedAt = session.createdAt;
          card.updatedAt = session.createdAt;
        }
      }
    }

    writeDb.timeline.unshift(event("suggested", "Suggested new Skill Card", suggestedCard.name, { taskSessionId: sessionId }));
  });

  return {
    sessionId,
    context: preview.context,
    output,
    provider,
    model,
    usedFallback,
    suggestedCard
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
```

- [ ] **Step 8: Run generation tests again**

Run:

```bash
npm run test --workspace server -- generate.test.ts
```

Expected: PASS for real adapter injection and explicit fallback behavior.

- [ ] **Step 9: Commit generation service**

Run:

```bash
git add server/tests/generate.test.ts server/src/config.ts server/src/services/llm/types.ts server/src/services/llm/openaiCompatible.ts server/src/services/llm/mockFallback.ts server/src/services/suggestion.ts server/src/services/generate.ts
git commit -m "feat: add llm generation service"
```

Expected: one commit with provider adapter and fallback generation.

---

### Task 8: Express API Routes

**Files:**
- Create: `server/tests/api.test.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Create: `server/src/routes/cards.ts`
- Create: `server/src/routes/context.ts`
- Create: `server/src/routes/generate.ts`
- Create: `server/src/routes/recommend.ts`
- Create: `server/src/routes/share.ts`
- Create: `server/src/routes/timeline.ts`

- [ ] **Step 1: Write failing API tests**

Create `server/tests/api.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadLlmConfig } from "../src/config.js";
import { createMockFallbackAdapter } from "../src/services/llm/mockFallback.js";
import { createJsonStore } from "../src/services/store.js";

let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "skill-passport-api-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("api routes", () => {
  it("returns seed cards", async () => {
    const app = makeTestApp();

    const response = await request(app).get("/api/cards").expect(200);

    expect(response.body[0].id).toBe("classroom-presentation");
  });

  it("returns context preview without calling an LLM", async () => {
    const app = makeTestApp();

    const response = await request(app)
      .post("/api/context/preview")
      .send({
        task: "Make an HCI PPT",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      })
      .expect(200);

    expect(response.body.context).toContain("Classroom Presentation");
    expect(response.body.appliedCards[0].fields).toContain("tone");
  });

  it("creates a share snapshot and imports it", async () => {
    const app = makeTestApp();

    const share = await request(app).post("/api/share").send({ cardId: "classroom-presentation" }).expect(200);
    const imported = await request(app).post(`/api/share/${share.body.shareId}/import`).send({}).expect(200);

    expect(share.body.url).toContain("/share/");
    expect(imported.body.id).toMatch(/^imported_/);
  });

  it("generates fallback output through the API in demo mode", async () => {
    const app = makeTestApp();

    const response = await request(app)
      .post("/api/generate")
      .send({
        task: "Make an HCI PPT outline",
        selectedCards: [{ cardId: "classroom-presentation", mode: "all", selectedFields: [] }]
      })
      .expect(200);

    expect(response.body.usedFallback).toBe(true);
    expect(response.body.suggestedCard.name).toBe("HCI Project Demo Outline");
  });
});

function makeTestApp() {
  const store = createJsonStore({
    dbPath: path.join(tempDir, "db.json"),
    seedCardsPath: path.resolve("src/data/seedCards.json")
  });

  return createApp({
    store,
    adapter: createMockFallbackAdapter(),
    config: {
      ...loadLlmConfig({}),
      mockFallback: true
    },
    clientOrigin: "http://localhost:5173"
  });
}
```

- [ ] **Step 2: Run failing API tests**

Run:

```bash
npm run test --workspace server -- api.test.ts
```

Expected: FAIL because `createApp` and route modules do not exist.

- [ ] **Step 3: Implement route modules**

Create `server/src/routes/cards.ts`:

```ts
import { Router } from "express";
import { createCardService } from "../services/cards.js";
import type { JsonStore } from "../services/store.js";

export function cardsRouter(store: JsonStore): Router {
  const router = Router();
  const cards = createCardService(store);

  router.get("/", async (_request, response) => {
    response.json(await cards.list());
  });

  router.get("/:id", async (request, response) => {
    const card = await cards.get(request.params.id);
    if (!card) {
      response.status(404).json({ error: "Skill Card not found." });
      return;
    }
    response.json(card);
  });

  router.post("/", async (request, response) => {
    response.status(201).json(await cards.create(request.body));
  });

  router.patch("/:id", async (request, response) => {
    response.json(await cards.update(request.params.id, request.body));
  });

  router.delete("/:id", async (request, response) => {
    response.json(await cards.remove(request.params.id));
  });

  return router;
}
```

Create `server/src/routes/recommend.ts`:

```ts
import { Router } from "express";
import { recommendCards } from "../services/recommend.js";
import type { JsonStore } from "../services/store.js";

export function recommendRouter(store: JsonStore): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const db = await store.read();
    response.json(recommendCards(String(request.body.task || ""), db.cards));
  });

  return router;
}
```

Create `server/src/routes/context.ts`:

```ts
import { Router } from "express";
import { buildContextPreview } from "../services/promptBuilder.js";
import type { JsonStore } from "../services/store.js";

export function contextRouter(store: JsonStore): Router {
  const router = Router();

  router.post("/preview", async (request, response) => {
    const db = await store.read();
    response.json(buildContextPreview(String(request.body.task || ""), db.cards, request.body.selectedCards || []));
  });

  return router;
}
```

Create `server/src/routes/generate.ts`:

```ts
import { Router } from "express";
import type { LlmConfig } from "../config.js";
import { generateTaskResponse } from "../services/generate.js";
import type { LlmAdapter } from "../services/llm/types.js";
import type { JsonStore } from "../services/store.js";

export function generateRouter(store: JsonStore, adapter: LlmAdapter, config: LlmConfig): Router {
  const router = Router();

  router.post("/", async (request, response) => {
    const result = await generateTaskResponse(
      {
        task: String(request.body.task || ""),
        selectedCards: request.body.selectedCards || []
      },
      { store, adapter, config }
    );
    response.json(result);
  });

  return router;
}
```

Create `server/src/routes/share.ts`:

```ts
import { Router } from "express";
import { createShareService } from "../services/share.js";
import type { JsonStore } from "../services/store.js";

export function shareRouter(store: JsonStore, clientOrigin: string): Router {
  const router = Router();
  const share = createShareService(store, clientOrigin);

  router.post("/", async (request, response) => {
    response.json(await share.create(String(request.body.cardId || "")));
  });

  router.get("/:shareId", async (request, response) => {
    const preview = await share.get(request.params.shareId);
    if (!preview) {
      response.status(404).json({ error: "Share link not found." });
      return;
    }
    response.json(preview);
  });

  router.post("/:shareId/import", async (request, response) => {
    response.status(201).json(await share.import(request.params.shareId));
  });

  router.post("/:shareId/fork", async (request, response) => {
    response.status(201).json(await share.fork(request.params.shareId, request.body || {}));
  });

  return router;
}
```

Create `server/src/routes/timeline.ts`:

```ts
import { Router } from "express";
import type { JsonStore } from "../services/store.js";

export function timelineRouter(store: JsonStore): Router {
  const router = Router();

  router.get("/", async (_request, response) => {
    const db = await store.read();
    response.json(db.timeline);
  });

  return router;
}
```

- [ ] **Step 4: Implement Express app and server entry**

Create `server/src/app.ts`:

```ts
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import type { LlmConfig } from "./config.js";
import { cardsRouter } from "./routes/cards.js";
import { contextRouter } from "./routes/context.js";
import { generateRouter } from "./routes/generate.js";
import { recommendRouter } from "./routes/recommend.js";
import { shareRouter } from "./routes/share.js";
import { timelineRouter } from "./routes/timeline.js";
import type { LlmAdapter } from "./services/llm/types.js";
import type { JsonStore } from "./services/store.js";

export type AppDeps = {
  store: JsonStore;
  adapter: LlmAdapter;
  config: LlmConfig;
  clientOrigin: string;
};

export function createApp(deps: AppDeps) {
  const app = express();

  app.use(cors({ origin: deps.clientOrigin }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      provider: deps.config.provider,
      modelConfigured: Boolean(deps.config.model),
      fallbackEnabled: deps.config.mockFallback
    });
  });

  app.use("/api/cards", cardsRouter(deps.store));
  app.use("/api/recommend", recommendRouter(deps.store));
  app.use("/api/context", contextRouter(deps.store));
  app.use("/api/generate", generateRouter(deps.store, deps.adapter, deps.config));
  app.use("/api/share", shareRouter(deps.store, deps.clientOrigin));
  app.use("/api/timeline", timelineRouter(deps.store));

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    response.status(400).json({ error: message });
  };
  app.use(errorHandler);

  return app;
}
```

Create `server/src/index.ts`:

```ts
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

const app = createApp({
  store,
  adapter: createOpenAiCompatibleAdapter(config),
  config,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
});

const port = Number(process.env.PORT || 8787);
app.listen(port, "127.0.0.1", () => {
  console.log(`AI Skill Passport API listening at http://127.0.0.1:${port}`);
});
```

- [ ] **Step 5: Run API tests again**

Run:

```bash
npm run test --workspace server -- api.test.ts
```

Expected: PASS for cards, context preview, share import, and fallback generation API checks.

- [ ] **Step 6: Run full server tests**

Run:

```bash
npm run test --workspace server
```

Expected: PASS for `api`, `generate`, `promptBuilder`, `recommend`, `share`, and `store` suites.

- [ ] **Step 7: Commit API routes**

Run:

```bash
git add server/tests/api.test.ts server/src/app.ts server/src/index.ts server/src/routes/cards.ts server/src/routes/context.ts server/src/routes/generate.ts server/src/routes/recommend.ts server/src/routes/share.ts server/src/routes/timeline.ts
git commit -m "feat: expose skill passport api"
```

Expected: one commit with working API endpoints.

---

### Task 9: Client App Shell And API Client

**Files:**
- Create: `client/src/test/setup.ts`
- Create: `client/src/api/client.ts`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/components/TopNav.tsx`
- Create: `client/src/styles/app.css`
- Create: `client/src/App.test.tsx`

- [ ] **Step 1: Write failing client smoke test**

Create `client/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `client/src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the local demo navigation", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: /Library/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Task/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Timeline/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing client test**

Run:

```bash
npm run test --workspace client -- App.test.tsx
```

Expected: FAIL because `client/src/App.tsx` does not exist.

- [ ] **Step 3: Create typed API wrapper**

Create `client/src/api/client.ts`:

```ts
import type {
  ContextPreviewResponse,
  GenerateResponse,
  MemoryEvent,
  Recommendation,
  SelectedCard,
  ShareLink,
  SkillCard,
  SuggestedCard
} from "@shared/types";

const apiBase = "/api";

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: response.statusText }))) as { error?: string };
    throw new Error(body.error || response.statusText);
  }

  return (await response.json()) as T;
}

export const api = {
  cards: () => requestJson<SkillCard[]>("/cards"),
  card: (id: string) => requestJson<SkillCard>(`/cards/${id}`),
  updateCard: (id: string, patch: Partial<SkillCard>) =>
    requestJson<SkillCard>(`/cards/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  createCard: (card: Omit<SuggestedCard, "privacy"> & Pick<SuggestedCard, "privacy">) =>
    requestJson<SkillCard>("/cards", { method: "POST", body: JSON.stringify({ ...card, compatibility: { chat: 70, ppt: 70, writing: 70, coding: 20 } }) }),
  recommend: (task: string) => requestJson<Recommendation[]>("/recommend", { method: "POST", body: JSON.stringify({ task }) }),
  preview: (task: string, selectedCards: SelectedCard[]) =>
    requestJson<ContextPreviewResponse>("/context/preview", { method: "POST", body: JSON.stringify({ task, selectedCards }) }),
  generate: (task: string, selectedCards: SelectedCard[]) =>
    requestJson<GenerateResponse>("/generate", { method: "POST", body: JSON.stringify({ task, selectedCards }) }),
  share: (cardId: string) => requestJson<{ shareId: string; url: string }>("/share", { method: "POST", body: JSON.stringify({ cardId }) }),
  sharePreview: (shareId: string) => requestJson<ShareLink>(`/share/${shareId}`),
  importShare: (shareId: string) => requestJson<SkillCard>(`/share/${shareId}/import`, { method: "POST", body: JSON.stringify({}) }),
  forkShare: (shareId: string, patch: Partial<SkillCard>) =>
    requestJson<SkillCard>(`/share/${shareId}/fork`, { method: "POST", body: JSON.stringify(patch) }),
  timeline: () => requestJson<MemoryEvent[]>("/timeline"),
  health: () => requestJson<{ ok: boolean; provider: string; modelConfigured: boolean; fallbackEnabled: boolean }>("/health")
};
```

- [ ] **Step 4: Create app routes and top navigation**

Create `client/src/components/TopNav.tsx`:

```tsx
import { Library, ListChecks, Settings, Share2, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Library", icon: Library },
  { to: "/task", label: "Task", icon: Sparkles },
  { to: "/timeline", label: "Timeline", icon: ListChecks },
  { to: "/settings", label: "Settings", icon: Settings }
];

export function TopNav() {
  return (
    <header className="top-nav">
      <NavLink to="/" className="brand" aria-label="AI Skill Passport home">
        <Share2 size={22} />
        <span>AI Skill Passport</span>
      </NavLink>
      <nav aria-label="Primary">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
```

Create `client/src/App.tsx`:

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TopNav } from "./components/TopNav";
import { CardDetail } from "./pages/CardDetail";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { SharePreview } from "./pages/SharePreview";
import { TaskComposer } from "./pages/TaskComposer";
import { Timeline } from "./pages/Timeline";
import "./styles/app.css";

export function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <TopNav />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cards/:cardId" element={<CardDetail />} />
            <Route path="/task" element={<TaskComposer />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/share/:shareId" element={<SharePreview />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

Create `client/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Add base CSS**

Create `client/src/styles/app.css`:

```css
:root {
  color: #17202a;
  background: #f7f8fb;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.45;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.app-shell {
  min-height: 100vh;
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 28px;
  border-bottom: 1px solid #dde3ed;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(14px);
}

.brand,
.top-nav nav a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #17202a;
  text-decoration: none;
}

.brand {
  font-weight: 800;
}

.top-nav nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.top-nav nav a {
  min-height: 38px;
  padding: 8px 12px;
  border-radius: 8px;
  color: #5a6678;
}

.top-nav nav a.active {
  color: #0f5132;
  background: #dff5ea;
}

main {
  width: min(1180px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 28px 0 56px;
}

.page-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.page-title h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1.15;
}

.page-title p {
  margin: 6px 0 0;
  color: #657286;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.card,
.panel {
  border: 1px solid #dde3ed;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(23, 32, 42, 0.05);
}

.card {
  padding: 16px;
}

.panel {
  padding: 18px;
}

.stack {
  display: grid;
  gap: 12px;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid #b8c2d2;
  border-radius: 8px;
  background: #ffffff;
  color: #17202a;
  text-decoration: none;
}

.button.primary {
  border-color: #146c43;
  background: #146c43;
  color: #ffffff;
}

.button.subtle {
  background: #f1f4f8;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag,
.badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #edf1f6;
  color: #4c5869;
  font-size: 12px;
}

.badge.link {
  background: #e8f4ff;
  color: #0b5cad;
}

.badge.private {
  background: #f4ecff;
  color: #6741a5;
}

.badge.team {
  background: #fff2d8;
  color: #8a5a00;
}

.badge.public {
  background: #dff5ea;
  color: #146c43;
}

textarea,
input,
select {
  width: 100%;
  border: 1px solid #c8d1df;
  border-radius: 8px;
  padding: 10px 12px;
  background: #ffffff;
  color: #17202a;
}

textarea {
  min-height: 128px;
  resize: vertical;
}

pre {
  max-height: 360px;
  overflow: auto;
  margin: 0;
  padding: 14px;
  border-radius: 8px;
  background: #111827;
  color: #e5e7eb;
  white-space: pre-wrap;
}

.two-column {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
  gap: 16px;
}

@media (max-width: 820px) {
  .top-nav {
    align-items: flex-start;
    flex-direction: column;
  }

  .top-nav nav {
    width: 100%;
    overflow-x: auto;
  }

  .two-column {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Add temporary page stubs so routing compiles**

Create these files with the exact content shown:

`client/src/pages/Dashboard.tsx`

```tsx
export function Dashboard() {
  return <section className="page-title"><div><h1>Skill Card Library</h1><p>Reusable AI work habits owned by the user.</p></div></section>;
}
```

`client/src/pages/CardDetail.tsx`

```tsx
export function CardDetail() {
  return <section className="page-title"><div><h1>Skill Card Detail</h1><p>Edit habit fields and control how they are applied.</p></div></section>;
}
```

`client/src/pages/TaskComposer.tsx`

```tsx
export function TaskComposer() {
  return <section className="page-title"><div><h1>Task Composer</h1><p>Select habits, preview model context, then generate.</p></div></section>;
}
```

`client/src/pages/Timeline.tsx`

```tsx
export function Timeline() {
  return <section className="page-title"><div><h1>Memory Timeline</h1><p>Habit usage, sharing, importing, and suggestions.</p></div></section>;
}
```

`client/src/pages/SharePreview.tsx`

```tsx
export function SharePreview() {
  return <section className="page-title"><div><h1>Share Preview</h1><p>Preview, import, or fork a shared Skill Card snapshot.</p></div></section>;
}
```

`client/src/pages/Settings.tsx`

```tsx
export function Settings() {
  return <section className="page-title"><div><h1>Settings</h1><p>Model provider status and local demo configuration.</p></div></section>;
}
```

- [ ] **Step 7: Run client test again**

Run:

```bash
npm run test --workspace client -- App.test.tsx
```

Expected: PASS and navigation links render.

- [ ] **Step 8: Commit client shell**

Run:

```bash
git add client/src/test/setup.ts client/src/api/client.ts client/src/main.tsx client/src/App.tsx client/src/components/TopNav.tsx client/src/styles/app.css client/src/App.test.tsx client/src/pages
git commit -m "feat: add client app shell"
```

Expected: one commit with routable React shell.

---

### Task 10: Dashboard And Card Detail UI

**Files:**
- Create: `client/src/components/PrivacyBadge.tsx`
- Create: `client/src/components/SkillCardTile.tsx`
- Modify: `client/src/pages/Dashboard.tsx`
- Modify: `client/src/pages/CardDetail.tsx`

- [ ] **Step 1: Add privacy badge and card tile components**

Create `client/src/components/PrivacyBadge.tsx`:

```tsx
import type { PrivacyLevel } from "@shared/types";

export function PrivacyBadge({ privacy }: { privacy: PrivacyLevel }) {
  const label: Record<PrivacyLevel, string> = {
    private: "Private",
    link: "Link share",
    team: "Team",
    public: "Public demo"
  };

  return <span className={`badge ${privacy}`}>{label[privacy]}</span>;
}
```

Create `client/src/components/SkillCardTile.tsx`:

```tsx
import { Edit3, Play, Share2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { SkillCard } from "@shared/types";
import { api } from "../api/client";
import { PrivacyBadge } from "./PrivacyBadge";

export function SkillCardTile({ card, onShared }: { card: SkillCard; onShared?: (url: string) => void }) {
  const navigate = useNavigate();

  const share = async () => {
    const result = await api.share(card.id);
    onShared?.(result.url);
  };

  return (
    <article className="card stack">
      <div className="stack">
        <div className="button-row">
          <PrivacyBadge privacy={card.privacy} />
          <span className="badge">{card.compatibility.ppt}% PPT</span>
        </div>
        <h2>{card.name}</h2>
        <p>{card.description}</p>
        <div className="tag-row">
          {card.tags.slice(0, 5).map((tag) => (
            <span className="tag" key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <div className="button-row">
        <button className="button primary" onClick={() => navigate(`/task?card=${card.id}`)} title="Use this card">
          <Play size={16} />
          Use
        </button>
        <Link className="button" to={`/cards/${card.id}`} title="Edit this card">
          <Edit3 size={16} />
          Edit
        </Link>
        <button className="button" onClick={share} title="Generate share link">
          <Share2 size={16} />
          Share
        </button>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Replace dashboard stub**

Replace `client/src/pages/Dashboard.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { SkillCard } from "@shared/types";
import { api } from "../api/client";
import { SkillCardTile } from "../components/SkillCardTile";

export function Dashboard() {
  const [cards, setCards] = useState<SkillCard[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.cards().then(setCards).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="stack">
      <div className="page-title">
        <div>
          <h1>Skill Card Library</h1>
          <p>Reusable AI work habits owned, edited, and applied by the user.</p>
        </div>
      </div>
      {error && <div className="panel">{error}</div>}
      {shareUrl && <div className="panel">Share link: <a href={shareUrl}>{shareUrl}</a></div>}
      <div className="grid">
        {cards.map((card) => (
          <SkillCardTile key={card.id} card={card} onShared={setShareUrl} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Replace card detail stub**

Replace `client/src/pages/CardDetail.tsx`:

```tsx
import { Save, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { PrivacyLevel, SkillCard } from "@shared/types";
import { api } from "../api/client";
import { PrivacyBadge } from "../components/PrivacyBadge";

const arrayFields: Array<keyof Pick<SkillCard, "scenarios" | "tone" | "structure" | "styleRules" | "constraints" | "examples" | "tags">> = [
  "scenarios",
  "tone",
  "structure",
  "styleRules",
  "constraints",
  "examples",
  "tags"
];

export function CardDetail() {
  const { cardId = "" } = useParams();
  const [card, setCard] = useState<SkillCard | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.card(cardId).then(setCard).catch((err: Error) => setMessage(err.message));
  }, [cardId]);

  if (!card) {
    return <section className="panel">{message || "Loading Skill Card..."}</section>;
  }

  const updateArray = (field: typeof arrayFields[number], value: string) => {
    setCard({ ...card, [field]: value.split("\n").map((item) => item.trim()).filter(Boolean) });
  };

  const save = async () => {
    const saved = await api.updateCard(card.id, card);
    setCard(saved);
    setMessage("Saved changes.");
  };

  const share = async () => {
    const result = await api.share(card.id);
    setMessage(`Share link: ${result.url}`);
  };

  return (
    <section className="stack">
      <div className="page-title">
        <div>
          <h1>{card.name}</h1>
          <p>{card.description}</p>
        </div>
        <PrivacyBadge privacy={card.privacy} />
      </div>
      {message && <div className="panel">{message}</div>}
      <div className="two-column">
        <div className="panel stack">
          <label>Name<input value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} /></label>
          <label>Description<textarea value={card.description} onChange={(event) => setCard({ ...card, description: event.target.value })} /></label>
          <label>Privacy
            <select value={card.privacy} onChange={(event) => setCard({ ...card, privacy: event.target.value as PrivacyLevel })}>
              <option value="private">Private</option>
              <option value="link">Link share</option>
              <option value="team">Team</option>
              <option value="public">Public demo</option>
            </select>
          </label>
          <div className="button-row">
            <button className="button primary" onClick={save}><Save size={16} />Save</button>
            <button className="button" onClick={share}><Share2 size={16} />Share</button>
          </div>
        </div>
        <div className="panel stack">
          {arrayFields.map((field) => (
            <label key={field}>
              {field}
              <textarea value={card[field].join("\n")} onChange={(event) => updateArray(field, event.target.value)} />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run client typecheck**

Run:

```bash
npm run typecheck --workspace client
```

Expected: PASS with no React or shared type errors.

- [ ] **Step 5: Commit library and detail UI**

Run:

```bash
git add client/src/components/PrivacyBadge.tsx client/src/components/SkillCardTile.tsx client/src/pages/Dashboard.tsx client/src/pages/CardDetail.tsx
git commit -m "feat: add skill card library ui"
```

Expected: one commit with dashboard, detail editing, and share action.

---

### Task 11: Task Composer Workflow

**Files:**
- Create: `client/src/components/FieldPicker.tsx`
- Modify: `client/src/pages/TaskComposer.tsx`

- [ ] **Step 1: Add field picker component**

Create `client/src/components/FieldPicker.tsx`:

```tsx
import type { SkillField } from "@shared/types";

const fields: SkillField[] = ["tone", "structure", "styleRules", "constraints", "examples"];

export function FieldPicker({
  selected,
  onChange
}: {
  selected: SkillField[];
  onChange: (fields: SkillField[]) => void;
}) {
  const toggle = (field: SkillField) => {
    onChange(selected.includes(field) ? selected.filter((item) => item !== field) : [...selected, field]);
  };

  return (
    <div className="tag-row">
      {fields.map((field) => (
        <label className="tag" key={field}>
          <input type="checkbox" checked={selected.includes(field)} onChange={() => toggle(field)} />
          {field}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Replace task composer stub with full workflow**

Replace `client/src/pages/TaskComposer.tsx`:

```tsx
import { Eye, Save, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { GenerateResponse, Recommendation, SelectedCard, SkillField } from "@shared/types";
import { api } from "../api/client";
import { FieldPicker } from "../components/FieldPicker";

const demoTask = "帮我为 HCI 课程做一个 8 页项目展示 PPT 大纲，主题是 AI Skill Passport。";

export function TaskComposer() {
  const [params] = useSearchParams();
  const [task, setTask] = useState(demoTask);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedCards, setSelectedCards] = useState<SelectedCard[]>([]);
  const [context, setContext] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.recommend(task).then((items) => {
      setRecommendations(items);
      const requestedCard = params.get("card");
      const defaults: SelectedCard[] = requestedCard
        ? [{ cardId: requestedCard, mode: "all", selectedFields: [] }]
        : items.slice(0, 2).map((item, index) => ({
            cardId: item.card.id,
            mode: index === 0 ? "all" : "partial",
            selectedFields: index === 0 ? [] : ["styleRules"]
          }));
      setSelectedCards(defaults);
    });
  }, [params, task]);

  const selectedIds = useMemo(() => new Set(selectedCards.map((selection) => selection.cardId)), [selectedCards]);

  const updateSelection = (cardId: string, patch: Partial<SelectedCard>) => {
    setSelectedCards((current) => {
      const existing = current.find((selection) => selection.cardId === cardId);
      if (!existing) {
        return [...current, { cardId, mode: "all", selectedFields: [], ...patch }];
      }
      return current.map((selection) => (selection.cardId === cardId ? { ...selection, ...patch } : selection));
    });
  };

  const removeSelection = (cardId: string) => {
    setSelectedCards((current) => current.filter((selection) => selection.cardId !== cardId));
  };

  const preview = async () => {
    setStatus("Building context preview...");
    const response = await api.preview(task, selectedCards);
    setContext(response.context);
    setStatus("Context preview ready.");
  };

  const generate = async () => {
    setStatus("Generating with selected Skill Cards...");
    const response = await api.generate(task, selectedCards);
    setContext(response.context);
    setResult(response);
    setStatus(response.usedFallback ? "Fallback output returned." : "Real model output returned.");
  };

  const saveSuggestion = async () => {
    if (!result) {
      return;
    }
    await api.createCard(result.suggestedCard);
    setStatus("Suggested Skill Card saved to your library.");
  };

  return (
    <section className="stack">
      <div className="page-title">
        <div>
          <h1>Task Composer</h1>
          <p>Select full, partial, temporary, or no habit use before generation.</p>
        </div>
      </div>
      {status && <div className="panel">{status}</div>}
      <div className="two-column">
        <div className="stack">
          <div className="panel stack">
            <label>
              Task
              <textarea value={task} onChange={(event) => setTask(event.target.value)} />
            </label>
            <div className="button-row">
              <button className="button" onClick={preview}><Eye size={16} />Preview Context</button>
              <button className="button primary" onClick={generate}><Send size={16} />Generate</button>
            </div>
          </div>
          <div className="panel stack">
            <h2>Recommended Cards</h2>
            {recommendations.map((item) => {
              const selection = selectedCards.find((current) => current.cardId === item.card.id);
              return (
                <article className="card stack" key={item.card.id}>
                  <div>
                    <h3>{item.card.name}</h3>
                    <p>{item.card.description}</p>
                    <p>{item.reasons.join(" · ")}</p>
                  </div>
                  <div className="button-row">
                    {!selectedIds.has(item.card.id) && <button className="button primary" onClick={() => updateSelection(item.card.id, { mode: "all", selectedFields: [] })}>Apply all</button>}
                    {selection && (
                      <>
                        <select value={selection.mode} onChange={(event) => updateSelection(item.card.id, { mode: event.target.value as SelectedCard["mode"] })}>
                          <option value="all">Apply all</option>
                          <option value="partial">Selected fields</option>
                          <option value="temporary">Only this task</option>
                        </select>
                        <button className="button" onClick={() => removeSelection(item.card.id)}>Do not apply</button>
                      </>
                    )}
                  </div>
                  {selection?.mode === "partial" && (
                    <FieldPicker
                      selected={selection.selectedFields}
                      onChange={(fields: SkillField[]) => updateSelection(item.card.id, { selectedFields: fields })}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </div>
        <div className="stack">
          <div className="panel stack">
            <h2>Context Preview</h2>
            <pre>{context || "Preview will show the exact habit block sent to the backend."}</pre>
          </div>
          <div className="panel stack">
            <h2>Model Output</h2>
            <pre>{result?.output || "Generated output will appear here."}</pre>
            {result?.suggestedCard && (
              <div className="card stack">
                <h3>{result.suggestedCard.name}</h3>
                <p>{result.suggestedCard.description}</p>
                <button className="button primary" onClick={saveSuggestion}><Save size={16} />Save Suggestion</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run client typecheck**

Run:

```bash
npm run typecheck --workspace client
```

Expected: PASS with `TaskComposer` state types valid.

- [ ] **Step 4: Commit task composer**

Run:

```bash
git add client/src/components/FieldPicker.tsx client/src/pages/TaskComposer.tsx
git commit -m "feat: add task composer workflow"
```

Expected: one commit with recommendation, context preview, generation, and suggestion saving UI.

---

### Task 12: Share Preview, Timeline, And Settings UI

**Files:**
- Modify: `client/src/pages/SharePreview.tsx`
- Modify: `client/src/pages/Timeline.tsx`
- Modify: `client/src/pages/Settings.tsx`

- [ ] **Step 1: Replace share preview stub**

Replace `client/src/pages/SharePreview.tsx`:

```tsx
import { GitFork, Import } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ShareLink } from "@shared/types";
import { api } from "../api/client";
import { PrivacyBadge } from "../components/PrivacyBadge";

export function SharePreview() {
  const { shareId = "" } = useParams();
  const [share, setShare] = useState<ShareLink | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.sharePreview(shareId).then(setShare).catch((err: Error) => setMessage(err.message));
  }, [shareId]);

  const importCard = async () => {
    const card = await api.importShare(shareId);
    setMessage(`Imported as ${card.name}.`);
  };

  const forkCard = async () => {
    const card = await api.forkShare(shareId, { name: `${share?.snapshot.name || "Shared Skill Card"} Fork`, privacy: "private" });
    setMessage(`Forked as ${card.name}.`);
  };

  if (!share) {
    return <section className="panel">{message || "Loading shared Skill Card..."}</section>;
  }

  return (
    <section className="stack">
      <div className="page-title">
        <div>
          <h1>{share.snapshot.name}</h1>
          <p>Preview-only snapshot. Importing creates a local user-owned copy.</p>
        </div>
        <PrivacyBadge privacy={share.snapshot.privacy} />
      </div>
      {message && <div className="panel">{message}</div>}
      <div className="two-column">
        <div className="panel stack">
          <h2>Shared Card Content</h2>
          <p>{share.snapshot.description}</p>
          <div className="tag-row">
            {share.snapshot.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          </div>
          <div className="button-row">
            <button className="button primary" onClick={importCard}><Import size={16} />Import</button>
            <button className="button" onClick={forkCard}><GitFork size={16} />Fork and Edit</button>
          </div>
        </div>
        <div className="panel stack">
          <h2>Habit Fields</h2>
          <pre>{JSON.stringify(share.snapshot, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Replace timeline stub**

Replace `client/src/pages/Timeline.tsx`:

```tsx
import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import type { MemoryEvent } from "@shared/types";
import { api } from "../api/client";

export function Timeline() {
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.timeline().then(setEvents).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="stack">
      <div className="page-title">
        <div>
          <h1>Memory Timeline</h1>
          <p>Visible history for created, used, shared, imported, and suggested habits.</p>
        </div>
      </div>
      {error && <div className="panel">{error}</div>}
      <div className="stack">
        {events.length === 0 && <div className="panel">No memory events yet.</div>}
        {events.map((event) => (
          <article className="card" key={event.id}>
            <div className="button-row">
              <Clock3 size={16} />
              <strong>{event.title}</strong>
              <span className="badge">{event.type}</span>
            </div>
            <p>{event.detail}</p>
            <small>{new Date(event.createdAt).toLocaleString()}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Replace settings stub**

Replace `client/src/pages/Settings.tsx`:

```tsx
import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";

type Health = {
  ok: boolean;
  provider: string;
  modelConfigured: boolean;
  fallbackEnabled: boolean;
};

export function Settings() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    api.health().then(setHealth).catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  return (
    <section className="stack">
      <div className="page-title">
        <div>
          <h1>Settings</h1>
          <p>Server-side model configuration and local demo status.</p>
        </div>
        <button className="button" onClick={load}><RefreshCcw size={16} />Refresh</button>
      </div>
      {error && <div className="panel">{error}</div>}
      {health && (
        <div className="grid">
          <div className="card"><strong>API</strong><p>{health.ok ? "Online" : "Offline"}</p></div>
          <div className="card"><strong>Provider</strong><p>{health.provider}</p></div>
          <div className="card"><strong>Model</strong><p>{health.modelConfigured ? "Configured" : "Missing model name"}</p></div>
          <div className="card"><strong>Fallback</strong><p>{health.fallbackEnabled ? "Enabled" : "Disabled"}</p></div>
        </div>
      )}
      <div className="panel">
        API keys are read only by the backend from `.env`. The browser never receives `LLM_API_KEY`.
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run client typecheck and tests**

Run:

```bash
npm run typecheck --workspace client
npm run test --workspace client
```

Expected: PASS for typecheck and the client smoke test.

- [ ] **Step 5: Commit secondary views**

Run:

```bash
git add client/src/pages/SharePreview.tsx client/src/pages/Timeline.tsx client/src/pages/Settings.tsx
git commit -m "feat: add share timeline and settings views"
```

Expected: one commit with all spec routes represented.

---

### Task 13: Documentation, Build, And Manual Demo Verification

**Files:**
- Create: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Create README with local run instructions**

Create `README.md`:

```md
# AI Skill Passport Local Demo

Local full-stack demo for visible, reusable AI work habits. Users can manage Skill Cards, select full or partial habits for a task, preview the exact model context, generate through an OpenAI-compatible backend adapter, save a suggested habit, create share snapshots, and import or fork shared cards.

## Run Locally

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:8787/api`

## LLM Configuration

Copy `.env.example` to `.env` and set:

```bash
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your_server_side_key
LLM_MODEL=your_model_name
LLM_TIMEOUT_MS=30000
LLM_MOCK_FALLBACK=true
```

The browser never receives `LLM_API_KEY`. If the provider is missing or fails and `LLM_MOCK_FALLBACK=true`, the backend returns output clearly marked as fallback content.

## Demo Script

1. Open the dashboard and show the Skill Card library.
2. Open `Classroom Presentation` and show editable habit fields.
3. Go to `/task`.
4. Use the default HCI PPT task.
5. Show that `Classroom Presentation` and `Minimal Visual Style` are recommended.
6. Apply all of `Classroom Presentation` and selected fields from `Minimal Visual Style`.
7. Click `Preview Context` and show the exact habit block.
8. Click `Generate`.
9. Show whether the response is real model output or clearly marked fallback content.
10. Save the suggested `HCI Project Demo Outline` card.
11. Generate a share link from the dashboard.
12. Open the share preview and import or fork the card.

## Verification

```bash
npm run test
npm run typecheck
npm run build
```

Manual acceptance passes when the app demonstrates card ownership, user-controlled application, backend context composition, LLM or fallback generation, habit suggestion, sharing, importing, and timeline history.
```

- [ ] **Step 2: Confirm `.env.example` still matches the spec**

Open `.env.example` and confirm it exactly contains:

```bash
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=
LLM_TIMEOUT_MS=30000
LLM_MOCK_FALLBACK=true
```

Expected: The API key and model values are empty so credentials stay local.

- [ ] **Step 3: Run all automated checks**

Run:

```bash
npm run test
npm run typecheck
npm run build
```

Expected: PASS for server tests, client tests, TypeScript checks, server build, and client Vite build.

- [ ] **Step 4: Start the local demo**

Run:

```bash
npm run dev
```

Expected:

```text
AI Skill Passport API listening at http://127.0.0.1:8787
VITE ready in
Local: http://127.0.0.1:5173/
```

- [ ] **Step 5: Verify the demo in the in-app Browser**

Use the Browser plugin to open:

```text
http://127.0.0.1:5173
```

Check:

- Dashboard shows the four seeded cards.
- Card detail page edits and saves a field.
- Task composer recommends `Classroom Presentation` and `Minimal Visual Style` for the default task.
- Context preview shows `[Skill Card: Classroom Presentation]`.
- Generate returns either real model output or `[Fallback content]`.
- Suggested habit can be saved.
- Share link opens `/share/:shareId`.
- Share preview import creates a new local card.
- Timeline shows created, shared, imported, used, and suggested events after the workflow.

- [ ] **Step 6: Commit docs and verification readiness**

Run:

```bash
git add README.md .env.example
git commit -m "docs: add local demo runbook"
```

Expected: one commit with run instructions and manual acceptance steps.

---

## Plan Self-Review

Spec coverage:

- Skill Card library, detail editing, privacy labels, usage counts, compatibility, and actions are covered in Tasks 2, 3, 8, 10.
- Task composer, recommendations, full/partial/temporary/no-use selection, context preview, LLM generation, and suggestion saving are covered in Tasks 4, 5, 7, 8, 11.
- Share generation, preview, import, fork, and local user-owned copies are covered in Tasks 6, 8, 10, 12.
- Memory timeline is covered in Tasks 3, 6, 7, 8, 12.
- OpenAI-compatible server-side LLM access, `.env` handling, missing config behavior, and fallback labeling are covered in Tasks 7, 8, 13.
- Manual demo acceptance and demo script are covered in Task 13.

Consistency check:

- `SkillField`, `SelectedCard`, `AppliedCardSummary`, `GenerateResponse`, `SuggestedCard`, `ShareLink`, and `MemoryEvent` are defined once in `shared/types.ts` and referenced consistently from server and client code.
- API paths match the spec: `/api/cards`, `/api/recommend`, `/api/context/preview`, `/api/generate`, `/api/share`, `/api/share/:shareId/import`, `/api/share/:shareId/fork`, and `/api/timeline`.
- The first two recommended cards for the demo task are locked by `server/tests/recommend.test.ts`.
- The context preview works without an API key because it depends only on JSON storage and `promptBuilder.ts`.
- The fallback response includes `[Fallback content]`, making it visibly distinct from a real model response.
