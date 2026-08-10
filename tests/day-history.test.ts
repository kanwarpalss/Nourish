import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyNutritionState,
  logsForDay,
  MAX_STORED_DAYS,
  parseSavedNutritionState,
  stringifySavedNutritionState,
  withDayLogs,
  wouldDropOldestDay,
} from "../app/local-nutrition-state";
import { recentDayKeys, summariseDay, summariseHistory, summariseTrend } from "../app/day-history";
import { nutritionItems } from "../app/nutrition-data";

const milk = { foodId: "nandini-goodlife-toned", amount: 200 };
const egg = { foodId: "whole-egg", amount: 2 };

test("REGRESSION: a day's diary survives the next Bangalore day", () => {
  // Schema 1 kept one day inline. On rollover the app declined to restore it and then
  // autosaved the new empty day over the same key, destroying the diary every midnight.
  let state = withDayLogs(emptyNutritionState(), "2026-08-10", [milk, egg]);
  // Tuesday opens: today is empty, which is correct.
  assert.deepEqual(logsForDay(state, "2026-08-11"), []);
  // Tuesday's first log writes only Tuesday.
  state = withDayLogs(state, "2026-08-11", [milk]);
  assert.deepEqual(logsForDay(state, "2026-08-10"), [milk, egg], "Monday must still be there");
  assert.deepEqual(logsForDay(state, "2026-08-11"), [milk]);
  // And it survives a full save/reload cycle.
  const reloaded = parseSavedNutritionState(stringifySavedNutritionState(state));
  assert.deepEqual(logsForDay(reloaded, "2026-08-10"), [milk, egg]);
  assert.equal(reloaded.days.length, 2);
});

test("a schema 1 diary is migrated, not discarded", () => {
  const legacy = JSON.stringify({ dayKey: "2026-08-09", logs: [milk, egg], planned: [{ id: "chia", kind: "food" }] });
  const migrated = parseSavedNutritionState(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(logsForDay(migrated, "2026-08-09"), [milk, egg], "the existing day must carry over");
  assert.deepEqual(migrated.planned, [{ id: "chia", kind: "food" }]);
  assert.equal(migrated.targets, null);
});

test("stored days are newest first, deduplicated, and capped", () => {
  let state = emptyNutritionState();
  for (let index = 0; index < MAX_STORED_DAYS + 5; index += 1) {
    const day = new Date(Date.UTC(2025, 0, 1) + index * 86400000).toISOString().slice(0, 10);
    state = withDayLogs(state, day, [milk]);
  }
  assert.equal(state.days.length, MAX_STORED_DAYS, "storage must be bounded");
  assert.ok(state.days[0].dayKey > state.days[1].dayKey, "newest first");
  const keys = state.days.map((day) => day.dayKey);
  assert.equal(new Set(keys).size, keys.length, "no duplicate days");
  assert.equal(wouldDropOldestDay(state, "2030-01-01"), true, "a brand new day at the cap must warn");
  assert.equal(wouldDropOldestDay(state, state.days[0].dayKey), false, "rewriting an existing day drops nothing");
});

test("clearing a day removes it rather than recording a zero-calorie day", () => {
  let state = withDayLogs(emptyNutritionState(), "2026-08-10", [milk]);
  state = withDayLogs(state, "2026-08-10", []);
  assert.equal(state.days.length, 0, "an emptied day must not linger as a fast");
  assert.deepEqual(summariseHistory(state.days), []);
});

test("corrupt or hostile stored data degrades to an empty diary instead of throwing", () => {
  for (const raw of ["{not json", "null", "[]", '{"schemaVersion":2}', '{"schemaVersion":2,"days":"nope"}', '{"schemaVersion":2,"days":[{"dayKey":"oops","logs":[]}]}']) {
    const parsed = parseSavedNutritionState(raw);
    assert.equal(parsed.schemaVersion, 2, raw);
    assert.ok(Array.isArray(parsed.days), raw);
  }
  // Individual bad entries are dropped without taking the day with them.
  const mixed = parseSavedNutritionState(JSON.stringify({
    schemaVersion: 2,
    days: [{ dayKey: "2026-08-10", logs: [milk, { foodId: "", amount: 5 }, { foodId: "x", amount: -1 }, { foodId: "y", amount: "3" }] }],
    planned: [{ id: "chia", kind: "nope" }],
    targets: { calories: 0, protein: 10, carbs: 10, fat: 10 },
  }));
  assert.deepEqual(logsForDay(mixed, "2026-08-10"), [milk]);
  assert.deepEqual(mixed.planned, []);
  assert.equal(mixed.targets, null, "a zero calorie target is not a usable target");
});

test("a day's totals are the sum of what was actually logged", () => {
  const summary = summariseDay({ dayKey: "2026-08-10", logs: [milk, egg] });
  const milkFood = nutritionItems.find((food) => food.id === "nandini-goodlife-toned")!;
  const eggFood = nutritionItems.find((food) => food.id === "whole-egg")!;
  assert.equal(summary.calories, Math.round((milkFood.calories * 2 + eggFood.calories * 2) * 100) / 100);
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.unresolvedCount, 0);
});

