/**
 * The Nourish diary, stored in SQLite on the machine that hosts the app.
 *
 * Why a document per person rather than tables of days and entries: the diary's
 * shape, its validation and its merge rules already live in one heavily tested
 * place (app/local-nutrition-state.ts). Re-modelling all of that in SQL would
 * mean two definitions of what a diary is, and the day they disagree is the day
 * numbers start differing between the screen and the database. SQLite is here
 * for durability, atomic writes and a single file that can be backed up — not to
 * re-describe data the app already knows how to describe.
 *
 * Every write also appends to a history table. A browser can only ever hold the
 * current copy; a server that keeps the last fifty means an accidental "delete
 * everything" is recoverable rather than final.
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Kept outside the repository on purpose: `npm run release` and `npm test` both rewrite the working tree. */
export function defaultDatabasePath() {
  return process.env.NOURISH_DB_PATH
    ?? path.join(os.homedir(), "Library", "Application Support", "Nourish", "nourish.db");
}

export const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,30}$/;
export const MAX_PROFILE_NAME_LENGTH = 40;
/** Roughly a year of dense logging; far beyond it means something is wrong, not enthusiastic. */
export const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
export const HISTORY_PER_PROFILE = 50;

export function isValidProfileId(id) {
  return typeof id === "string" && PROFILE_ID_PATTERN.test(id);
}

export function isValidProfileName(name) {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= MAX_PROFILE_NAME_LENGTH;
}

export function openDiaryStore(databasePath = defaultDatabasePath()) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  // WAL survives a hard power cut mid-write far better than the rollback journal,
  // which matters on a Mac Mini that may simply lose power.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA synchronous = FULL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS diaries (
      profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      payload TEXT NOT NULL,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS diary_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      revision INTEGER NOT NULL,
      saved_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS diary_history_profile ON diary_history (profile_id, id DESC);
  `);

  const statements = {
    listProfiles: db.prepare("SELECT id, name, created_at FROM profiles ORDER BY created_at ASC"),
    getProfile: db.prepare("SELECT id, name, created_at FROM profiles WHERE id = ?"),
    insertProfile: db.prepare("INSERT INTO profiles (id, name, created_at) VALUES (?, ?, ?)"),
    renameProfile: db.prepare("UPDATE profiles SET name = ? WHERE id = ?"),
    deleteProfile: db.prepare("DELETE FROM profiles WHERE id = ?"),
    deleteProfileHistory: db.prepare("DELETE FROM diary_history WHERE profile_id = ?"),
    getDiary: db.prepare("SELECT payload, revision, updated_at FROM diaries WHERE profile_id = ?"),
    upsertDiary: db.prepare(`
      INSERT INTO diaries (profile_id, payload, revision, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (profile_id) DO UPDATE SET payload = excluded.payload, revision = excluded.revision, updated_at = excluded.updated_at
    `),
    insertHistory: db.prepare("INSERT INTO diary_history (profile_id, payload, revision, saved_at) VALUES (?, ?, ?, ?)"),
    trimHistory: db.prepare(`
      DELETE FROM diary_history WHERE profile_id = ?
      AND id NOT IN (SELECT id FROM diary_history WHERE profile_id = ? ORDER BY id DESC LIMIT ?)
    `),
    listHistory: db.prepare("SELECT id, revision, saved_at, length(payload) AS bytes FROM diary_history WHERE profile_id = ? ORDER BY id DESC"),
    getHistoryEntry: db.prepare("SELECT payload, revision, saved_at FROM diary_history WHERE profile_id = ? AND id = ?"),
  };

  const now = () => new Date().toISOString();

  return {
    path: databasePath,

    listProfiles() {
      return statements.listProfiles.all().map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at }));
    },

    getProfile(id) {
      const row = statements.getProfile.get(id);
      return row ? { id: row.id, name: row.name, createdAt: row.created_at } : null;
    },

    /** Creating a profile is idempotent on the id, so a retried request cannot fail loudly for no reason. */
    createProfile(id, name) {
      if (!isValidProfileId(id)) throw new Error(`"${id}" is not a usable profile id`);
      if (!isValidProfileName(name)) throw new Error("A profile needs a name");
      const existing = statements.getProfile.get(id);
      if (existing) return { id: existing.id, name: existing.name, createdAt: existing.created_at };
      statements.insertProfile.run(id, name.trim(), now());
      return this.getProfile(id);
    },

    renameProfile(id, name) {
      if (!isValidProfileName(name)) throw new Error("A profile needs a name");
      if (!statements.getProfile.get(id)) return null;
      statements.renameProfile.run(name.trim(), id);
      return this.getProfile(id);
    },

    /**
     * Removes a person and everything they logged, history included. This is the
     * one operation here with nothing behind it, which is why the caller is
     * expected to have asked twice.
     */
    deleteProfile(id) {
      if (!statements.getProfile.get(id)) return false;
      statements.deleteProfileHistory.run(id);
      statements.deleteProfile.run(id);
      return true;
    },

    /** Revision 0 means "this person has a profile but has never saved anything". */
    readDiary(profileId) {
      const row = statements.getDiary.get(profileId);
      if (!row) return { revision: 0, state: null, updatedAt: null };
      return { revision: row.revision, state: JSON.parse(row.payload), updatedAt: row.updated_at };
    },

    /**
     * Optimistic concurrency. A write built on a revision the server has already
     * moved past is refused rather than applied, and the caller is handed the
     * newer copy so it can merge and try again. Last-writer-wins here would mean
     * the slower phone silently erasing the laptop's lunch.
     */
    writeDiary(profileId, state, baseRevision) {
      if (!statements.getProfile.get(profileId)) return { ok: false, reason: "no-profile" };
      const payload = JSON.stringify(state);
      if (Buffer.byteLength(payload, "utf8") > MAX_PAYLOAD_BYTES) return { ok: false, reason: "too-large" };
      const current = statements.getDiary.get(profileId);
      const currentRevision = current ? current.revision : 0;
      if (baseRevision !== currentRevision) {
        return { ok: false, reason: "conflict", revision: currentRevision, state: current ? JSON.parse(current.payload) : null };
      }
      const revision = currentRevision + 1;
      const savedAt = now();
      // One transaction: a diary saved without its history entry, or a history
      // entry for a save that did not happen, are both lies about what is stored.
      db.exec("BEGIN IMMEDIATE");
      try {
        statements.upsertDiary.run(profileId, payload, revision, savedAt);
        statements.insertHistory.run(profileId, payload, revision, savedAt);
        statements.trimHistory.run(profileId, profileId, HISTORY_PER_PROFILE);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return { ok: true, revision, updatedAt: savedAt };
    },

    listHistory(profileId) {
      return statements.listHistory.all(profileId).map((row) => ({ id: row.id, revision: row.revision, savedAt: row.saved_at, bytes: row.bytes }));
    },

    readHistoryEntry(profileId, historyId) {
      const row = statements.getHistoryEntry.get(profileId, historyId);
      return row ? { revision: row.revision, savedAt: row.saved_at, state: JSON.parse(row.payload) } : null;
    },

    close() {
      db.close();
    },
  };
}
