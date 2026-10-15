import * as SQLite from "expo-sqlite";

export type QueuedMutation = {
  id: string;
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  body: string | null;
  createdAt: string;
  error: string | null;
};

type CacheRow = { payload: string };

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let activeUserId: string | null = null;

async function database() {
  databasePromise ??= SQLite.openDatabaseAsync("catalysts-offline.db").then(async (db) => {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS offline_cache (
        user_id TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, cache_key)
      );
      CREATE TABLE IF NOT EXISTS offline_queue (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        body TEXT,
        created_at TEXT NOT NULL,
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS offline_queue_user_order
        ON offline_queue (user_id, created_at);
      CREATE TABLE IF NOT EXISTS offline_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    return db;
  });
  return databasePromise;
}

function requireActiveUser() {
  if (!activeUserId) throw new Error("Offline storage has no active account.");
  return activeUserId;
}

export async function activateOfflineUser(userId: string) {
  const db = await database();
  const owner = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM offline_meta WHERE key = 'active_user_id'",
  );

  if (owner && owner.value !== userId) {
    const queued = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM offline_queue WHERE user_id = ?",
      owner.value,
    );
    if ((queued?.count ?? 0) > 0) {
      throw new Error("This device has unsynced changes for another account. Reconnect and sync them before switching accounts.");
    }
  }

  await db.runAsync(
    "INSERT INTO offline_meta (key, value) VALUES ('active_user_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    userId,
  );
  activeUserId = userId;
}

export async function saveCachedResponse(key: string, payload: unknown) {
  const db = await database();
  const userId = requireActiveUser();
  await db.runAsync(
    `INSERT INTO offline_cache (user_id, cache_key, payload, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, cache_key) DO UPDATE SET
       payload = excluded.payload, updated_at = excluded.updated_at`,
    userId,
    key,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}

export async function readCachedResponse<T>(key: string): Promise<T | null> {
  const db = await database();
  const userId = requireActiveUser();
  const row = await db.getFirstAsync<CacheRow>(
    "SELECT payload FROM offline_cache WHERE user_id = ? AND cache_key = ?",
    userId,
    key,
  );
  if (!row) return null;
  return JSON.parse(row.payload) as T;
}

export async function mutateCachedResponse<T>(
  key: string,
  update: (current: T | null) => T | null,
) {
  const current = await readCachedResponse<T>(key);
  const next = update(current);
  const db = await database();
  const userId = requireActiveUser();
  if (next === null) {
    await db.runAsync(
      "DELETE FROM offline_cache WHERE user_id = ? AND cache_key = ?",
      userId,
      key,
    );
  } else {
    await saveCachedResponse(key, next);
  }
}

export async function enqueueMutation(mutation: QueuedMutation) {
  const db = await database();
  const userId = requireActiveUser();
  await db.runAsync(
    `INSERT INTO offline_queue (id, user_id, method, path, body, created_at, error)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    mutation.id,
    userId,
    mutation.method,
    mutation.path,
    mutation.body,
    mutation.createdAt,
  );
}

export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await database();
  const userId = requireActiveUser();
  return db.getAllAsync<QueuedMutation>(
    `SELECT id, method, path, body, created_at AS createdAt, error
     FROM offline_queue WHERE user_id = ? ORDER BY created_at, rowid`,
    userId,
  );
}

export async function getOfflineQueueCounts() {
  const db = await database();
  const userId = requireActiveUser();
  const counts = await db.getFirstAsync<{ pending: number; failed: number }>(
    `SELECT
       SUM(CASE WHEN error IS NULL THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS failed
     FROM offline_queue WHERE user_id = ?`,
    userId,
  );
  const firstFailure = await db.getFirstAsync<{ error: string }>(
    "SELECT error FROM offline_queue WHERE user_id = ? AND error IS NOT NULL ORDER BY created_at, rowid LIMIT 1",
    userId,
  );
  return {
    pending: counts?.pending ?? 0,
    failed: counts?.failed ?? 0,
    failureMessage: firstFailure?.error ?? null,
  };
}

export async function removeQueuedMutation(id: string) {
  const db = await database();
  await db.runAsync(
    "DELETE FROM offline_queue WHERE user_id = ? AND id = ?",
    requireActiveUser(),
    id,
  );
}

export async function failQueuedMutation(id: string, error: string) {
  const db = await database();
  await db.runAsync(
    "UPDATE offline_queue SET error = ? WHERE user_id = ? AND id = ?",
    error,
    requireActiveUser(),
    id,
  );
}

export async function retryFailedMutations() {
  const db = await database();
  await db.runAsync(
    "UPDATE offline_queue SET error = NULL WHERE user_id = ?",
    requireActiveUser(),
  );
}

export async function discardQueuedMutations() {
  const db = await database();
  await db.runAsync(
    "DELETE FROM offline_queue WHERE user_id = ?",
    requireActiveUser(),
  );
}

export async function clearOfflineUserData(userId: string) {
  const db = await database();
  const queued = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM offline_queue WHERE user_id = ?",
    userId,
  );
  if ((queued?.count ?? 0) > 0) {
    throw new Error("Sync or explicitly discard pending changes before clearing this account's offline data.");
  }
  await db.runAsync("DELETE FROM offline_cache WHERE user_id = ?", userId);
}