test("an entry naming a food that no longer exists is counted as unresolved, not as zero", () => {
  const summary = summariseDay({ dayKey: "2026-08-10", logs: [milk, { foodId: "deleted-food", amount: 100 }] });
  assert.equal(summary.entryCount, 1);
  assert.equal(summary.unresolvedCount, 1, "the day must admit it is incomplete rather than quietly shrinking");
  assert.ok(summary.calories > 0);
});

test("trend averages use logged days only, never calendar days", () => {
  // Three logged days inside a 30 day window. Dividing by 30 would invent 27 fasts.
  const days = [
    { dayKey: "2026-08-10", logs: [milk, egg] },
    { dayKey: "2026-08-08", logs: [milk] },
    { dayKey: "2026-08-01", logs: [egg] },
  ];
  const summaries = summariseHistory(days);
  const window = summariseTrend(summaries, 30, 2000);
  assert.equal(window.loggedDays, 3);
  assert.equal(window.windowDays, 30);
  const expected = Math.round((summaries.reduce((sum, day) => sum + day.calories, 0) / 3) * 100) / 100;
  assert.equal(window.average?.calories, expected, "average must divide by 3, not by 30");
});

test("an empty window reports nothing rather than a zero average", () => {
  const window = summariseTrend([], 30, 2000);
  assert.equal(window.average, null, "no data must never render as 0 kcal per day");
  assert.equal(window.loggedDays, 0);
  assert.equal(window.daysOnTarget, null);
  // A day with entries that all failed to resolve is not a logged day either.
  const ghost = summariseHistory([{ dayKey: "2026-08-10", logs: [{ foodId: "gone", amount: 1 }] }]);
  assert.equal(summariseTrend(ghost, 7, 2000).average, null);
});

test("days on target respect the tolerance and need a target to exist", () => {
  const days = [
    { dayKey: "2026-08-10", logs: [{ foodId: "nandini-goodlife-toned", amount: 3333 }] },
    { dayKey: "2026-08-09", logs: [{ foodId: "nandini-goodlife-toned", amount: 100 }] },
  ];
  const summaries = summariseHistory(days);
  const target = summaries[0].calories;
  assert.equal(summariseTrend(summaries, 7, target).daysOnTarget, 1, "only the day near the target counts");
  assert.equal(summariseTrend(summaries, 7, null).daysOnTarget, null, "without a target there is nothing to be on");
});

test("recent day keys walk backwards across month and year boundaries", () => {
  assert.deepEqual(recentDayKeys("2026-03-02", 4), ["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  assert.deepEqual(recentDayKeys("2027-01-01", 2), ["2026-12-31", "2027-01-01"]);
  // 2028 is a leap year, so February has a 29th.
  assert.deepEqual(recentDayKeys("2028-03-01", 2), ["2028-02-29", "2028-03-01"]);
  assert.deepEqual(recentDayKeys("2026-08-10", 1), ["2026-08-10"]);
  assert.deepEqual(recentDayKeys("not-a-date", 3), []);
  assert.deepEqual(recentDayKeys("2026-08-10", 0), []);
});

test("failure injection: a single-day store would fail the midnight regression", () => {
  // Models the old behaviour: one day held inline, overwritten on rollover.
  const singleDay = (dayKey: string, logs: typeof milk[]) => ({ dayKey, logs });
  let legacy = singleDay("2026-08-10", [milk, egg]);
  legacy = singleDay("2026-08-11", []);
  assert.equal(legacy.dayKey === "2026-08-10", false);
  assert.deepEqual(legacy.logs, [], "the old model really did lose the day, which is what the regression above guards");
});
