import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { listDevUsers } from "./dev-users.server";

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
  // Make SQLite return rows from an unordered SELECT in reverse, so a
  // query that depends on the scan order fails here instead of in the panel.
  db.$client.pragma("reverse_unordered_selects = ON");

  for (const [index, role] of [
    UserRole.Admin,
    UserRole.Instructor,
    UserRole.Student,
    UserRole.Student,
  ].entries()) {
    db.insert(schema.users)
      .values({
        name: `User ${index + 1}`,
        email: `user${index + 1}@example.com`,
        role,
      })
      .run();
  }
});

describe("listing the DevUI users", () => {
  it("lists every user in id order, whatever order SQLite scans in", () => {
    expect(listDevUsers(db).map((user) => user.id)).toEqual([1, 2, 3, 4]);
  });

  it("returns only the id, name and role", () => {
    expect(listDevUsers(db)[0]).toEqual({
      id: 1,
      name: "User 1",
      role: UserRole.Admin,
    });
  });
});
