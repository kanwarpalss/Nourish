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

export const LOG_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** A phone camera JPEG comfortably; large enough to be useful, small enough that 30 days of them stays bounded. */
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const PHOTO_MIME_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function isValidProfileId(id) {
  return typeof id === "string" && PROFILE_ID_PATTERN.test(id);
}

export function isValidProfileName(name) {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= MAX_PROFILE_NAME_LENGTH;
}

export function isValidLogId(id) {
  return typeof id === "string" && LOG_ID_PATTERN.test(id);
}

export function isSupportedPhotoMimeType(mimeType) {
  return Object.prototype.hasOwnProperty.call(PHOTO_MIME_EXTENSIONS, mimeType);
}

export function openDiaryStore(databasePath = defaultDatabasePath()) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  // Photos live beside the database, not inside it: a BLOB in every diary row would
  // bloat the file this whole layer exists to keep small and easy to back up.
  const photosDir = path.join(path.dirname(databasePath), "photos");
  fs.mkdirSync(photosDir, { recursive: true });
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
    CREATE TABLE IF NOT EXISTS log_photos (
      profile_id TEXT NOT NULL,
      log_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (profile_id, log_id)
    );
    -- Deliberately NOT log_photos. A photo of the meal you ate is evidence that
    -- ages out after 30 days; a photo of a food you added to your catalogue is
    -- part of that food and must last as long as the food does. Sharing one
    -- table would mean the 30-day sweep silently stripped pictures off items
    -- KP created months ago.
    CREATE TABLE IF NOT EXISTS food_photos (
      profile_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (profile_id, food_id)
    );
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
    getPhotoRow: db.prepare("SELECT file_name, mime_type, created_at FROM log_photos WHERE profile_id = ? AND log_id = ?"),
    upsertPhotoRow: db.prepare(`
      INSERT INTO log_photos (profile_id, log_id, file_name, mime_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (profile_id, log_id) DO UPDATE SET file_name = excluded.file_name, mime_type = excluded.mime_type, byte_size = excluded.byte_size, created_at = excluded.created_at
    `),
    deletePhotoRow: db.prepare("DELETE FROM log_photos WHERE profile_id = ? AND log_id = ?"),
    listPhotoRows: db.prepare("SELECT log_id, mime_type, created_at FROM log_photos WHERE profile_id = ?"),
    listExpiredPhotos: db.prepare("SELECT profile_id, log_id, file_name FROM log_photos WHERE created_at < ?"),
    getFoodPhotoRow: db.prepare("SELECT file_name, mime_type, created_at FROM food_photos WHERE profile_id = ? AND food_id = ?"),
    upsertFoodPhotoRow: db.prepare(`
      INSERT INTO food_photos (profile_id, food_id, file_name, mime_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (profile_id, food_id) DO UPDATE SET file_name = excluded.file_name, mime_type = excluded.mime_type, byte_size = excluded.byte_size, created_at = excluded.created_at
    `),
    deleteFoodPhotoRow: db.prepare("DELETE FROM food_photos WHERE profile_id = ? AND food_id = ?"),
  };

  const now = () => new Date().toISOString();

  let closed = false;

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

    /**
     * Replaces whatever photo (if any) was on this entry before. Re-attaching after
     * a mistake is meant to just work, not pile up orphaned files next to the good one.
     */
    savePhoto(profileId, logId, buffer, mimeType) {
      if (!isSupportedPhotoMimeType(mimeType)) return { ok: false, reason: "unsupported-type" };
      if (buffer.length > MAX_PHOTO_BYTES) return { ok: false, reason: "too-large" };
      const existing = statements.getPhotoRow.get(profileId, logId);
      if (existing) {
        const oldPath = path.join(photosDir, existing.file_name);
        if (fs.existsSync(oldPath)) fs.rmSync(oldPath);
      }
      const fileName = `${profileId}__${logId}.${PHOTO_MIME_EXTENSIONS[mimeType]}`;
      fs.writeFileSync(path.join(photosDir, fileName), buffer);
      const createdAt = now();
      statements.upsertPhotoRow.run(profileId, logId, fileName, mimeType, buffer.length, createdAt);
      return { ok: true, mimeType, createdAt };
    },

    getPhoto(profileId, logId) {
      const row = statements.getPhotoRow.get(profileId, logId);
      if (!row) return null;
      const filePath = path.join(photosDir, row.file_name);
      if (!fs.existsSync(filePath)) return null;
      return { buffer: fs.readFileSync(filePath), mimeType: row.mime_type, createdAt: row.created_at };
    },

    /** Idempotent: removing a photo that is already gone is a no-op, not a failure. */
    deletePhoto(profileId, logId) {
      const row = statements.getPhotoRow.get(profileId, logId);
      if (!row) return false;
      const filePath = path.join(photosDir, row.file_name);
      if (fs.existsSync(filePath)) fs.rmSync(filePath);
      statements.deletePhotoRow.run(profileId, logId);
      return true;
    },

    listPhotos(profileId) {
      const result = {};
      for (const row of statements.listPhotoRows.all(profileId)) {
        result[row.log_id] = { mimeType: row.mime_type, createdAt: row.created_at };
      }
      return result;
    },

    /**
     * A picture of a food KP added to his own catalogue. Kept for as long as the
     * food exists — never swept — because it identifies the item rather than
     * recording a single meal.
     */
    saveFoodPhoto(profileId, foodId, buffer, mimeType) {
      if (!isSupportedPhotoMimeType(mimeType)) return { ok: false, reason: "unsupported-type" };
      if (buffer.length > MAX_PHOTO_BYTES) return { ok: false, reason: "too-large" };
      const existing = statements.getFoodPhotoRow.get(profileId, foodId);
      if (existing) {
        const oldPath = path.join(photosDir, existing.file_name);
        if (fs.existsSync(oldPath)) fs.rmSync(oldPath);
      }
      const fileName = `${profileId}__food__${foodId}.${PHOTO_MIME_EXTENSIONS[mimeType]}`;
      fs.writeFileSync(path.join(photosDir, fileName), buffer);
      const createdAt = now();
      statements.upsertFoodPhotoRow.run(profileId, foodId, fileName, mimeType, buffer.length, createdAt);
      return { ok: true, mimeType, createdAt };
    },

    getFoodPhoto(profileId, foodId) {
      const row = statements.getFoodPhotoRow.get(profileId, foodId);
      if (!row) return null;
      const filePath = path.join(photosDir, row.file_name);
      if (!fs.existsSync(filePath)) return null;
      return { buffer: fs.readFileSync(filePath), mimeType: row.mime_type, createdAt: row.created_at };
    },

    deleteFoodPhoto(profileId, foodId) {
      const row = statements.getFoodPhotoRow.get(profileId, foodId);
      if (!row) return false;
      const filePath = path.join(photosDir, row.file_name);
      if (fs.existsSync(filePath)) fs.rmSync(filePath);
      statements.deleteFoodPhotoRow.run(profileId, foodId);
      return true;
    },

    /**
     * Bounds photo storage to roughly a month of logging, regardless of how many
     * profiles use this database. Reads log_photos only — food_photos is catalogue
     * data and is intentionally out of its reach.
     */
    sweepExpiredPhotos(maxAgeDays = 30) {
      const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
      const expired = statements.listExpiredPhotos.all(cutoff);
      for (const row of expired) {
        const filePath = path.join(photosDir, row.file_name);
        if (fs.existsSync(filePath)) fs.rmSync(filePath);
        statements.deletePhotoRow.run(row.profile_id, row.log_id);
      }
      return expired.length;
    },

    close() {
      if (closed) return;
      closed = true;
      db.close();
    },
  };
}
