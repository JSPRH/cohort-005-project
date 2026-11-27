import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { asc } from "drizzle-orm";
import * as schema from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

/** Every user, for the DevUI panel, in a stable order: by id. */
export function listDevUsers(db: Db) {
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      role: schema.users.role,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.id))
    .all();
}
