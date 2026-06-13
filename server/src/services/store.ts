import { randomUUID } from "node:crypto";
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

const operationQueues = new Map<string, Promise<void>>();

export function createJsonStore(options: JsonStoreOptions): JsonStore {
  const queueKey = path.resolve(options.dbPath);

  const ensureSeeded = async (): Promise<DatabaseShape> => {
    await mkdir(path.dirname(options.dbPath), { recursive: true });

    let db = await readDatabase(options.dbPath);

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
    read() {
      return enqueueOperation(queueKey, ensureSeeded);
    },
    async write(db) {
      await enqueueOperation(queueKey, () => atomicWrite(options.dbPath, db));
    },
    async update(mutator) {
      return enqueueOperation(queueKey, async () => {
        const db = await ensureSeeded();
        const result = await mutator(db);
        await atomicWrite(options.dbPath, db);
        return result;
      });
    }
  };
}

function enqueueOperation<T>(queueKey: string, operation: () => Promise<T>): Promise<T> {
  const previous = operationQueues.get(queueKey) ?? Promise.resolve();
  const run = previous.then(operation, operation);
  operationQueues.set(
    queueKey,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

async function readDatabase(dbPath: string): Promise<DatabaseShape> {
  try {
    return parseJson<DatabaseShape>(await readFile(dbPath, "utf8"));
  } catch (error) {
    if (isNotFoundError(error)) {
      return emptyDb();
    }
    throw new Error(`Failed to read JSON database at ${dbPath}: ${errorMessage(error)}`, { cause: error });
  }
}

async function atomicWrite(dbPath: string, db: DatabaseShape): Promise<void> {
  const tmpPath = `${dbPath}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(dbPath), { recursive: true });
  await writeFile(tmpPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  await rename(tmpPath, dbPath);
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
