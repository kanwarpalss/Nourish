"use client";

import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { isCardIqFoodImport, refineCardIqImport, type CardIqFoodImport } from "./cardiq-food";
import { FoodIcon, foodIconKey } from "./food-icon";
import { freshTrayId, freshUnique } from "./ids";
import { addToTray, areFoodConversionsValid, cloneNutritionItem, cloneUserMeal, createCustomFood, createUserMeal, forkFoodForEdit, getSingleItemKind, isOwnedFood, isUserMealNameValid, MAX_CONVERSION_LABEL_LENGTH, MAX_FOOD_CONVERSIONS, MAX_MEAL_COMPONENTS, MAX_MEAL_NAME_LENGTH, mergeFoodCatalog, singleItemKindLabel, upsertUserMeal, userMealToNutritionItem, userMealTotals, type SingleItemKind, type TrayItem, type UserMeal } from "./logging-session";
import { defaultCompositeItems, findComponentFood } from "./composite-foods";
import { createProfile, deleteProfile as deleteRemoteProfile, describeSyncStatus, fetchProfiles, pullDiary, pushDiary, renameProfile, DEFAULT_PROFILE_ID, type DiaryProfile, type SyncStatus } from "./diary-sync";
import { deleteFoodPhoto, deleteLogPhoto, foodPhotoKeyFromUrl, isAutoLoadedFoodImage, isSupportedPhotoFile, photoUrl, uploadFoodPhoto, uploadLogPhoto, type LogPhotoMeta } from "./log-photos";
import { canRestoreRecord, clearAllUserData, emptyNutritionState, exportNutritionState, nutritionStorageKeys, withLogIds, getWeightTrendPoints, isSafeImageUrl, logsForDay, MAX_STORED_DAYS, MAX_TARGET_VALUE, mergeNutritionBackup, nextTargetEditTime, parseExportedNutritionState, parseSavedNutritionState, readStoredNutritionRaw, removeRecord, restoreRecord, upsertWeightEntry, withDayLogs, wouldDropOldestDay, writeStoredNutritionState, type RemovableKind, type RemovedRecord, type SavedLogEntry, type SavedNutritionState, type SavedTargets, type WeightEntry } from "./local-nutrition-state";
import { DEFAULT_TARGETS, loggableMeals, recentDayKeys, resolveLoggedFood, summariseHistory, summariseTrend, type DaySummary } from "./day-history";
import { estimateSatiety, getBangaloreClock, getBasisAmountForLogging, getEnergyRunway, getLoggingUnitLabel, getLoggingUnits, getQuantityLimit, hasNutritionTarget, isQuantityValid, matchesNutritionTarget, matchesRecipe, satietyLabel, scaleNutrition, scaleNutritionForUnit, sumLoggedNutrition, sumNutritionDetails, type DashboardClock, type NutritionTarget } from "./prototype-logic";
import { meals, nutritionItems, SOURCE_LINKS, type Meal, type NutritionItem, type NutritionUnit } from "./nutrition-data";

type Area = "plan" | "track";
type PlanView = "items" | "meals";
type TrackView = "today" | "history" | "trends" | "purchases";
type MacroKey = "protein" | "carbs" | "fat";
type Food = NutritionItem;
type Recipe = Meal;
type PlannedEntry = Pick<Meal, "id" | "name" | "calories" | "protein" | "carbs" | "fat" | "fiber"> & { serving: string; kind: "food" | "meal"; fiberDeclared?: boolean };
type TargetValues = Omit<SavedTargets, "updatedAt">;

/** Which person's diary this device had open. Not the diary itself — just the pointer. */
const PROFILE_STORAGE_KEY = "nourish.profile";

/** A person's name becomes a short, url-safe id. Non-Latin names still get a usable one. */
function toProfileId(name: string) {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
  return slug ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : `person-${Math.random().toString(36).slice(2, 8)}`;
}

function profileInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}` : parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}


const trackNav: Array<{ id: TrackView; label: string; icon: string }> = [
  { id: "today", label: "Today", icon: "●" },
  { id: "history", label: "History", icon: "□" },
  { id: "trends", label: "Trends", icon: "↗" },
  { id: "purchases", label: "Purchases", icon: "⌑" },
];

const planNav: Array<{ id: PlanView; label: string; icon: string }> = [
  { id: "items", label: "Items", icon: "⌕" },
  { id: "meals", label: "Meals", icon: "✦" },
];

const foods = nutritionItems;
const recipes = meals;
const compositeItems = defaultCompositeItems();
/** The meal shown as an example on Today. Falls back to the first recipe if the id changes. */
const suggestedMeal = recipes.find((recipe) => recipe.id === "cauli-chicken") ?? recipes[0];
const baseLogFoods = [...compositeItems, ...foods, ...loggableMeals];

function foodLabel(food: Pick<Food, "brand" | "name" | "variant">) {
  return [food.brand.trim() === "Generic" ? "" : food.brand, food.name, food.variant].map((part) => part.trim()).filter(Boolean).join(" · ");
}

function fiberLabel(food: Pick<Food, "fiber" | "fiberDeclared">, digits = 1) {
  return food.fiberDeclared === false ? "not declared" : `${food.fiber.toFixed(digits)} g`;
}

function foodAtBasis(food: Food): Food {
  if (!food.basis) return food;
  return { ...food, amount: food.basis.amount, unit: food.basis.unit ?? food.unit, calories: food.basis.calories, protein: food.basis.protein, carbs: food.basis.carbs, fat: food.basis.fat, fiber: food.basis.fiber, basis: undefined };
}

/**
 * A real photo when the food has one, a drawn icon when it does not. A broken
 * link falls back to the icon instead of leaving a torn image in the list.
 */
function FoodThumb({ food }: { food: Pick<Food, "name" | "brand" | "category" | "imageUrl"> & { aliases?: string[] } }) {
  const [failed, setFailed] = useState(false);
  if (food.imageUrl && isAutoLoadedFoodImage(food.imageUrl) && !failed) {
    return <span className="food-thumb"><img src={food.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /></span>;
  }
  return <span className={`food-thumb icon ${foodIconKey(food)}`}><FoodIcon name={foodIconKey(food)} /></span>;
}

/** A blank food to type into, so creating never starts from someone else's entry. */
function blankFood(name = ""): Food {
  return {
    id: "draft-new-food", name, brand: "", variant: "", amount: 100, unit: "g",
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
    category: "Product", availability: "Added by you", aliases: [], imageUrl: "",
    source: { label: "Added by you", url: "", trust: "Personal" },
  };
}

function isFoodDetailsValid(food: Food) {
  const brandIsValid = food.category === "Ingredient" || Boolean(food.brand.trim());
  return Boolean(brandIsValid && food.name.trim() && isQuantityValid(food.unit, food.amount))
    && areFoodConversionsValid(food.unit, food.conversions)
    && [food.calories, food.protein, food.carbs, food.fat, food.fiber].every((value) => Number.isFinite(value) && value >= 0 && value <= 50_000);
}

function itemCategoryForKind(kind: SingleItemKind): Food["category"] {
  if (kind === "ingredient") return "Ingredient";
  if (kind === "ordered-food") return "OrderedFood";
  return "Product";
}

function templateComponent(foodId: string, amount: number): Food | null {
  const food = findComponentFood(foodId);
  return food ? scaleNutrition(food, amount) : null;
}

/** Existing calculated dishes become ordinary flat Meals in Log Food. */
const builtInUserMeals: UserMeal[] = [
  ...compositeItems.map((food) => ({
    id: `builtin-${food.id}`,
    name: food.name,
    createdAt: "2026-08-08",
    components: (food.components ?? []).flatMap((component) => {
      const item = templateComponent(component.foodId, component.amount);
      return item ? [item] : [];
    }),
  })),
  ...recipes.map((meal) => ({
    id: `builtin-meal-${meal.id}`,
    name: meal.name,
    createdAt: "2026-08-08",
    components: meal.nutritionBasis.flatMap((component) => {
      const item = templateComponent(component.foodId, component.amount);
      return item ? [item] : [];
    }),
  })),
].filter((meal) => meal.components.length > 0);

function planEntryFromFood(food: Food): PlannedEntry {
  return { id: food.id, kind: "food", name: foodLabel(food), serving: `${food.amount} ${food.unit}`, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber, fiberDeclared: food.fiberDeclared };
}

function planEntryFromMeal(meal: Recipe): PlannedEntry {
  return { id: meal.id, kind: "meal", name: meal.name, serving: meal.serving, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, fiber: meal.fiber };
}

function restorePlanEntries(saved: SavedNutritionState, catalog: Food[] = baseLogFoods): PlannedEntry[] {
  return saved.planned.flatMap((entry): PlannedEntry[] => {
    if (entry.kind === "meal") {
      const meal = recipes.find((candidate) => candidate.id === entry.id);
      return meal ? [planEntryFromMeal(meal)] : [];
    }
    const food = catalog.find((candidate) => candidate.id === entry.id);
    return food ? [planEntryFromFood(food)] : [];
  });
}

function foodToLogEntry(food: Food): SavedLogEntry {
  return { foodId: food.id, amount: food.amount, snapshot: food };
}

function mealToLogEntry(meal: UserMeal, trust: Food["source"]["trust"] = "Personal"): SavedLogEntry {
  const snapshot = userMealToNutritionItem(meal, trust);
  return { foodId: snapshot.id, amount: 1, snapshot, mealSnapshot: cloneUserMeal(meal) };
}

type LoggedDisplayEntry = { food: Food; logIndex: number; meal: UserMeal | null; logId?: string };
type PhotoIndex = Record<string, LogPhotoMeta>;

function legacyMealSnapshot(food: Food, dayKey: string): UserMeal {
  const knownComponents = (food.components ?? []).flatMap((component) => {
    const item = templateComponent(component.foodId, component.amount);
    return item ? [item] : [];
  });
  return {
    id: `legacy-log-${food.id}`,
    name: food.name,
    createdAt: dayKey,
    components: knownComponents.length > 0 ? knownComponents : [{ ...food, id: `legacy-log-item-${food.id}`, brand: "Legacy", category: "Product" }],
  };
}

function restoreDayEntries(saved: SavedNutritionState, dayKey: string, catalog: Food[] = baseLogFoods): LoggedDisplayEntry[] {
  return logsForDay(saved, dayKey).flatMap((entry, logIndex) => {
    const food = resolveLoggedFood(entry, catalog);
    const meal = food && (food.category === "Meal" || food.category === "Composite") ? entry.mealSnapshot ?? legacyMealSnapshot(food, dayKey) : null;
    return food ? [{ food, logIndex, meal, logId: entry.logId }] : [];
  });
}

/** A small thumbnail with a link to the full photo. View-only — attaching/replacing happens from Edit. */
function EntryPhotoThumb({ profileId, logId, meta }: { profileId: string; logId: string; meta: LogPhotoMeta }) {
  return (
    <a className="entry-photo-thumb" href={photoUrl(profileId, logId)} target="_blank" rel="noreferrer" aria-label="Open the photo of this entry" title={`Photographed ${new Date(meta.createdAt).toLocaleString()}`}>
      <img src={photoUrl(profileId, logId)} alt="" loading="lazy" />
    </a>
  );
}

/** "9 Aug" — used on axes and chips where a full date would crowd the layout. */
function formatShortDate(dayKey: string | undefined) {
  if (!dayKey) return "";
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function MacroBar({ label, value, target, tone }: { label: string; value: number; target: number; tone: MacroKey }) {
  const percent = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="macro-row">
      <div className="macro-label">
        <span><i className={`macro-dot ${tone}`} />{label}</span>
        <strong>{Math.round(value)}<small> / {target}g</small></strong>
      </div>
      <div className="progress-track" role="progressbar" aria-label={`${label}: ${Math.round(value)} of ${target} grams`} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={target}>
        <span className={tone} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="heading-action">{action}</div> : null}
    </header>
  );
}

function TargetEditor({ profileName, targets, isDefault, onSave, onCancel }: { profileName: string; targets: SavedTargets; isDefault: boolean; onSave: (next: TargetValues) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({ calories: String(targets.calories), protein: String(targets.protein), carbs: String(targets.carbs), fat: String(targets.fat) });
  const fields: Array<{ key: keyof typeof draft; label: string; suffix: string }> = [
    { key: "calories", label: "Daily energy", suffix: "kcal" },
    { key: "protein", label: "Protein", suffix: "g" },
    { key: "carbs", label: "Carbs", suffix: "g" },
    { key: "fat", label: "Fat", suffix: "g" },
  ];
  const parsed = { calories: Number(draft.calories), protein: Number(draft.protein), carbs: Number(draft.carbs), fat: Number(draft.fat) };
  const valid = Object.values(parsed).every((value) => Number.isFinite(value) && value > 0 && value <= MAX_TARGET_VALUE);
  // Shown so KP can see whether the macro grams he typed actually add up to the energy he typed.
  const macroEnergy = parsed.protein * 4 + parsed.carbs * 4 + parsed.fat * 9;
  const drift = valid ? Math.round(macroEnergy - parsed.calories) : 0;
  return (
    <section className="target-editor surface-card">
      <div className="target-filters-head">
        <div><span className="eyebrow">Daily targets for {profileName}</span><h2>{isDefault ? "Replace the placeholders with personal targets" : "Change energy or macros at any time"}</h2></div>
        <button className="text-button" onClick={onCancel}>Cancel</button>
      </div>
      <div className="target-fields">
        {fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <div><input type="number" min={1} max={MAX_TARGET_VALUE} inputMode="numeric" value={draft[field.key]} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} /><i>{field.suffix}</i></div>
          </label>
        ))}
      </div>
      <p className={`target-drift ${Math.abs(drift) > 100 ? "warn" : ""}`}>
        {valid ? `Those macros come to ${Math.round(macroEnergy).toLocaleString("en-IN")} kcal, ${drift === 0 ? "exactly matching" : `${Math.abs(drift)} kcal ${drift > 0 ? "above" : "below"}`} your energy target.` : `Every target must be between 1 and ${MAX_TARGET_VALUE.toLocaleString("en-IN")}.`}
      </p>
      <button className="button lime full" disabled={!valid} onClick={() => onSave(parsed)}>Save targets</button>
    </section>
  );
}

function WeightCard({ dayKey, entries, onSave, onDelete }: { dayKey: string; entries: WeightEntry[]; onSave: (entry: WeightEntry) => void; onDelete: (date: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [showTrend, setShowTrend] = useState(true);
  const [date, setDate] = useState(dayKey);
  const [kg, setKg] = useState("");
  const latest = entries.at(-1) ?? null;
  const previous = entries.at(-2) ?? null;
  const change = latest && previous ? Math.round((latest.kg - previous.kg) * 10) / 10 : null;
  const points = getWeightTrendPoints(entries, 300, 92);
  const minimum = entries.length ? Math.min(...entries.map((entry) => entry.kg)) : null;
  const maximum = entries.length ? Math.max(...entries.map((entry) => entry.kg)) : null;
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = points.length > 1 ? `0,92 ${linePoints} 300,92` : "";
  const kgNumber = Number(kg);
  const valid = Number.isFinite(kgNumber) && kgNumber >= 20 && kgNumber <= 400 && date <= dayKey;
  return (
    <section className="weight-card surface-card">
      <div className="section-title-row"><div><span className="eyebrow">Body weight</span><h2>{latest ? `${latest.kg.toFixed(1)} kg` : "Start your trend"}</h2></div><button className="weight-add-button" onClick={() => setShowForm((value) => !value)}>{showForm ? "Close" : "+ Log"}</button></div>
      {latest ? <div className="weight-summary"><span>Last logged {latest.date === dayKey ? "today" : latest.date}</span><strong>{change === null ? "First entry" : `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`}</strong></div> : <p className="weight-empty">Log whenever you weigh in. No daily streaks or pressure.</p>}
      {showForm ? <form className="weight-form" onSubmit={(event) => { event.preventDefault(); if (!valid) return; onSave({ date, kg: kgNumber }); setKg(""); setShowForm(false); }}>
        <label><span>Date</span><input type="date" max={dayKey} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label><span>Weight</span><div><input type="number" min="20" max="400" step="0.1" inputMode="decimal" value={kg} onChange={(event) => setKg(event.target.value)} placeholder="72.5" aria-label="Weight in kilograms" /><b>kg</b></div></label>
        <button className="button primary" disabled={!valid}>Save</button>
      </form> : null}
      {entries.length ? <button className="weight-trend-toggle" onClick={() => setShowTrend((value) => !value)} aria-expanded={showTrend}>{showTrend ? "Hide trend" : "Show trend chart"} <span>{showTrend ? "↑" : "↗"}</span></button> : null}
      {showTrend && entries.length ? <div className="weight-chart-wrap"><div className="weight-chart-head"><span>{minimum?.toFixed(1)} kg low</span><strong>{entries.length} {entries.length === 1 ? "entry" : "entries"}</strong><span>{maximum?.toFixed(1)} kg high</span></div><svg className="weight-chart" viewBox="-8 -8 316 108" role="img" aria-label={`Weight trend across ${entries.length} entries`}><defs><linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7aa13b" stopOpacity="0.3" /><stop offset="100%" stopColor="#7aa13b" stopOpacity="0.02" /></linearGradient></defs><line className="weight-chart-grid" x1="0" x2="300" y1="0" y2="0" /><line className="weight-chart-grid" x1="0" x2="300" y1="46" y2="46" /><line className="weight-chart-grid" x1="0" x2="300" y1="92" y2="92" />{areaPoints ? <polygon className="weight-chart-area" points={areaPoints} /> : null}<polyline points={linePoints} />{points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="4"><title>{point.date}: {point.kg.toFixed(1)} kg</title></circle>)}</svg><div className="weight-chart-axis"><span>{entries[0].date}</span><span>{latest?.date}</span></div>
        {/* Every weigh-in is listed, because a typo you cannot delete bends the whole trend line. */}
        <ul className="weight-entry-list">{[...entries].reverse().map((entry) => <li key={entry.date}><span>{entry.date}</span><strong>{entry.kg.toFixed(1)} kg</strong><button onClick={() => onDelete(entry.date)} aria-label={`Delete the ${entry.kg.toFixed(1)} kg weigh-in from ${entry.date}`}>×</button></li>)}</ul>
      </div> : null}
    </section>
  );
}

function DiaryEntryRow({ entry, index, profileId, photoIndex, onEdit, onDelete }: { entry: LoggedDisplayEntry; index: number; profileId: string; photoIndex: PhotoIndex; onEdit: (index: number) => void; onDelete: (index: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { food, meal, logId } = entry;
  const photoMeta = logId ? photoIndex[logId] : undefined;
  return (
    <article className={`meal-entry added ${meal ? "grouped-meal-entry" : ""}`}>
      <i className="timeline-dot" />
      {photoMeta && logId ? <EntryPhotoThumb profileId={profileId} logId={logId} meta={photoMeta} /> : null}
      <div className="meal-meta">
        <span className="logged-volume">Logged today · {meal ? "1 meal" : `${food.amount} ${food.unit}${food.amount === 1 ? "" : food.unit === "piece" || food.unit === "serving" || food.unit === "scoop" || food.unit === "pack" ? "s" : ""}`}</span>
        <strong>{meal ? meal.name : foodLabel(food)}</strong>
        <small>{food.protein.toFixed(1)}P · {food.carbs.toFixed(1)}C · {food.fat.toFixed(1)}F · fibre {fiberLabel(food)}</small>
        {meal ? <button className="meal-expand-button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? "Hide items" : `Show ${meal.components.length} item${meal.components.length === 1 ? "" : "s"}`}</button> : null}
        {expanded && meal ? <div className="logged-meal-components">{meal.components.map((component, componentIndex) => <div key={`${component.id}-${componentIndex}`}><span><b>{component.amount} {component.unit}</b>{foodLabel(component)}</span><strong>{Math.round(component.calories)} kcal</strong></div>)}</div> : null}
      </div>
      <div className="entry-actions"><b>{Math.round(food.calories)} kcal</b><div className="entry-buttons"><button onClick={() => onEdit(index)}>Edit</button><button className="entry-delete" onClick={() => onDelete(index)} aria-label={`Remove ${meal?.name ?? foodLabel(food)} from today’s diary`}>Remove</button></div></div>
    </article>
  );
}

function TodayView({ clock, profileName, calories, macros, entries, quickFoods, weights, hasCardIqImport, targets, targetsAreDefaults, history, profileId, photoIndex, onLog, onAdd, onEdit, onDelete, onSaveWeight, onDeleteWeight, onOpenMeals, onSaveTargets }: {
  clock: DashboardClock;
  profileName: string;
  calories: number;
  macros: Record<MacroKey, number>;
  entries: LoggedDisplayEntry[];
  quickFoods: Food[];
  weights: WeightEntry[];
  hasCardIqImport: boolean;
  targets: SavedTargets;
  targetsAreDefaults: boolean;
  history: DaySummary[];
  profileId: string;
  photoIndex: PhotoIndex;
  onLog: () => void;
  onAdd: (food: Food) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onSaveWeight: (entry: WeightEntry) => void;
  onDeleteWeight: (date: string) => void;
  onOpenMeals: () => void;
  onSaveTargets: (next: TargetValues) => void;
}) {
  const [editingTargets, setEditingTargets] = useState(false);
  const runway = getEnergyRunway(calories, targets.calories);
  const circleProgress = Math.min(100, runway.percentage);
  const circleStyle = { "--energy-progress": `${circleProgress * 3.6}deg` } as CSSProperties;
  const targetWord = targetsAreDefaults ? "placeholder target" : "target";
  const description = calories === 0
    ? "Nothing is assumed. Start by logging what you actually ate today."
    : `You’ve logged ${Math.round(calories).toLocaleString("en-IN")} kcal today. Add or edit foods whenever you need.`;

  // The strip shows the last seven Bangalore days including today. A day with no diary is
  // drawn as a gap, never as a zero, because not logging is not the same as not eating.
  const weekKeys = recentDayKeys(clock.dayKey, 7);
  const week = weekKeys.map((dayKey) => {
    const logged = dayKey === clock.dayKey ? { dayKey, calories, entryCount: entries.length } : history.find((day) => day.dayKey === dayKey);
    return { dayKey, calories: logged?.calories ?? null, isToday: dayKey === clock.dayKey };
  });
  const weekLogged = week.filter((day) => day.calories !== null);
  const weekAverage = weekLogged.length > 0 ? Math.round(weekLogged.reduce((sum, day) => sum + (day.calories ?? 0), 0) / weekLogged.length) : null;
  const weekPeak = Math.max(targets.calories, ...weekLogged.map((day) => day.calories ?? 0));

  return (
    <>
      <SectionHeading
        eyebrow={clock.dateLabel}
        title={`${clock.greeting}, ${profileName.split(/\s+/)[0]}`}
        description={description}
        action={<button className="button primary" onClick={onLog}><span>＋</span> Log food</button>}
      />

      {editingTargets ? <TargetEditor profileName={profileName} targets={targets} isDefault={targetsAreDefaults} onSave={(next) => { onSaveTargets(next); setEditingTargets(false); }} onCancel={() => setEditingTargets(false)} /> : null}

      <div className="today-layout">
        <section className="energy-card dark-card">
          <div className="card-kicker"><span>Daily energy</span><div><span className={`status-pill ${runway.isOver ? "over" : ""}`}>{runway.isOver ? `Over ${targetWord}` : targetsAreDefaults ? "Placeholder target" : "On plan"}</span><button className="target-change-button" onClick={() => setEditingTargets((value) => !value)}>{editingTargets ? "Close targets" : "Change target"}</button></div></div>
          <div className="energy-main">
            <div className="energy-ring" style={circleStyle} role="progressbar" aria-label={`${calories} of ${targets.calories} calories eaten`} aria-valuenow={calories} aria-valuemin={0} aria-valuemax={targets.calories}>
              <div><strong>{Math.round(calories).toLocaleString("en-IN")}</strong><span>kcal eaten</span></div>
            </div>
            <div className="runway">
              <span>{runway.isOver ? `Above ${targetWord}` : `To ${targetWord}`}</span>
              <strong>{runway.amount.toLocaleString("en-IN")}</strong>
              <small>{runway.isOver ? "kcal over" : "kcal remaining"}</small>
              <p>{runway.percentage}% of your {targets.calories.toLocaleString("en-IN")} kcal {targetWord}</p>
              <button className="button orange" onClick={onLog}>＋ Log food</button>
            </div>
          </div>
          <div className="macro-stack dark-macros">
            <span className="sample-context">{targetsAreDefaults ? "Placeholder targets · set your own" : `${profileName}’s personal targets`} <button className="text-button inline" onClick={() => setEditingTargets((value) => !value)}>Adjust targets</button></span>
            <MacroBar label="Protein" value={macros.protein} target={targets.protein} tone="protein" />
            <MacroBar label="Carbs" value={macros.carbs} target={targets.carbs} tone="carbs" />
            <MacroBar label="Fat" value={macros.fat} target={targets.fat} tone="fat" />
          </div>
        </section>

        <section className="timeline-panel">
          <div className="section-title-row">
            <div><span className="eyebrow">Food diary</span><h2>Today’s timeline</h2></div>
            <span className="soft-badge">{entries.length} {entries.length === 1 ? "entry" : "entries"} logged</span>
          </div>
          <div className={`meal-timeline ${entries.length > 1 ? "connected" : ""}`}>
            {entries.length === 0 ? <div className="timeline-empty"><strong>No food logged yet</strong><span>Your actual entries—and only your actual entries—will appear here.</span><button className="text-button" onClick={onLog}>Log your first food</button></div> : entries.map((entry, index) => <DiaryEntryRow entry={entry} index={index} profileId={profileId} photoIndex={photoIndex} onEdit={onEdit} onDelete={onDelete} key={`${entry.logIndex}-${entry.food.id}`} />)}
          </div>
        </section>

        <aside className="today-rail">
          <WeightCard dayKey={clock.dayKey} entries={weights} onSave={onSaveWeight} onDelete={onDeleteWeight} />
          <section className="quick-card surface-card">
            <div className="section-title-row"><div><span className="eyebrow">{hasCardIqImport ? "From cardIQ" : "One tap"}</span><h2>Quick add</h2></div><button className="text-button" onClick={onLog}>See all</button></div>
            <div className="quick-grid">
              {quickFoods.slice(0, 4).map((food) => (
                <button key={food.id} onClick={() => onAdd(food)}><span>{food.name}</span><b>＋</b></button>
              ))}
            </div>
          </section>
          <section className="nudge-card dark-card">
            <span className="eyebrow bright">Sample meal idea · not logged</span>
            <h2>{suggestedMeal.name}</h2>
            <p>A researched example with {suggestedMeal.protein} g protein and {suggestedMeal.fiber} g fibre for {suggestedMeal.calories} kcal. Browse it before choosing anything.</p>
            <button className="button lime" onClick={onOpenMeals}>Browse meals <span>→</span></button>
          </section>
          <section className="week-card surface-card">
            <div className="section-title-row"><div><span className="eyebrow">Last 7 days · your diary</span><h2>Energy rhythm</h2></div>{weekAverage !== null ? <strong>{weekAverage.toLocaleString("en-IN")} <small>avg of {weekLogged.length}</small></strong> : null}</div>
            {weekLogged.length === 0 ? (
              <p className="week-empty">Nothing logged in the last seven days yet. This fills in as you log.</p>
            ) : (
              <>
                <div className="mini-bars" role="img" aria-label={`Calories logged on ${weekLogged.length} of the last 7 days`}>
                  {week.map((day) => (
                    <span key={day.dayKey} className={`${day.isToday ? "active" : ""} ${day.calories === null ? "no-data" : ""}`} style={{ height: day.calories === null ? "4%" : `${Math.max(4, Math.round((day.calories / weekPeak) * 100))}%` }}>
                      <i>{new Date(`${day.dayKey}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" })}</i>
                    </span>
                  ))}
                </div>
                {weekLogged.length < 7 ? <small className="week-note">{7 - weekLogged.length} of these days have no diary. They are shown as gaps, not as zero.</small> : null}
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function HistoryView({ history, clock, targets, entriesFor, profileId, photoIndex, onDeleteEntry, onDeleteDay }: {
  history: DaySummary[];
  clock: DashboardClock;
  targets: typeof DEFAULT_TARGETS;
  entriesFor: (dayKey: string) => LoggedDisplayEntry[];
  profileId: string;
  photoIndex: PhotoIndex;
  onDeleteEntry: (dayKey: string, logIndex: number, label: string) => void;
  onDeleteDay: (dayKey: string) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(history[0]?.dayKey ?? null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const monthPrefix = clock.dayKey.slice(0, 7);
  const [year, month] = monthPrefix.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // Monday-first
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => {
    const dayKey = `${monthPrefix}-${String(index + 1).padStart(2, "0")}`;
    return { day: index + 1, dayKey, summary: history.find((entry) => entry.dayKey === dayKey) ?? null, isFuture: dayKey > clock.dayKey };
  });
  // Falling back to the newest day matters once days can be deleted: the panel would
  // otherwise go blank and stay blank the moment KP removes whichever day he was reading.
  const selected = history.find((day) => day.dayKey === selectedKey) ?? history[0] ?? null;
  const monthLabel = new Date(`${monthPrefix}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  if (history.length === 0) {
    return (
      <>
        <SectionHeading eyebrow="Track · History" title="Your history starts today" description="Every day you log is kept here from now on. Nothing is invented and no day is filled in for you." action={<span className="prototype-badge">0 days recorded</span>} />
        <div className="empty-state">
          <strong>No completed days yet.</strong>
          <span>Today’s diary appears here once the Bangalore day rolls over. Days you don’t log stay blank rather than counting as zero.</span>
        </div>
      </>
    );
  }

  return (
    <>
      <SectionHeading eyebrow="Track · History" title={`${history.length} ${history.length === 1 ? "day" : "days"} recorded`} description="Only days you actually logged appear. A blank day means no diary was kept, not a day without food." action={<span className="prototype-badge">Your data</span>} />
      <div className="history-layout">
        <section className="surface-card calendar-card">
          <div className="section-title-row"><div><span className="eyebrow">{monthLabel}</span><h2>Days you logged</h2></div><div className="legend"><i /> Within {Math.round(targets.calories * 0.08)} kcal <i /> Outside</div></div>
          <div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}</div>
          <div className="month-grid">
            {Array.from({ length: firstWeekday }, (_, index) => <i key={`pad-${index}`} className="month-pad" />)}
            {monthDays.map((item) => {
              const state = !item.summary ? "no-data" : Math.abs(item.summary.calories - targets.calories) <= targets.calories * 0.08 ? "within" : item.summary.calories > targets.calories ? "over" : "under";
              return (
                <button key={item.dayKey} className={`${state} ${selectedKey === item.dayKey ? "selected" : ""}`} disabled={!item.summary} onClick={() => setSelectedKey(item.dayKey)} aria-pressed={selectedKey === item.dayKey} aria-label={item.summary ? `${item.day} ${monthLabel}: ${Math.round(item.summary.calories)} kcal` : `${item.day} ${monthLabel}: nothing logged`}>
                  <span>{item.day}</span>
                  {item.summary ? <><b>{Math.round(item.summary.calories)}</b><small>kcal</small></> : <small className="no-data-mark">{item.isFuture ? "" : "—"}</small>}
                </button>
              );
            })}
          </div>
        </section>
        <aside className="history-detail dark-card">
          {selected ? (
            <>
              <span className="eyebrow bright">{new Date(`${selected.dayKey}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</span>
              <h2>{Math.round(selected.calories).toLocaleString("en-IN")} <small>kcal</small></h2>
              <p className="history-message">{selected.entryCount} {selected.entryCount === 1 ? "item" : "items"} logged{selected.unresolvedCount > 0 ? ` · ${selected.unresolvedCount} entry could not be resolved, so this total is incomplete` : ""}.</p>
              <div className="history-metrics">
                <div><span>Protein</span><strong>{selected.protein.toFixed(1)} g</strong></div>
                <div><span>Carbs</span><strong>{selected.carbs.toFixed(1)} g</strong></div>
                <div><span>Fat</span><strong>{selected.fat.toFixed(1)} g</strong></div>
                <div><span>Fibre</span><strong>{selected.fiberUnknownEntries > 0 ? `${selected.fiber.toFixed(1)} g known` : `${selected.fiber.toFixed(1)} g`}</strong>{selected.fiberUnknownEntries > 0 ? <small>{selected.fiberUnknownEntries} item{selected.fiberUnknownEntries === 1 ? "" : "s"} not declared</small> : null}</div>
              </div>
              <span className="sample-note">Against your {targets.calories.toLocaleString("en-IN")} kcal target: {selected.calories > targets.calories ? `${Math.round(selected.calories - targets.calories).toLocaleString("en-IN")} kcal over` : `${Math.round(targets.calories - selected.calories).toLocaleString("en-IN")} kcal under`}.</span>
              {/* A past day was read-only until now, so one mistyped entry stayed wrong for ever. */}
              <ul className="history-entry-list">
                {entriesFor(selected.dayKey).map((entry) => (
                  <li key={`${entry.logIndex}-${entry.food.id}`}>
                    {entry.logId && photoIndex[entry.logId] ? <EntryPhotoThumb profileId={profileId} logId={entry.logId} meta={photoIndex[entry.logId]} /> : null}
                    <span>{entry.meal?.name ?? foodLabel(entry.food)}</span>
                    <strong>{Math.round(entry.food.calories)} kcal</strong>
                    <button onClick={() => entry.logIndex !== undefined && onDeleteEntry(selected.dayKey, entry.logIndex, entry.meal?.name ?? foodLabel(entry.food))} aria-label={`Remove ${entry.meal?.name ?? foodLabel(entry.food)} from ${selected.dayKey}`}>×</button>
                  </li>
                ))}
              </ul>
              {confirmingDelete === selected.dayKey ? (
                <div className="history-delete-confirm" role="group" aria-label={`Confirm deleting ${selected.dayKey}`}>
                  <span>Delete this whole day? {selected.entryCount} {selected.entryCount === 1 ? "entry goes" : "entries go"} with it.</span>
                  <div><button className="button danger" onClick={() => { onDeleteDay(selected.dayKey); setConfirmingDelete(null); }}>Delete the day</button><button className="text-button bright" onClick={() => setConfirmingDelete(null)}>Cancel</button></div>
                </div>
              ) : (
                <button className="text-button bright danger" onClick={() => setConfirmingDelete(selected.dayKey)}>Delete this whole day</button>
              )}
            </>
          ) : (
            <>
              <span className="eyebrow bright">No day selected</span>
              <h2>Pick a day</h2>
              <p className="history-message">Days with a diary are selectable. Blank days were never logged.</p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function TrendsView({ history, targets }: { history: DaySummary[]; targets: typeof DEFAULT_TARGETS }) {
  const ranges = [7, 30, 90] as const;
  const [range, setRange] = useState<(typeof ranges)[number]>(30);
  const window = summariseTrend(history, range, targets.calories);
  const bars = history.slice(0, range).reverse();
  const peak = Math.max(targets.calories, ...bars.map((day) => day.calories));

  return (
    <>
      <SectionHeading
        eyebrow="Track · Trends"
        title="Your rhythm, not a report card"
        description="Averages count only the days you actually logged. A day without a diary is never treated as a day without food."
        action={<div className="segmented compact">{ranges.map((value) => <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{value}D</button>)}</div>}
      />
      {window.average === null ? (
        <div className="empty-state">
          <strong>Nothing logged in the last {range} days.</strong>
          <span>Trends appear once there are real days to compare. Nourish will not draw a chart out of nothing.</span>
        </div>
      ) : (
        <div className="trends-grid">
          <section className="surface-card calorie-trend">
            <div className="section-title-row"><div><span className="eyebrow">Daily energy · last {range} days</span><h2>Average {Math.round(window.average.calories).toLocaleString("en-IN")} kcal</h2></div><span className="soft-badge">{window.loggedDays} of {range} days logged</span></div>
            <div className="trend-chart" role="img" aria-label={`Calories across ${window.loggedDays} logged days, averaging ${Math.round(window.average.calories)}`}>
              <i className="target-line" style={{ bottom: `${Math.round((targets.calories / peak) * 100)}%` }}><span>{targets.calories.toLocaleString("en-IN")} target</span></i>
              {bars.map((day) => <span key={day.dayKey} title={`${formatShortDate(day.dayKey)}: ${Math.round(day.calories).toLocaleString("en-IN")} kcal`} style={{ height: `${Math.max(3, Math.round((day.calories / peak) * 100))}%` }} />)}
            </div>
            <div className="chart-axis"><span>{formatShortDate(bars[0]?.dayKey)}</span><span>{formatShortDate(bars[bars.length - 1]?.dayKey)}</span></div>
          </section>
          <section className="trend-insight dark-card">
            <span className="eyebrow bright">Average macros per logged day</span>
            <h2>{Math.round(window.average.protein)} g protein</h2>
            <p>{Math.round(window.average.carbs)} g carbs · {Math.round(window.average.fat)} g fat · {Math.round(window.average.fiber)} g known fibre, averaged across {window.loggedDays} {window.loggedDays === 1 ? "day" : "days"}{window.fiberUnknownDays > 0 ? `; ${window.fiberUnknownDays} ${window.fiberUnknownDays === 1 ? "day includes" : "days include"} food whose fibre was not declared` : ""}.</p>
            <div className="insight-number"><strong>{window.average.protein >= targets.protein ? "On target" : `${Math.round(targets.protein - window.average.protein)} g short`}</strong><span>against your {targets.protein} g protein target.</span></div>
          </section>
          <section className="surface-card macro-average">
            <span className="eyebrow">Energy split</span><h2>Where the calories came from</h2>
            <div className="macro-legend">
              {(() => {
                const energy = window.average.protein * 4 + window.average.carbs * 4 + window.average.fat * 9;
                const share = (grams: number, factor: number) => energy > 0 ? Math.round((grams * factor / energy) * 100) : 0;
                return <>
                  <span><i className="protein" />Protein <b>{share(window.average.protein, 4)}%</b></span>
                  <span><i className="carbs" />Carbs <b>{share(window.average.carbs, 4)}%</b></span>
                  <span><i className="fat" />Fat <b>{share(window.average.fat, 9)}%</b></span>
                </>;
              })()}
            </div>
          </section>
          <section className="surface-card consistency-card">
            <span className="eyebrow">Consistency</span>
            <h2>{window.daysOnTarget ?? 0} of {window.loggedDays} logged days</h2>
            <p>landed within 8% of your {targets.calories.toLocaleString("en-IN")} kcal target.</p>
            <div className="dot-field">{bars.map((day) => <i key={day.dayKey} className={Math.abs(day.calories - targets.calories) <= targets.calories * 0.08 ? "hit" : "miss"} />)}</div>
          </section>
        </div>
      )}
    </>
  );
}

function PurchasesView({ onAdd, onCreateFromPurchase, cardIqImport }: { onAdd: (food: Food) => void; onCreateFromPurchase: (name: string) => void; cardIqImport: CardIqFoodImport | null }) {
  const [filter, setFilter] = useState<"All" | "Needs review">("All");
  const purchaseItems = (cardIqImport?.items ?? []).map((item) => {
    const food = item.matchedFoodId ? foods.find((candidate) => candidate.id === item.matchedFoodId) ?? null : null;
    return { ...item, food, match: food ? "Matched" as const : "Review" as const, cal: food ? `${Math.round(food.calories)} kcal / ${food.amount} ${food.unit}` : "Exact pack label needed" };
    // matchKind answers "is this the right product?"; source.trust answers "how good is this
    // number?". Both are shown, because a confident identity on a mirrored panel is not the
    // same as a confident identity on the pack's own label.
  });
  const shown = filter === "Needs review" ? purchaseItems.filter((item) => item.match === "Review") : purchaseItems;
  const stores = ["Instamart", "Amazon", "BigBasket"] as const;
  return (
    <>
      <SectionHeading eyebrow="Track · Purchases" title="Your food shelf, already waiting" description={cardIqImport ? `Your actual food products from the last year of cardIQ orders. Matched foods are ready to log; the rest wait for an exact nutrition label.` : "Run the local cardIQ import to bring your real orders here. No order history is stored in Git."} action={<span className="prototype-badge">{cardIqImport ? `Synced ${cardIqImport.generatedAt.slice(0, 10)}` : "Local import needed"}</span>} />
      <div className="purchase-summary">
        {stores.map((name, index) => {
          const items = purchaseItems.filter((item) => item.store === name);
          const ready = items.filter((item) => item.food).length;
          // SPEC §4.7: Amazon's export does not identify the Now channel, so the app must
          // say so rather than imply a certainty the data does not support.
          const label = name === "Amazon" ? "Amazon — channel unconfirmed" : name;
          return <section className={`source-card dark-card ${["lime", "orange", "cream"][index]}`} key={name}><span>{label}</span><strong>{items.length}</strong><small>food products in the last year</small><i>{ready} nutrition-ready</i></section>;
        })}
      </div>
      <section className="surface-card purchase-table-card">
        <div className="section-title-row"><div><span className="eyebrow">Personal catalogue</span><h2>Recently purchased foods</h2></div><div className="table-actions"><button className={`chip ${filter === "All" ? "active" : ""}`} onClick={() => setFilter("All")}>All</button><button className={`chip ${filter === "Needs review" ? "active" : ""}`} onClick={() => setFilter("Needs review")}>Needs review</button></div></div>
        <div className="purchase-table">
          <div className="purchase-row header"><span>Item</span><span>Store</span><span>Nutrition</span><span>Status</span><span /></div>
          {shown.map((item) => <div className="purchase-row" key={`${item.store}-${item.name}`}><span className="purchase-name"><b>{item.name}</b><small>{item.orderCount} order{item.orderCount === 1 ? "" : "s"} · last {item.lastOrdered}</small></span><span><em>{item.store}</em></span><span className="purchase-nutrition">{item.cal}{item.food ? <small>{item.food.source.trust}</small> : null}</span><span><i className={item.match === "Matched" ? "matched" : "review"}>{item.food ? item.matchKind ?? item.match : "Needs label"}</i></span><span>{item.food ? <button aria-label={`Quick add ${item.name}`} onClick={() => onAdd(item.food)}>＋</button> : <button className="text-button" aria-label={`Add exact label details for ${item.name}`} onClick={() => onCreateFromPurchase(item.name)}>Add details</button>}</span></div>)}
          {shown.length === 0 ? <div className="empty-state"><strong>{cardIqImport ? "Nothing in this view." : "Your cardIQ food snapshot is not here yet."}</strong><span>{cardIqImport ? "Try the other filter." : "The importer keeps your personal purchase history on this Mac only."}</span></div> : null}
        </div>
      </section>
    </>
  );
}

function PlanSummary({ entries, onRemove }: { entries: PlannedEntry[]; onRemove: (index: number) => void }) {
  const totals = entries.reduce((sum, entry) => ({ calories: sum.calories + entry.calories, protein: sum.protein + entry.protein, carbs: sum.carbs + entry.carbs, fat: sum.fat + entry.fat, fiber: sum.fiber + entry.fiber }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const hasUndeclaredFiber = entries.some((entry) => entry.fiberDeclared === false);
  return (
    <section className="plan-summary dark-card">
      <div><span className="eyebrow bright">Today’s draft</span><h2>{entries.length ? `${Math.round(totals.calories).toLocaleString("en-IN")} kcal planned` : "Build from items or meals"}</h2><p>{entries.length ? `${totals.protein.toFixed(1)}P · ${totals.carbs.toFixed(1)}C · ${totals.fat.toFixed(1)}F · ${totals.fiber.toFixed(1)}g ${hasUndeclaredFiber ? "known " : ""}fibre${hasUndeclaredFiber ? " + undeclared" : ""}` : "Anything you add from either Plan section lands in one shared draft."}</p></div>
      <div className="plan-summary-items">{entries.length ? entries.map((entry, index) => <span key={`${entry.id}-${index}`}><b>{entry.name}</b><small>{entry.serving}</small><button onClick={() => onRemove(index)} aria-label={`Remove ${entry.name} from plan`}>×</button></span>) : <span className="plan-empty-pill">Your selections will appear here</span>}</div>
    </section>
  );
}

function RecipeCard({ recipe, onOpen, onPlan }: { recipe: Recipe; onOpen: (recipe: Recipe) => void; onPlan: (recipe: Recipe) => void }) {
  return (
    <article className="recipe-card">
      <button className={`recipe-art ${recipe.art}`} onClick={() => onOpen(recipe)} aria-label={`Open ${recipe.name}`}><span>{recipe.protein}g protein</span><i /><b>{recipe.time}</b></button>
      <div className="recipe-copy">
        <div className="recipe-tags">{recipe.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
        <button className="recipe-title" onClick={() => onOpen(recipe)}>{recipe.name}</button>
        <div className="recipe-macros"><strong>{recipe.calories} <small>kcal</small></strong><span>{recipe.protein}P</span><span>{recipe.carbs}C</span><span>{recipe.fat}F</span><span>{recipe.fiber} fibre</span></div>
        <div className="fullness-line" title="Estimated from protein, fibre and energy density"><i className="fullness-track"><span style={{ width: `${estimateSatiety(recipe)}%` }} /></i><small>{satietyLabel(estimateSatiety(recipe))} · est. {estimateSatiety(recipe)}/100</small></div>
        <button className="button secondary full recipe-plan-button" onClick={() => onPlan(recipe)}>＋ Add meal to plan</button>
      </div>
    </article>
  );
}

/**
 * The same FoodDetailsEditor the logger uses, lifted into its own dialog so Plan
 * can create and correct foods without going through Track. One editing surface,
 * two doors into it — a second form would be a second set of validation rules.
 */
function PlanFoodEditor({ initial, initialName = "", copying = false, profileId, onClose, onSave }: { initial: Food | null; initialName?: string; copying?: boolean; profileId: string; onClose: () => void; onSave: (food: Food, isNew: boolean) => void }) {
  const creating = initial === null || copying;
  // Editing a researched food forks a personal copy rather than rewriting the
  // catalogue entry, which is what forkFoodForEdit already guarantees for Track.
  const [draft, setDraft] = useState<Food>(() => {
    if (!initial) return blankFood(initialName);
    const forked = forkFoodForEdit(initial, freshUnique());
    // A managed photo is mutable server data. A copy must start without it so
    // replacing or deleting the copy can never alter the original thumbnail.
    const imageUrl = foodPhotoKeyFromUrl(forked.imageUrl) ? undefined : forked.imageUrl;
    const { imageUrl: _managedOrExternalImage, ...withoutImage } = forked;
    return { ...withoutImage, name: copying ? `${forked.name} copy` : forked.name, ...(imageUrl ? { imageUrl } : {}) };
  });
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="food-dialog plan-food-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-food-editor-title">
        <header>
          <div><span className="eyebrow">Plan · Items</span><h2 id="plan-food-editor-title">{copying ? "Copy Single Item" : creating ? "Add a Single Item" : "Edit Single Item"}</h2></div>
          <button className="close-button" onClick={onClose} aria-label={creating ? "Close new item" : "Close item editor"}>×</button>
        </header>
        <div className="plan-food-dialog-body quantity-editor dark-card">
          <FoodDetailsEditor
            profileId={profileId}
            draft={draft}
            setDraft={setDraft}
            draftIsNew={creating}
            saveToLibrary
            setSaveToLibrary={() => undefined}
            onCancel={onClose}
            onSave={() => { if (isFoodDetailsValid(draft)) onSave(draft, creating); }}
            submitLabel={creating ? "Add to my items" : "Save changes"}
          />
        </div>
      </section>
    </div>
  );
}

function ItemsView({ planned, catalog, onPlan, onRemove, onCreate, onEdit, onCopy, onDelete }: {
  planned: PlannedEntry[];
  catalog: Food[];
  onPlan: (food: Food) => void;
  onRemove: (index: number) => void;
  onCreate: () => void;
  onEdit: (food: Food) => void;
  onCopy: (food: Food) => void;
  onDelete: (food: Food) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortByFullness, setSortByFullness] = useState(false);
  const query = search.trim().toLowerCase();
  // The live catalogue, not the frozen researched list: anything KP adds while
  // logging has to be here too, or Plan and Track disagree about what exists.
  const singleItems = catalog.filter((food) => food.category !== "Meal" && food.category !== "Composite");
  const matched = singleItems.filter((food) => (filter === "All" || (filter === "Yours" ? isOwnedFood(food) : food.category === filter)) && (!query || [food.name, food.brand, ...food.aliases].filter(Boolean).join(" ").toLowerCase().includes(query)));
  const shown = sortByFullness ? [...matched].sort((a, b) => estimateSatiety(b) - estimateSatiety(a) || b.protein - a.protein) : matched;
  return (
    <>
      <SectionHeading eyebrow="Plan · Items" title="Start with the exact thing" description="Search products you buy and raw ingredients you can find around Bengaluru. Anything missing you can add here, and it is ready to log in Track straight away." action={<div className="heading-buttons"><span className="prototype-badge">{singleItems.length} items</span><button className="button primary" onClick={onCreate}>＋ New item</button></div>} />
      <PlanSummary entries={planned} onRemove={onRemove} />
      <section className="item-search-hero surface-card">
        <div className="catalogue-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search products and ingredients" placeholder="Search Nandini milk, chia, chicken, paneer…" /></div>
        <div className="filter-row" aria-label="Item filters">
          {(["All", "Yours", "Ordered", "Product", "Ingredient", "OrderedFood"] as const).map((item) => <button className={`chip ${filter === item ? "active" : ""}`} key={item} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item === "OrderedFood" ? "Ready meals" : item}</button>)}
          <button className={`chip ${sortByFullness ? "active" : ""}`} onClick={() => setSortByFullness((value) => !value)} aria-pressed={sortByFullness}>Most filling first</button>
        </div>
      </section>
      <div className="item-catalogue-grid">{shown.map((food) => <article className="item-card surface-card" key={food.id}>
        <div className="item-card-head"><span className={`trust-mark ${food.source.trust === "Label mirror" ? "review" : ""}`}>{food.source.trust}</span>{isOwnedFood(food) ? <span className="owned-tag">Yours</span> : null}{food.category === "OrderedFood" ? <span className="owned-tag ready">Ready meal</span> : null}<small>{food.availability}</small></div>
        <div><span className="item-brand">{food.brand ?? food.category}</span><h2>{food.name}</h2><p>Per {food.amount} {food.unit}</p></div>
        <div className="item-nutrition"><strong>{Math.round(food.calories)}<small> kcal</small></strong><span>{food.protein}g <small>protein</small></span><span>{food.carbs}g <small>carbs</small></span><span>{food.fat}g <small>fat</small></span><span>{food.fiberDeclared === false ? "—" : `${food.fiber}g`} <small>{food.fiberDeclared === false ? "fibre not declared" : "fibre"}</small></span></div>
        <div className="fullness-line" title="Estimated from protein, fibre and energy density"><i className="fullness-track"><span style={{ width: `${estimateSatiety(food)}%` }} /></i><small>{satietyLabel(estimateSatiety(food))} · est. {estimateSatiety(food)}/100</small></div>
        <div className="item-card-actions">{food.source.url ? <a href={food.source.url} target="_blank" rel="noreferrer">Source ↗</a> : <span className="personal-source">{food.source.label}</span>}<button className="text-button" onClick={() => onEdit(food)}>Edit</button><button className="text-button" onClick={() => onCopy(food)}>Copy</button>{isOwnedFood(food) ? <button className="text-button danger" onClick={() => onDelete(food)} aria-label={`Delete ${foodLabel(food)}`}>Delete</button> : null}<button className="button primary" onClick={() => onPlan(food)}>＋ Plan this</button></div>
      </article>)}</div>
      {shown.length === 0 ? <div className="empty-state"><strong>No item matches yet.</strong><span>Try a broader name, or add the exact thing in your kitchen.</span><div className="empty-actions"><button className="button secondary" onClick={() => { setSearch(""); setFilter("All"); }}>Clear search</button><button className="button primary" onClick={onCreate}>＋ New item</button></div></div> : null}
      <div className="research-footnote"><span>Research base</span><a href={SOURCE_LINKS.ifct} target="_blank" rel="noreferrer">ICMR–NIN IFCT</a><a href={SOURCE_LINKS.usda} target="_blank" rel="noreferrer">USDA FoodData Central</a><a href={SOURCE_LINKS.fssai} target="_blank" rel="noreferrer">FSSAI labelling</a></div>
    </>
  );
}

/** A blank or non-numeric box means "no bound", not zero. */
function boundFrom(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function TargetFilters({ target, onChange, onClear }: { target: Record<"maxCalories" | "minProtein" | "maxProtein", string>; onChange: (key: "maxCalories" | "minProtein" | "maxProtein", value: string) => void; onClear: () => void }) {
  const fields: Array<{ key: "maxCalories" | "minProtein" | "maxProtein"; label: string; suffix: string; placeholder: string }> = [
    { key: "maxCalories", label: "Calories at most", suffix: "kcal", placeholder: "500" },
    { key: "minProtein", label: "Protein at least", suffix: "g", placeholder: "50" },
    { key: "maxProtein", label: "Protein at most", suffix: "g", placeholder: "70" },
  ];
  const active = fields.some((field) => target[field.key].trim() !== "");
  return (
    <section className="target-filters surface-card" aria-label="Nutrition target">
      <div className="target-filters-head">
        <div><span className="eyebrow">Fit my numbers</span><h2>Set a calorie ceiling and a protein window</h2></div>
        {active ? <button className="text-button" onClick={onClear}>Clear numbers</button> : null}
      </div>
      <div className="target-fields">
        {fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <div><input type="number" min={0} inputMode="numeric" value={target[field.key]} placeholder={field.placeholder} onChange={(event) => onChange(field.key, event.target.value)} /><i>{field.suffix}</i></div>
          </label>
        ))}
      </div>
    </section>
  );
}

function MealsView({ onRecipe, planned, catalog, userMeals, onPlan, onPlanFood, onRemove, onCreateMeal, onEditMeal, onCopyMeal, onDeleteMeal }: {
  onRecipe: (recipe: Recipe) => void;
  planned: PlannedEntry[];
  catalog: Food[];
  userMeals: UserMeal[];
  onPlan: (recipe: Recipe) => void;
  onPlanFood: (food: Food) => void;
  onRemove: (index: number) => void;
  onCreateMeal: () => void;
  onEditMeal: (meal: UserMeal) => void;
  onCopyMeal: (meal: UserMeal) => void;
  onDeleteMeal: (meal: UserMeal) => void;
}) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState({ maxCalories: "", minProtein: "", maxProtein: "" });
  const [sortByFullness, setSortByFullness] = useState(false);
  const bounds: NutritionTarget = { maxCalories: boundFrom(target.maxCalories), minProtein: boundFrom(target.minProtein), maxProtein: boundFrom(target.maxProtein) };
  const query = search.trim().toLowerCase();
  const matchesText = (food: Food) => !query || [food.name, food.brand, food.variant, ...food.aliases].join(" ").toLowerCase().includes(query);
  // KP's own saved meals, shown as meals rather than buried in the logger.
  const ownMeals = userMeals
    .map((meal) => ({ meal, food: userMealToNutritionItem(meal) }))
    .filter(({ food }) => matchesText(food) && matchesNutritionTarget(food, bounds));
  // A ready-to-eat pack carries one nutrition label, so it stays a product —
  // but it is eaten as a meal, so it belongs in this list too.
  const preparedMeals = catalog.filter((food) => food.category === "OrderedFood" && matchesText(food) && matchesNutritionTarget(food, bounds));
  const matched = recipes.filter((recipe) => matchesRecipe(recipe, search, filter) && matchesNutritionTarget(recipe, bounds));
  const shown = sortByFullness
    ? [...matched].sort((a, b) => estimateSatiety(b) - estimateSatiety(a) || b.protein - a.protein)
    : matched;
  return (
    <>
      <SectionHeading eyebrow="Plan · Meals" title="Healthy food with actual receipts" description="Creative Indian-first meals calculated from weighed ingredients, with cooking oil counted and the evidence trail kept visible." action={<div className="heading-buttons"><span className="prototype-badge">{recipes.length + ownMeals.length + preparedMeals.length} meals</span><button className="button primary" onClick={onCreateMeal}>＋ New meal</button></div>} />
      <PlanSummary entries={planned} onRemove={onRemove} />
      <section className="discover-hero dark-card">
        <div><span className="eyebrow bright">Curated in Bengaluru</span><h2>Joy first.<br />Numbers intact.</h2><p>Brownies, chia bowls, paneer, rajma and cauliflower rice—built from ingredients you can realistically source in India.</p></div>
        <div className="hero-search"><label htmlFor="recipe-search">What do you feel like eating?</label><div><span>⌕</span><input id="recipe-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brownies, chia, chicken, breakfast…" /></div></div>
        <div className="hero-stat"><strong>{recipes.filter((recipe) => recipe.tags.includes("High protein")).length}</strong><span>meals with at least<br />25 g protein</span></div>
      </section>
      <TargetFilters target={target} onChange={(key, value) => setTarget((current) => ({ ...current, [key]: value }))} onClear={() => setTarget({ maxCalories: "", minProtein: "", maxProtein: "" })} />
      <div className="filter-row meal-filter-row" aria-label="Meal filters">
        {["All", "High protein", "Low fat", "High fibre", "Vegetarian", "Vegan", "30 min or less"].map((item) => <button className={`chip ${filter === item ? "active" : ""}`} key={item} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>)}
        <button className={`chip ${sortByFullness ? "active" : ""}`} onClick={() => setSortByFullness((value) => !value)} aria-pressed={sortByFullness}>Most filling first</button>
      </div>
      <div className="filter-definition"><span><b>High protein</b> 25g+</span><span><b>Low fat</b> ≤10g</span><span><b>High fibre</b> 8g+</span><small>Transparent app filters, not regulatory label claims.</small></div>
      <div className="result-count">{shown.length} of {recipes.length} meals{hasNutritionTarget(bounds) ? " fit your numbers" : ""}</div>
      {ownMeals.length > 0 || preparedMeals.length > 0 ? (
        <section className="own-meals">
          <div className="section-title-row"><div><span className="eyebrow">Yours and ready to eat</span><h2>{ownMeals.length} saved · {preparedMeals.length} ready meals</h2></div></div>
          <div className="own-meal-grid">
            {ownMeals.map(({ meal, food }) => (
              <article className="own-meal-card surface-card" key={meal.id}>
                <div className="item-card-head"><span className="owned-tag">Yours</span><small>{meal.components.length} item{meal.components.length === 1 ? "" : "s"}</small></div>
                <h3>{meal.name}</h3>
                <div className="item-nutrition"><strong>{Math.round(food.calories)}<small> kcal</small></strong><span>{food.protein.toFixed(1)}g <small>protein</small></span><span>{food.carbs.toFixed(1)}g <small>carbs</small></span><span>{food.fat.toFixed(1)}g <small>fat</small></span></div>
                <div className="item-card-actions"><button className="text-button" onClick={() => onEditMeal(meal)}>Edit</button><button className="text-button" onClick={() => onCopyMeal(meal)}>Copy</button><button className="text-button danger" onClick={() => onDeleteMeal(meal)} aria-label={`Delete the meal ${meal.name}`}>Delete</button><button className="button primary" onClick={() => onPlanFood(food)}>＋ Plan this</button></div>
              </article>
            ))}
            {preparedMeals.map((food) => (
              <article className="own-meal-card surface-card" key={food.id}>
                <div className="item-card-head"><span className="owned-tag ready">Ready meal</span><small>{food.availability}</small></div>
                <h3>{foodLabel(food)}</h3>
                <div className="item-nutrition"><strong>{Math.round(food.calories)}<small> kcal</small></strong><span>{food.protein}g <small>protein</small></span><span>{food.carbs}g <small>carbs</small></span><span>{food.fat}g <small>fat</small></span></div>
                <div className="item-card-actions"><small className="prepared-note">Also under Items</small><button className="button primary" onClick={() => onPlanFood(food)}>＋ Plan this</button></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <div className="recipe-grid">{shown.map((recipe) => <RecipeCard recipe={recipe} onOpen={onRecipe} onPlan={onPlan} key={recipe.id} />)}</div>
      {shown.length === 0 ? <div className="empty-state"><strong>Nothing fits those numbers yet.</strong><span>{hasNutritionTarget(bounds) ? "Widen the calorie ceiling or the protein window—the catalogue is still small." : "Try a broader search or clear the active filter."}</span><button className="button secondary" onClick={() => { setSearch(""); setFilter("All"); setTarget({ maxCalories: "", minProtein: "", maxProtein: "" }); }}>Clear filters</button></div> : null}
      <div className="research-footnote"><span>Built from</span><a href={SOURCE_LINKS.ninGuidelines} target="_blank" rel="noreferrer">ICMR–NIN 2024 guidance</a><a href={SOURCE_LINKS.ifct} target="_blank" rel="noreferrer">Indian Food Composition Tables</a><a href={SOURCE_LINKS.usda} target="_blank" rel="noreferrer">USDA FoodData Central</a></div>
    </>
  );
}

/** Nudge a component's amount within its unit's bounds, keeping nutrition in step. */
function withComponentAmount(items: TrayItem[], key: string, amount: number): TrayItem[] {
  return items.map((item) => {
    if (item.key !== key) return item;
    const step = item.food.unit === "g" || item.food.unit === "ml" ? 5 : item.food.unit === "piece" ? 1 : 0.25;
    const safe = Math.min(getQuantityLimit(item.food.unit), Math.max(step, Number((Number.isFinite(amount) ? amount : step).toFixed(2))));
    return { ...item, food: scaleNutritionForUnit(item.food, safe, item.food.unit) };
  });
}

/**
 * The one meal-building surface. Both callers assemble the same thing — a named
 * group of Single Items — and differ only in how items arrive and what happens
 * on save, so those are props rather than a second component:
 *
 *   Track's logger  picks the amount first, then adds; saves and logs at once.
 *   Plan            adds from its own search slot and edits amounts inline;
 *                   saves for later without touching the diary.
 *
 * `children` is the add-an-item slot. Both construct through createUserMeal, so
 * the name, component-count and total bounds are enforced in exactly one place.
 */
function MealComposer({ name, onNameChange, items, onItemsChange, editableAmounts = false, tone = "dark", headerLabel = "Your Meal", emptyHint, submitLabel, submitDisabled = false, onSubmit, children }: {
  name: string;
  onNameChange: (name: string) => void;
  items: TrayItem[];
  onItemsChange: (items: TrayItem[]) => void;
  editableAmounts?: boolean;
  tone?: "dark" | "light";
  headerLabel?: string;
  emptyHint: string;
  submitLabel: string;
  submitDisabled?: boolean;
  onSubmit: () => void;
  children?: React.ReactNode;
}) {
  const totals = sumNutritionDetails(items.map((item) => item.food));
  const nameValid = isUserMealNameValid(name);
  return (
    <div className={`meal-composer ${tone === "light" ? "on-light" : "on-dark"}`}>
      <div className="meal-composer-head"><span className={`eyebrow ${tone === "dark" ? "bright" : ""}`}>{headerLabel}</span><b>{items.length} item{items.length === 1 ? "" : "s"}</b></div>
      <label className="meal-name-field"><span>Meal name</span><input value={name} maxLength={MAX_MEAL_NAME_LENGTH} onChange={(event) => onNameChange(event.target.value)} placeholder="e.g. Usual breakfast" /></label>
      {children}
      {items.length === 0 ? <p className="meal-composer-hint">{emptyHint}</p> : (
        <div className="meal-composer-lines">
          {items.map((item) => (
            <div key={item.key}>
              <span>{editableAmounts ? null : <b>{item.food.amount} {item.food.unit}</b>}{foodLabel(item.food)}</span>
              {editableAmounts ? (
                <label>
                  <input type="number" min="0.01" max={getQuantityLimit(item.food.unit)} step={item.food.unit === "g" || item.food.unit === "ml" ? 5 : item.food.unit === "piece" ? 1 : 0.25} value={item.food.amount} onChange={(event) => onItemsChange(withComponentAmount(items, item.key, Number(event.target.value)))} aria-label={`${item.food.name} amount`} />
                  <b>{item.food.unit}</b>
                </label>
              ) : null}
              <small>{Math.round(item.food.calories)} kcal</small>
              <button onClick={() => onItemsChange(items.filter((candidate) => candidate.key !== item.key))} aria-label={`Remove ${item.food.name} from Meal`}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="meal-total"><strong>{Math.round(totals.calories)} kcal</strong><span>{totals.protein.toFixed(1)}P · {totals.carbs.toFixed(1)}C · {totals.fat.toFixed(1)}F</span></div>
      {!nameValid && name.trim().length > 0 ? <p className="meal-composer-hint warn">Give the Meal a name of {MAX_MEAL_NAME_LENGTH} characters or fewer.</p> : null}
      <button className="button lime full" disabled={submitDisabled || items.length === 0 || !nameValid} onClick={onSubmit}>{submitLabel}</button>
    </div>
  );
}

/** Plan's door into MealComposer: saves a Meal for later without logging it. */
function PlanMealBuilder({ initial, copying = false, catalog, dayKey, onClose, onSave }: {
  initial: UserMeal | null;
  copying?: boolean;
  catalog: Food[];
  dayKey: string;
  onClose: () => void;
  onSave: (meal: UserMeal) => void;
}) {
  const creating = initial === null || copying;
  const [name, setName] = useState(initial ? (copying ? `${initial.name.slice(0, Math.max(0, MAX_MEAL_NAME_LENGTH - 5))} copy` : initial.name) : "");
  const [items, setItems] = useState<TrayItem[]>(() => (initial ? initial.components.map((food, index) => ({ key: `saved-${index}-${food.id}`, food: { ...food } })) : []));
  const [search, setSearch] = useState("");
  const choices = search.trim() ? getShownSingleItems(catalog, "all", search).slice(0, 6) : [];

  const save = () => {
    const built = createUserMeal(name, items, freshUnique(), dayKey);
    if (!built) return;
    // Editing keeps the original identity so a meal updates in place.
    onSave(creating || !initial ? built : { ...built, id: initial.id, createdAt: initial.createdAt });
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="food-dialog plan-meal-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-meal-title">
        <header>
          <div><span className="eyebrow">Plan · Meals</span><h2 id="plan-meal-title">{copying ? "Copy meal" : creating ? "Build a meal" : "Edit meal"}</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Close meal builder">×</button>
        </header>
        <div className="plan-meal-body">
          <MealComposer
            name={name}
            onNameChange={setName}
            items={items}
            onItemsChange={setItems}
            editableAmounts
            tone="light"
            headerLabel={copying ? "New copy" : creating ? "New Meal" : "Editing Meal"}
            emptyHint="Add the Single Items this Meal is made of. Each keeps its own snapshot, so correcting an item later never rewrites a Meal you already logged."
            submitLabel={creating ? "Save meal" : "Save changes"}
            onSubmit={save}
          >
            <div className="component-search">
              <span>⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search an item to add…" aria-label="Search items to add to this meal" />
            </div>
            {choices.length > 0 ? (
              <div className="component-choices">
                {choices.map((food) => (
                  <button key={food.id} onClick={() => { setItems((current) => addToTray(current, food, freshTrayId())); setSearch(""); }}>
                    <span>{foodLabel(food)}</span><small>{Math.round(food.calories)} kcal / {food.amount} {food.unit}</small><b>＋</b>
                  </button>
                ))}
              </div>
            ) : null}
          </MealComposer>
        </div>
      </section>
    </div>
  );
}

function getShownSingleItems(catalog: Food[], kind: "all" | SingleItemKind, search: string) {
  const query = search.trim().toLowerCase();
  return catalog.filter((food) => {
    if (food.category === "Meal" || food.category === "Composite") return false;
    const matchesKind = kind === "all" || getSingleItemKind(food) === kind;
    const matchesSearch = !query || [food.name, food.brand, food.variant, ...food.aliases].join(" ").toLowerCase().includes(query);
    return matchesKind && matchesSearch;
  });
}

/**
 * A picture for a food KP is adding himself.
 *
 * Pasting an `https://` link was the only way to do this until 2026-08-30,
 * which is unusable on the phone where most items actually get added — there
 * is no URL to paste for the packet in your hand. The camera comes first now;
 * the link stays for the desktop case of copying a product shot.
 *
 * A picked photo is uploaded under a temporary key so the camera preview is
 * immediate. The original remains untouched until the food itself is saved;
 * cancel then removes only that temporary upload rather than changing a food
 * the person decided not to edit.
 */
function FoodPhotoField({ profileId, draft, setDraft, shouldKeep, onBusyChange, onPendingPhotoChange }: { profileId: string; draft: Food; setDraft: React.Dispatch<React.SetStateAction<Food>>; shouldKeep: () => boolean; onBusyChange: (busy: boolean) => void; onPendingPhotoChange: (key: string | null) => void }) {
  const [pendingPhotoKey, setPendingPhotoKey] = useState<string | null>(null);
  const pendingPhotoKeyRef = useRef<string | null>(null);
  const disposedRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "saved" | "error">("idle");
  const [failureReason, setFailureReason] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const hasPhoto = Boolean(draft.imageUrl && isSafeImageUrl(draft.imageUrl));
  const shouldKeepRef = useRef(shouldKeep);
  const onBusyChangeRef = useRef(onBusyChange);
  useEffect(() => {
    shouldKeepRef.current = shouldKeep;
    onBusyChangeRef.current = onBusyChange;
  }, [onBusyChange, shouldKeep]);

  useEffect(() => () => {
    // If the editor closes while PUT is still in flight, its success arrives
    // after the parent cleanup has run. Mark it disposed so the await below
    // deletes that late temporary upload instead of stranding it forever.
    disposedRef.current = true;
    onBusyChangeRef.current(false);
    if (pendingPhotoKeyRef.current && !shouldKeepRef.current()) void deleteFoodPhoto(profileId, pendingPhotoKeyRef.current);
  }, [profileId]);

  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isSupportedPhotoFile(file)) {
      setFailureReason("That file type isn’t supported — use a JPEG, PNG or WebP.");
      setStatus("error");
      return;
    }
    setStatus("uploading");
    onBusyChange(true);
    const photoKey = pendingPhotoKeyRef.current ?? freshUnique();
    const result = await uploadFoodPhoto(profileId, photoKey, file);
    if (disposedRef.current) {
      if (result.ok) void deleteFoodPhoto(profileId, photoKey);
      return;
    }
    onBusyChange(false);
    if (result.ok) {
      // Cache-buster makes the just-uploaded preview win over a cached picture.
      setDraft((food) => ({ ...food, imageUrl: `${result.url}?v=${Date.now()}` }));
      pendingPhotoKeyRef.current = photoKey;
      setPendingPhotoKey(photoKey);
      onPendingPhotoChange(photoKey);
      setFailureReason("");
      setStatus("saved");
    } else {
      setFailureReason(result.reason);
      setStatus("error");
    }
  };

  const handleRemove = async () => {
    // Only a newly-uploaded preview can be removed immediately. An established
    // photo stays safely in place until the surrounding food edit is saved.
    if (pendingPhotoKeyRef.current) {
      setStatus("uploading");
      onBusyChange(true);
      const removed = await deleteFoodPhoto(profileId, pendingPhotoKeyRef.current);
      if (disposedRef.current) return;
      onBusyChange(false);
      if (!removed) {
        setFailureReason("The Mac Mini could not remove it.");
        setStatus("error");
        return;
      }
    }
    pendingPhotoKeyRef.current = null;
    setPendingPhotoKey(null);
    onPendingPhotoChange(null);
    setDraft((food) => ({ ...food, imageUrl: "" }));
    setStatus("idle");
    setFailureReason("");
  };

  return (
    <div className="food-photo-field">
      <span className="food-photo-label">Photo <small>optional</small></span>
      <div className="food-photo-row">
        {hasPhoto ? <span className="food-photo-preview"><img src={draft.imageUrl} alt="" /></span> : <span className="food-photo-preview empty" aria-hidden="true">🍽</span>}
        <div className="food-photo-actions">
          <label className="food-photo-button">
            {hasPhoto ? "Replace photo" : "📷 Take or choose a photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePick} disabled={status === "uploading"} />
          </label>
          {hasPhoto ? <button type="button" className="text-button" onClick={handleRemove} disabled={status === "uploading"}>Remove</button> : null}
          <button type="button" className="text-button subtle" onClick={() => setLinkOpen((open) => !open)}>{linkOpen ? "Hide link field" : "or paste a link"}</button>
        </div>
      </div>
      {linkOpen ? <input className="food-photo-link" value={draft.imageUrl ?? ""} onChange={(event) => {
        // A typed link replaces a staged camera image, so do not keep an
        // unreachable temporary upload when the person changes their mind.
        if (pendingPhotoKeyRef.current) {
          void deleteFoodPhoto(profileId, pendingPhotoKeyRef.current);
          pendingPhotoKeyRef.current = null;
          setPendingPhotoKey(null);
          onPendingPhotoChange(null);
        }
        setDraft((food) => ({ ...food, imageUrl: event.target.value }));
        setStatus("idle");
      }} placeholder="https:// link to a picture" /> : null}
      {status === "uploading" ? <small className="photo-attach-status" role="status">Saving photo…</small> : null}
      {status === "saved" ? <small className="photo-attach-status saved" role="status">✓ Photo saved to the Mac Mini</small> : null}
      {status === "error" ? <small className="photo-attach-status error" role="alert">Photo not saved — {failureReason} The item itself is unaffected.</small> : null}
    </div>
  );
}

function FoodDetailsEditor({ profileId, draft, setDraft, draftIsNew, saveToLibrary, setSaveToLibrary, onCancel, onSave, submitLabel }: {
  profileId: string;
  draft: Food;
  setDraft: React.Dispatch<React.SetStateAction<Food>>;
  draftIsNew: boolean;
  saveToLibrary: boolean;
  setSaveToLibrary: (value: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
  submitLabel: string;
}) {
  const [initialFoodPhotoKey] = useState(() => foodPhotoKeyFromUrl(draft.imageUrl));
  const pendingPhotoKeyRef = useRef<string | null>(null);
  const savedPhotoEditRef = useRef(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const kind = getSingleItemKind(draft);
  const brandLabel = kind === "ordered-food" ? "Restaurant / brand *" : "Brand *";
  const nutritionUnits: NutritionUnit[] = ["g", "ml", "scoop", "pack", "piece", "serving"];
  const conversions = draft.conversions ?? [];
  const availableConversionUnits = nutritionUnits.filter((unit) => unit !== draft.unit && !conversions.some((conversion) => conversion.unit === unit));
  const updateConversion = (index: number, change: Partial<NonNullable<Food["conversions"]>[number]>) => {
    setDraft((food) => ({
      ...food,
      conversions: (food.conversions ?? []).map((conversion, conversionIndex) => conversionIndex === index ? { ...conversion, ...change } : conversion),
    }));
  };
  const removeConversion = (index: number) => {
    setDraft((food) => {
      const next = (food.conversions ?? []).filter((_, conversionIndex) => conversionIndex !== index);
      return { ...food, conversions: next.length ? next : undefined };
    });
  };
  const addConversion = () => {
    const unit = availableConversionUnits[0];
    if (!unit || conversions.length >= MAX_FOOD_CONVERSIONS) return;
    setDraft((food) => ({ ...food, conversions: [...(food.conversions ?? []), { unit, basisAmount: 1 }] }));
  };
  const changePendingPhoto = (key: string | null) => {
    pendingPhotoKeyRef.current = key;
  };
  useEffect(() => () => {
    // Backdrop and dialog-close actions unmount this editor without calling its
    // visible Cancel button. They must get the same temporary-upload cleanup.
    if (!savedPhotoEditRef.current && pendingPhotoKeyRef.current) void deleteFoodPhoto(profileId, pendingPhotoKeyRef.current);
  }, [profileId]);
  const cancelEdit = () => {
    if (pendingPhotoKeyRef.current) void deleteFoodPhoto(profileId, pendingPhotoKeyRef.current);
    pendingPhotoKeyRef.current = null;
    onCancel();
  };
  const saveEdit = () => {
    const finalPhotoKey = foodPhotoKeyFromUrl(draft.imageUrl);
    savedPhotoEditRef.current = true;
    onSave();
    // Delete the old stored image only after the food record now points away
    // from it. A failed cleanup can leave an unused file, but can never erase
    // the photo the user still sees or prevent their food from being saved.
    if (initialFoodPhotoKey && initialFoodPhotoKey !== finalPhotoKey) void deleteFoodPhoto(profileId, initialFoodPhotoKey);
  };
  return <div className="food-details-editor">
    <div className="details-heading"><div><span className="eyebrow bright">{draftIsNew ? "New Single Item" : "Single Item details"}</span><h3>{draftIsNew ? "Add it yourself" : "Edit anything"}</h3></div><button onClick={cancelEdit} aria-label="Cancel food details edit">×</button></div>
    <label className="food-type-field"><span>Food type</span><select value={kind} onChange={(event) => setDraft((food) => ({ ...food, category: itemCategoryForKind(event.target.value as SingleItemKind), brand: event.target.value === "ingredient" ? "" : food.brand === "Generic" ? "" : food.brand }))}>{(["packaged", "ingredient", "ordered-food"] as SingleItemKind[]).map((value) => <option value={value} key={value}>{singleItemKindLabel(value)}</option>)}</select></label>
    <p>{kind === "ingredient" ? "Use this for a generic raw or cooked ingredient. No brand is needed." : kind === "ordered-food" ? "Use this only for a prepared meal ordered online, such as a specific Subway sandwich." : "Use this for a product with its own pack or nutrition label."}</p>
    <div className="identity-fields">
      {kind === "ingredient" ? null : <label><span>{brandLabel}</span><input value={draft.brand} onChange={(event) => setDraft((food) => ({ ...food, brand: event.target.value }))} /></label>}
      <label><span>{kind === "ordered-food" ? "Menu item *" : "Item name *"}</span><input value={draft.name} onChange={(event) => setDraft((food) => ({ ...food, name: event.target.value }))} /></label>
      <label><span>Variant</span><input value={draft.variant} onChange={(event) => setDraft((food) => ({ ...food, variant: event.target.value }))} placeholder={kind === "ordered-food" ? "Optional, e.g. 6-inch / toasted" : "Optional, e.g. Slim / 1 L"} /></label>
    </div>
    <div className="serving-fields">
      <label><span>Nutrition basis</span><input type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft((food) => ({ ...food, amount: Number(event.target.value) }))} /></label>
      <label><span>Unit</span><select value={draft.unit} onChange={(event) => { const unit = event.target.value as Food["unit"]; setDraft((food) => ({ ...food, unit, conversions: food.conversions?.filter((conversion) => conversion.unit !== unit) })); }}>{["g", "ml", "scoop", "pack", "piece", "serving"].map((unit) => <option key={unit}>{unit}</option>)}</select></label>
    </div>
    <div className="conversion-fields">
      <div className="conversion-heading"><span>Alternate logging units <small>optional</small></span><small>Add every way you naturally measure this item.</small></div>
      {conversions.map((conversion, index) => (
        <div className="conversion-row" key={`${conversion.unit}-${index}`}>
          <label><span>Log by</span><select value={conversion.unit} onChange={(event) => updateConversion(index, { unit: event.target.value as NutritionUnit })}>{nutritionUnits.filter((unit) => unit !== draft.unit && (unit === conversion.unit || !conversions.some((candidate, candidateIndex) => candidateIndex !== index && candidate.unit === unit))).map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          <label><span>1 {conversion.unit} equals</span><div><input type="number" min="0.01" max="5000" step="0.01" value={conversion.basisAmount} onChange={(event) => updateConversion(index, { basisAmount: Number(event.target.value) })} /><b>{draft.unit}</b></div></label>
          <label><span>Friendly label</span><input maxLength={MAX_CONVERSION_LABEL_LENGTH} value={conversion.label ?? ""} onChange={(event) => updateConversion(index, { label: event.target.value })} placeholder="e.g. 1 carton" /></label>
          <button type="button" className="conversion-remove" onClick={() => removeConversion(index)} aria-label={`Remove ${conversion.unit} alternate unit`}>Remove</button>
        </div>
      ))}
      {availableConversionUnits.length > 0 && conversions.length < MAX_FOOD_CONVERSIONS ? <button type="button" className="conversion-add" onClick={addConversion}>＋ Add another unit</button> : null}
    </div>
    <div className="nutrition-fields">{(["calories", "protein", "carbs", "fat", "fiber"] as const).map((field) => <label key={field}><span>{field === "fiber" ? "Fibre" : field.charAt(0).toUpperCase() + field.slice(1)}</span><div><input type="number" min="0" max="50000" step="0.1" value={draft[field]} onChange={(event) => setDraft((food) => ({ ...food, [field]: Number(event.target.value) }))} /><b>{field === "calories" ? "kcal" : "g"}</b></div></label>)}</div>
    {draftIsNew ? <label className="save-choice"><input type="checkbox" checked={saveToLibrary} onChange={(event) => setSaveToLibrary(event.target.checked)} /><span><strong>Save to Single Items for next time</strong><small>{saveToLibrary ? "It will be waiting here tomorrow." : "This one is used today only."}</small></span></label> : null}
    <FoodPhotoField profileId={profileId} draft={draft} setDraft={setDraft} shouldKeep={() => savedPhotoEditRef.current} onBusyChange={setPhotoBusy} onPendingPhotoChange={changePendingPhoto} />
    <button className="button lime full" disabled={photoBusy || !isFoodDetailsValid(draft)} onClick={saveEdit}>{photoBusy ? "Saving photo…" : submitLabel}</button>
  </div>;
}

function MealEditor({ meal, catalog, onChange, onLog, buttonLabel, disabled = false }: { meal: UserMeal; catalog: Food[]; onChange: (meal: UserMeal) => void; onLog: () => void; buttonLabel: string; disabled?: boolean }) {
  const totals = userMealTotals(meal);
  const [search, setSearch] = useState("");
  const choices = search.trim() ? getShownSingleItems(catalog, "all", search).slice(0, 6) : [];
  const updateAmount = (index: number, amount: number) => {
    const component = meal.components[index];
    if (!component) return;
    const step = component.unit === "g" || component.unit === "ml" ? 5 : component.unit === "piece" ? 1 : 0.25;
    const safeAmount = Math.min(getQuantityLimit(component.unit), Math.max(step, Number((Number.isFinite(amount) ? amount : step).toFixed(2))));
    onChange({ ...meal, components: meal.components.map((food, foodIndex) => foodIndex === index ? scaleNutritionForUnit(food, safeAmount, food.unit) : food) });
  };
  return <aside className="quantity-editor dark-card meal-editor">
    <span className="eyebrow bright">Meal</span>
    <label className="meal-name-field"><span>Meal name for today</span><input value={meal.name} maxLength={MAX_MEAL_NAME_LENGTH} onChange={(event) => onChange({ ...meal, name: event.target.value })} /></label>
    <p>Rename, resize, add, or remove anything here. Your reusable saved Meal stays unchanged.</p>
    <div className="meal-component-editor">{meal.components.map((component, index) => <div className="meal-component-row" key={`${component.id}-${index}`}><span><strong>{foodLabel(component)}</strong><small>{Math.round(component.calories)} kcal</small></span><label><input type="number" min="0.01" max={getQuantityLimit(component.unit)} step={component.unit === "g" || component.unit === "ml" ? 5 : component.unit === "piece" ? 1 : 0.25} value={component.amount} onChange={(event) => updateAmount(index, Number(event.target.value))} aria-label={`${component.name} amount`} /><b>{component.unit}</b></label><button onClick={() => onChange({ ...meal, components: meal.components.filter((_, componentIndex) => componentIndex !== index) })} aria-label={`Remove ${component.name} from this meal`}>×</button></div>)}</div>
    {meal.components.length < MAX_MEAL_COMPONENTS ? <><div className="component-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Add an item for today…" aria-label="Search items to add to this one-off meal" /></div>{choices.length ? <div className="component-choices">{choices.map((food) => <button key={food.id} onClick={() => { onChange({ ...meal, components: [...meal.components, cloneNutritionItem(food)] }); setSearch(""); }}><span>{foodLabel(food)}</span><small>{Math.round(food.calories)} kcal / {food.amount} {food.unit}</small><b>＋</b></button>)}</div> : null}</> : <small className="meal-composer-hint">This Meal already has its maximum of {MAX_MEAL_COMPONENTS} items.</small>}
    <div className="meal-total"><strong>{Math.round(totals.calories)} kcal</strong><span>{totals.protein.toFixed(1)}P · {totals.carbs.toFixed(1)}C · {totals.fat.toFixed(1)}F</span></div>
    {!isUserMealNameValid(meal.name) && meal.name.trim() ? <small className="meal-composer-hint warn">Give this Meal a name of {MAX_MEAL_NAME_LENGTH} characters or fewer.</small> : null}
    <button className="button lime full" disabled={disabled || meal.components.length === 0 || !isUserMealNameValid(meal.name)} onClick={onLog}>{buttonLabel}</button>
  </aside>;
}

/**
 * A photo lives on the server the moment it is picked, keyed by `logId` — not
 * staged until the food is logged. New-entry uploads are deleted on abandon,
 * including when their request finishes after the dialog has already closed.
 * Once the matching log commits, the same cleanup deliberately leaves it alone.
 */
function PhotoAttachControl({ profileId, logId, initialMeta, discardIfUncommitted, shouldKeep, onBusyChange, onChange }: { profileId: string; logId: string; initialMeta: LogPhotoMeta | undefined; discardIfUncommitted: boolean; shouldKeep: () => boolean; onBusyChange: (busy: boolean) => void; onChange: (meta: LogPhotoMeta | null) => void }) {
  // initialMeta only ever needs reading once: FoodDialog (this control's only caller)
  // is mounted fresh each time it opens, so there is no later prop change to sync from.
  const [meta, setMeta] = useState<LogPhotoMeta | undefined>(initialMeta);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [failureReason, setFailureReason] = useState("");
  const disposedRef = useRef(false);
  const uploadedRef = useRef(Boolean(initialMeta));
  const shouldKeepRef = useRef(shouldKeep);
  const onBusyChangeRef = useRef(onBusyChange);
  useEffect(() => {
    shouldKeepRef.current = shouldKeep;
    onBusyChangeRef.current = onBusyChange;
  }, [onBusyChange, shouldKeep]);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      onBusyChangeRef.current(false);
      if (discardIfUncommitted && uploadedRef.current && !shouldKeepRef.current()) void deleteLogPhoto(profileId, logId);
    };
  }, [discardIfUncommitted, logId, profileId]);
  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isSupportedPhotoFile(file)) {
      setFailureReason("That file type isn’t supported — use a JPEG, PNG or WebP.");
      setStatus("error");
      return;
    }
    setLocalPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    setStatus("uploading");
    onBusyChange(true);
    const result = await uploadLogPhoto(profileId, logId, file);
    if (disposedRef.current) {
      if (result.ok && discardIfUncommitted && !shouldKeepRef.current()) void deleteLogPhoto(profileId, logId);
      return;
    }
    onBusyChange(false);
    if (result.ok) {
      uploadedRef.current = true;
      setStatus("idle");
      setFailureReason("");
      setMeta(result.meta);
      onChange(result.meta);
    } else {
      // The preview is cleared on failure on purpose. Leaving the picture on
      // screen after a failed upload is the app quietly implying it saved.
      setLocalPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      setFailureReason(result.reason);
      setStatus("error");
    }
  };
  const handleRemove = async () => {
    setStatus("uploading");
    onBusyChange(true);
    const removed = await deleteLogPhoto(profileId, logId);
    if (disposedRef.current) return;
    onBusyChange(false);
    if (!removed) {
      setFailureReason("The Mac Mini could not remove it.");
      setStatus("error");
      return;
    }
    setLocalPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setMeta(undefined);
    uploadedRef.current = false;
    setStatus("idle");
    onChange(null);
  };
  const previewSrc = localPreview ?? (meta ? photoUrl(profileId, logId) : null);
  return (
    <div className="photo-attach">
      {previewSrc ? (
        <div className="photo-attach-preview">
          <img src={previewSrc} alt="" />
          <button type="button" onClick={handleRemove} disabled={status === "uploading"}>Remove photo</button>
        </div>
      ) : (
        <label className="photo-attach-button">
          📷 Add a photo <small>optional — for your trainer</small>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handlePick} disabled={status === "uploading"} />
        </label>
      )}
      {status === "error" ? <small className="photo-attach-status error" role="alert">Photo not saved — {failureReason} The food itself is unaffected; tap to try again.</small> : null}
      {status === "uploading" ? <small className="photo-attach-status" role="status">Saving photo…</small> : null}
      {/* The preview appears the instant a file is picked, so without this the
          screen looks identical whether or not the upload actually landed. */}
      {status === "idle" && meta ? <small className="photo-attach-status saved" role="status">✓ Photo saved to the Mac Mini · removed automatically after 30 days</small> : null}
    </div>
  );
}

function FoodDialog({ initialFood, initialMeal, editing, editingLogId, catalog, meals: mealOptions, dayKey, profileId, photoIndex, onClose, onAdd, onAddMeal, onSaveFood, onSaveMeal, onPhotoChange }: { initialFood: Food | null; initialMeal: UserMeal | null; editing: boolean; editingLogId: string | null; catalog: Food[]; meals: UserMeal[]; dayKey: string; profileId: string; photoIndex: PhotoIndex; onClose: () => void; onAdd: (food: Food, logId?: string) => void; onAddMeal: (meal: UserMeal, logId?: string) => void; onSaveFood: (food: Food) => void; onSaveMeal: (meal: UserMeal) => void; onPhotoChange: (logId: string, meta: LogPhotoMeta | null) => void }) {
  /** A new id is minted after every add, so several foods logged in one open dialog never collapse into one synced row. */
  const [pendingLogId, setPendingLogId] = useState(() => (editing ? null : freshUnique()));
  const activeLogId = editing ? editingLogId : pendingLogId;
  const committedLogIdsRef = useRef(new Set<string>());
  const [photoBusy, setPhotoBusy] = useState(false);
  const singleItems = catalog.filter((food) => food.category !== "Meal" && food.category !== "Composite");
  const initial = initialFood && initialFood.category !== "Meal" ? foodAtBasis(initialFood) : singleItems.find((food) => food.common) ?? singleItems[0];
  const [mode, setMode] = useState<"items" | "meals">(initialMeal ? "meals" : "items");
  const [search, setSearch] = useState("");
  const [itemKind, setItemKind] = useState<"all" | SingleItemKind>("all");
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [quantity, setQuantity] = useState(initialFood?.amount ?? initial?.amount ?? 0);
  const [loggingUnit, setLoggingUnit] = useState<NutritionUnit>(initialFood?.unit ?? initial?.unit ?? "g");
  const [buildingMeal, setBuildingMeal] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealLines, setMealLines] = useState<TrayItem[]>([]);
  const [mealDraft, setMealDraft] = useState<UserMeal | null>(initialMeal ? cloneUserMeal(initialMeal) : mealOptions[0] ? cloneUserMeal(mealOptions[0]) : null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draftIsNew, setDraftIsNew] = useState(false);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [draft, setDraft] = useState<Food>(initial ?? blankFood());
  const [editedFood, setEditedFood] = useState<Food | null>(null);
  const dialogCatalog = catalog.map((food) => {
    if (editedFood?.id === food.id) return editedFood;
    if (editing && initialFood?.id === food.id) return foodAtBasis(initialFood);
    return food;
  });
  const shownItems = getShownSingleItems(dialogCatalog, itemKind, search);
  const selected = shownItems.find((food) => food.id === selectedId) ?? null;
  const shownMeals = mealOptions.filter((meal) => {
    const query = search.trim().toLowerCase();
    return !query || [meal.name, ...meal.components.flatMap((food) => [food.name, food.brand, food.variant])].join(" ").toLowerCase().includes(query);
  });
  const visibleMealDraft = mealDraft && shownMeals.some((meal) => meal.id === mealDraft.id) ? mealDraft : null;
  const step = loggingUnit === "ml" || loggingUnit === "g" ? 5 : loggingUnit === "piece" ? 1 : 0.25;
  const maxQuantity = selected ? getQuantityLimit(loggingUnit) : 0;
  const requestedBasisAmount = selected ? getBasisAmountForLogging(selected, quantity, loggingUnit) : 0;
  const quantityValid = selected ? isQuantityValid(loggingUnit, quantity) && requestedBasisAmount > 0 && getLoggingUnits(selected).includes(loggingUnit) : false;
  const scaled = selected ? scaleNutritionForUnit(selected, quantityValid ? quantity : 0, loggingUnit) : null;
  const labelBasis = selected ? selected.basis?.amount ?? selected.amount : 0;
  const basisUnit = selected ? selected.basis?.unit ?? selected.unit : loggingUnit;
  const mealTotals = sumNutritionDetails(mealLines.map((line) => line.food));
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  const chooseFood = (food: Food) => { setSelectedId(food.id); setQuantity(food.amount); setLoggingUnit(food.unit); setDetailsOpen(false); };
  const openDetails = () => {
    if (!selected) return;
    setDraft(foodAtBasis(selected));
    setDetailsOpen(true);
  };
  const nextUnique = freshUnique;
  const commitActiveLogId = () => {
    if (activeLogId) committedLogIdsRef.current.add(activeLogId);
    return activeLogId ?? undefined;
  };
  const logSingleItem = (food: Food) => {
    onAdd(food, commitActiveLogId());
    if (!editing) setPendingLogId(freshUnique());
  };
  const logMeal = (meal: UserMeal) => {
    onAddMeal(meal, commitActiveLogId());
  };
  const startCreate = () => {
    const next = blankFood(search.trim());
    next.category = itemKind === "all" ? "Product" : itemCategoryForKind(itemKind);
    setDraft(next);
    setDraftIsNew(true);
    setSaveToLibrary(true);
    setDetailsOpen(true);
  };
  const saveDetails = () => {
    if (!isFoodDetailsValid(draft)) return;
    const image = draft.imageUrl && isSafeImageUrl(draft.imageUrl) ? draft.imageUrl : undefined;

    // Creating a food always mints a fresh id. Reusing the selected food's id
    // is what silently replaced a researched entry with a different food.
    if (draftIsNew) {
      const created = createCustomFood({ ...draft, imageUrl: image }, nextUnique());
      if (!created) return;
      if (saveToLibrary) onSaveFood(created);
      setEditedFood(created);
      setSelectedId(created.id);
      setQuantity(created.amount);
      setLoggingUnit(created.unit);
      setDraftIsNew(false);
      setDetailsOpen(false);
      const ready = scaleNutritionForUnit(created, created.amount, created.unit);
      if (buildingMeal) setMealLines((lines) => addToTray(lines, ready, freshTrayId()));
      else logSingleItem(ready);
      return;
    }

    // Editing a researched food forks a personal copy; foods you already own
    // edit in place, so corrections do not pile up duplicates.
    const original = dialogCatalog.find((food) => food.id === draft.id) ?? draft;
    const forked = forkFoodForEdit(original, nextUnique());
    const saved: Food = {
      ...draft,
      id: forked.id,
      brand: draft.category === "Ingredient" ? draft.brand.trim() || "Generic" : draft.brand.trim(),
      name: draft.name.trim(),
      variant: draft.variant.trim(),
      basis: undefined,
      availability: forked.availability,
      ...(image ? { imageUrl: image } : {}),
      source: { ...draft.source, label: forked.source.label, trust: "Personal" },
    };
    setEditedFood(saved);
    setSelectedId(saved.id);
    onSaveFood(saved);
    if (!editing || !isQuantityValid(saved.unit, quantity)) {
      setQuantity(saved.amount);
      setLoggingUnit(saved.unit);
    }
    setDetailsOpen(false);
  };
  const addMealLine = () => {
    if (!scaled || !quantityValid) return;
    setMealLines((lines) => addToTray(lines, scaled, freshTrayId()));
  };
  const saveBuiltMeal = () => {
    const meal = createUserMeal(mealName, mealLines, nextUnique(), dayKey);
    if (!meal) return;
    onSaveMeal(meal);
    logMeal(meal);
    onClose();
  };
  const close = () => {
    setSearch("");
    onClose();
  };
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <section className="food-dialog" role="dialog" aria-modal="true" aria-labelledby="log-food-title">
        <header><div><span className="eyebrow">Track</span><h2 id="log-food-title">{editing ? "Edit logged food" : "Log food"}</h2></div><button className="close-button" onClick={close} aria-label="Close food logger">×</button></header>
        {!editing ? <div className="logging-mode-switch" aria-label="Food type"><button className={mode === "items" ? "active" : ""} onClick={() => { setMode("items"); setBuildingMeal(false); setSearch(""); setDetailsOpen(false); }}>Single Items</button><button className={mode === "meals" ? "active" : ""} onClick={() => { setMode("meals"); setBuildingMeal(false); setSearch(""); setDetailsOpen(false); }}>Meals</button></div> : null}
        <div className="dialog-search"><span>⌕</span><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={mode === "meals" && !buildingMeal ? "Search saved Meals" : "Search Single Items"} /></div>
        {mode === "items" || buildingMeal ? <div className="single-item-filters" aria-label="Single Item filters"><button className={itemKind === "all" ? "active" : ""} onClick={() => setItemKind("all")}>All</button>{(["packaged", "ingredient", "ordered-food"] as SingleItemKind[]).map((kind) => <button className={itemKind === kind ? "active" : ""} onClick={() => setItemKind(kind)} key={kind}>{singleItemKindLabel(kind)}</button>)}</div> : null}
        <div className="food-dialog-body">
          <div className="food-results">{mode === "meals" && !buildingMeal ? <>{editing ? null : <button className="create-food-row" onClick={() => { setBuildingMeal(true); setSearch(""); setMealName(""); setMealLines([]); }}><span className="food-thumb icon create" aria-hidden="true">＋</span><span><strong>Create a Meal</strong><small>Group one or more Single Items for quick logging</small></span></button>}{shownMeals.map((meal) => { const totals = userMealTotals(meal); return <button className={visibleMealDraft?.id === meal.id ? "selected" : ""} key={meal.id} onClick={() => setMealDraft(cloneUserMeal(meal))}><span className="food-thumb icon meal" aria-hidden="true"><FoodIcon name="meal" /></span><span><strong>{meal.name}</strong><small>{meal.components.length} item{meal.components.length === 1 ? "" : "s"}</small></span><span><b>{Math.round(totals.calories)}</b><small>kcal</small></span><i>→</i></button>; })}{shownMeals.length === 0 ? <div className="food-results-empty"><strong>No Meal found</strong><span>Create one from your Single Items.</span></div> : null}</> : <>{editing ? null : <button className="create-food-row" onClick={startCreate}><span className="food-thumb icon create" aria-hidden="true">＋</span><span><strong>{search.trim() ? `Add “${search.trim()}” as a new Single Item` : "Add a new Single Item"}</strong><small>Packaged Food, Open Ingredient, or Ordered Food</small></span></button>}{shownItems.map((food) => <button className={selected?.id === food.id ? "selected" : ""} key={food.id} onClick={() => chooseFood(food)}><FoodThumb food={food} /><span><strong>{foodLabel(food)}</strong><small>{singleItemKindLabel(getSingleItemKind(food))} · {food.amount} {food.unit}</small></span><span><b>{Math.round(food.calories)}</b><small>kcal</small></span><i>→</i></button>)}{shownItems.length === 0 ? <div className="food-results-empty"><strong>No match yet</strong><span>Add it as a new Single Item without leaving this flow.</span></div> : null}</>}</div>
          {mode === "meals" && !buildingMeal ? (visibleMealDraft ? <MealEditor meal={visibleMealDraft} catalog={catalog} onChange={setMealDraft} onLog={() => { logMeal(visibleMealDraft); close(); }} buttonLabel={editing ? "Update today’s Meal" : "Log this Meal"} disabled={photoBusy} /> : <aside className="quantity-editor quantity-editor-empty dark-card"><span className="eyebrow bright">Meal</span><h3>{search.trim() ? "No Meal selected" : "Choose a Meal"}</h3><p>{search.trim() ? "Try a different Meal name or create a new one." : "Your saved Meals will appear here."}</p></aside>) : <aside className={`quantity-editor dark-card ${detailsOpen ? "details-mode" : ""} ${buildingMeal ? "meal-builder-mode" : ""}`}>
            {detailsOpen ? <FoodDetailsEditor profileId={profileId} draft={draft} setDraft={setDraft} draftIsNew={draftIsNew} saveToLibrary={saveToLibrary} setSaveToLibrary={setSaveToLibrary} onCancel={() => { setDetailsOpen(false); setDraftIsNew(false); }} onSave={saveDetails} submitLabel={draftIsNew ? buildingMeal ? "Create & add to Meal" : "Create & log it" : "Save changes"} /> : selected && scaled ? <>
            <span className="eyebrow bright">Single Item</span><h3>{foodLabel(selected)}</h3><p>Choose weight, volume, or a natural unit. Nutrition stays on the same evidence-backed basis.</p>
            <label className="logging-unit-field"><span>Log by</span><select aria-label={`${selected.name} logging unit`} value={loggingUnit} onChange={(event) => { const unit = event.target.value as NutritionUnit; setLoggingUnit(unit); setQuantity(unit === (selected.basis?.unit ?? selected.unit) ? (selected.basis?.amount ?? selected.amount) : 1); }}>{getLoggingUnits(selected).map((unit) => <option value={unit} key={unit}>{unit === (selected.basis?.unit ?? selected.unit) ? unit : `${unit} · ${getLoggingUnitLabel(selected, unit)}`}</option>)}</select></label>
            <div className="quantity-control"><button onClick={() => setQuantity((value) => Math.max(step, Number((value - step).toFixed(2))))} aria-label={`Decrease ${selected.name} quantity`}>−</button><label><input type="number" min={step} max={maxQuantity} step={step} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} aria-label={`${selected.name} quantity`} /><span>{loggingUnit}</span></label><button onClick={() => setQuantity((value) => Math.min(maxQuantity, Number((value + step).toFixed(2))))} aria-label={`Increase ${selected.name} quantity`}>＋</button></div>
            <small className={`quantity-basis ${quantityValid ? "" : "error"}`}>{quantityValid ? `You are adding ${quantity} ${loggingUnit}${loggingUnit === basisUnit ? "" : ` = ${requestedBasisAmount} ${basisUnit}`} · nutrition basis ${labelBasis} ${basisUnit}` : `Enter more than 0 and no more than ${maxQuantity} ${loggingUnit}`}</small>
            <div className="live-nutrition"><strong><b>{Math.round(scaled.calories)}</b><small>kcal</small></strong><span><b>{scaled.protein.toFixed(1)}g</b><small>protein</small></span><span><b>{scaled.carbs.toFixed(1)}g</b><small>carbs</small></span><span><b>{scaled.fat.toFixed(1)}g</b><small>fat</small></span><span><b>{scaled.fiberDeclared === false ? "—" : `${scaled.fiber.toFixed(1)}g`}</b><small>{scaled.fiberDeclared === false ? "fibre not declared" : "fibre"}</small></span></div>
            <button className="edit-food-button" onClick={openDetails}>✎ Edit name, serving & nutrition</button>
            {selected.source.url ? <a href={selected.source.url} target="_blank" rel="noreferrer">{selected.source.label} ↗</a> : <span className="personal-source">{selected.source.label}</span>}
            <button className={`button ${buildingMeal ? "outline-light" : "lime"} full add-food-button`} disabled={!quantityValid || (!buildingMeal && photoBusy)} onClick={() => buildingMeal ? addMealLine() : logSingleItem(scaled)}>{buildingMeal ? `＋ Add ${quantity} ${loggingUnit} to Meal` : `${editing ? "Update" : "Add"} ${quantity} ${loggingUnit} · ${Math.round(scaled.calories)} kcal`}</button>
            </> : <div className="quantity-editor-empty"><span className="eyebrow bright">Single Item</span><h3>{search.trim() ? "No item selected" : "Choose an item"}</h3><p>Use the add-new action when search has no match.</p></div>}
            {buildingMeal && !detailsOpen ? <MealComposer name={mealName} onNameChange={setMealName} items={mealLines} onItemsChange={setMealLines} emptyHint="Add Single Items one by one. Nothing is logged until you save the Meal." submitLabel="Save & log Meal" submitDisabled={photoBusy} onSubmit={saveBuiltMeal} /> : null}
          </aside>}
        </div>
        {activeLogId && !detailsOpen && (selected || visibleMealDraft || buildingMeal) ? <div className="photo-attach-wrap dark-card"><PhotoAttachControl key={activeLogId} profileId={profileId} logId={activeLogId} initialMeta={photoIndex[activeLogId]} discardIfUncommitted={!editing} shouldKeep={() => committedLogIdsRef.current.has(activeLogId)} onBusyChange={setPhotoBusy} onChange={(meta) => onPhotoChange(activeLogId, meta)} /></div> : null}
        {editing ? null : <div className="dialog-footer"><button className="button secondary full" onClick={close}>Done</button></div>}
      </section>
    </div>
  );
}

function RecipeDrawer({ recipe, onClose, onPlan }: { recipe: Recipe | null; onClose: () => void; onPlan: (recipe: Recipe) => void }) {
  if (!recipe) return null;
  return (
    <div className="dialog-backdrop drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <aside className="recipe-drawer" role="dialog" aria-modal="true" aria-labelledby="recipe-title">
        <button className="close-button" onClick={onClose} aria-label="Close recipe">×</button>
        <div className={`drawer-art ${recipe.art}`}><span>{recipe.time}</span><b>{recipe.protein}g protein</b></div>
        <div className="drawer-copy"><div className="recipe-tags">{recipe.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><h2 id="recipe-title">{recipe.name}</h2><p>{recipe.description}</p>
          <div className="drawer-macros"><span><strong>{recipe.calories}</strong><small>kcal</small></span><span><strong>{recipe.protein}g</strong><small>protein</small></span><span><strong>{recipe.carbs}g</strong><small>carbs</small></span><span><strong>{recipe.fat}g</strong><small>fat</small></span><span><strong>{recipe.fiber}g</strong><small>fibre</small></span></div>
          <section><span className="eyebrow">Ingredients</span>{recipe.ingredients.map((ingredient) => <div className="ingredient" key={ingredient}><i>✓</i><span>{ingredient}</span></div>)}</section>
          <section className="recipe-method"><span className="eyebrow">Method</span>{recipe.method.map((step, index) => <div className="ingredient" key={step}><i>{index + 1}</i><span>{step}</span></div>)}</section>
          <div className="source-note"><i>i</i><span><strong>How the numbers were built</strong>{recipe.sourceNote}</span></div>
          <button className="button lime full" onClick={() => { onPlan(recipe); onClose(); }}>＋ Add meal to plan</button>
        </div>
      </aside>
    </div>
  );
}

/**
 * Where KP's data lives and how to get it out.
 *
 * The browser keeps a local working copy for resilience, while the Mac Mini is
 * the shared durable copy once its write has succeeded. This panel must never
 * describe those two layers as separate diaries: that would make a successful
 * sync look like a lie and discourage the backup behaviour it is meant to aid.
 */
function SettingsPanel({ state, dayKey, onClose, onImport, onClearAll, profiles, profileId, activeProfile, syncStatus, onSwitchProfile, onAddProfile, onRenameProfile, onRemoveProfile }: {
  state: SavedNutritionState;
  dayKey: string;
  profiles: DiaryProfile[] | null;
  profileId: string;
  activeProfile: DiaryProfile | null;
  syncStatus: SyncStatus;
  onSwitchProfile: (id: string) => void;
  onAddProfile: (name: string) => Promise<void>;
  onRenameProfile: (id: string, name: string) => Promise<void>;
  onRemoveProfile: (id: string) => Promise<void>;
  onClose: () => void;
  onImport: (restored: SavedNutritionState, filename: string) => void;
  onClearAll: () => void;
}) {
  const [error, setError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [newPerson, setNewPerson] = useState("");
  const [confirmingPerson, setConfirmingPerson] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const days = state.days.length;
  const entries = state.days.reduce((sum, day) => sum + day.logs.length, 0);

  const download = () => {
    const blob = new Blob([exportNutritionState(state, new Date().toISOString())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nourish-backup-${dayKey}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const chooseFile = async (file: File | null) => {
    setError("");
    if (!file) return;
    const restored = parseExportedNutritionState(await file.text());
    if (!restored) {
      setError("That file is not a Nourish backup, or holds nothing to restore. Your current diary is untouched.");
      return;
    }
    onImport(restored, file.name);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="food-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header>
          <div><span className="eyebrow">Nourish</span><h2 id="settings-title">Your data</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Close settings">×</button>
        </header>
        <div className="settings-body">
          <section className={`settings-block sync-block ${syncStatus === "synced" ? "good" : syncStatus === "failed" ? "bad" : ""}`}>
            <h3>Where this diary is saved</h3>
            <p className="sync-line"><b>{describeSyncStatus(syncStatus, activeProfile?.name)}</b></p>
            {syncStatus === "local-only" ? <p>Everything still works. Entries stay on this device and go up automatically the next time the Mac Mini answers.</p> : null}
          </section>

          {profiles ? (
            <section className="settings-block people-block">
              <h3>Who this is for</h3>
              <p>Each person has a completely separate diary, targets and weigh-ins. Nothing is shared between them.</p>
              <div className="people-list">
                {profiles.map((profile) => (
                  <div className={`person-row ${profile.id === profileId ? "active" : ""}`} key={profile.id}>
                    <button className="person-pick" onClick={() => onSwitchProfile(profile.id)} aria-pressed={profile.id === profileId}>
                      <span>{profile.name}</span>{profile.id === profileId ? <i>Showing now</i> : <i>Switch to this diary</i>}
                    </button>
                    <button className="text-button" onClick={() => { const next = window.prompt("New name", profile.name); if (next?.trim()) void onRenameProfile(profile.id, next.trim()); }}>Rename</button>
                    {profiles.length > 1 ? (
                      confirmingPerson === profile.id
                        ? <span className="person-confirm"><button className="button danger" onClick={() => { void onRemoveProfile(profile.id); setConfirmingPerson(null); }}>Delete everything of theirs</button><button className="text-button" onClick={() => setConfirmingPerson(null)}>Cancel</button></span>
                        : <button className="text-button danger" onClick={() => setConfirmingPerson(profile.id)}>Delete</button>
                    ) : null}
                  </div>
                ))}
              </div>
              <form className="add-person" onSubmit={(event) => { event.preventDefault(); if (newPerson.trim()) { void onAddProfile(newPerson.trim()); setNewPerson(""); } }}>
                <input value={newPerson} onChange={(event) => setNewPerson(event.target.value)} placeholder="Add someone (their name)" aria-label="Name of the person to add" maxLength={40} />
                <button className="button secondary" disabled={!newPerson.trim()}>Add</button>
              </form>
            </section>
          ) : null}

          <div className="settings-stats">
            <div><strong>{days}</strong><span>{days === 1 ? "day" : "days"} of diary</span></div>
            <div><strong>{entries}</strong><span>logged {entries === 1 ? "entry" : "entries"}</span></div>
            <div><strong>{state.customFoods.length}</strong><span>your foods</span></div>
            <div><strong>{state.userMeals.length}</strong><span>your meals</span></div>
            <div><strong>{state.weights.length}</strong><span>weigh-ins</span></div>
          </div>

          <section className="settings-block">
            <h3>Back up</h3>
            <p>Downloads everything above as one file — diary, your foods, your meals, weigh-ins and targets. Keep it somewhere outside this browser.</p>
            <button className="button primary" onClick={download}>Download backup</button>
          </section>

          <section className="settings-block">
            <h3>Restore</h3>
            <p>Loads a backup file. It <strong>merges</strong> into what is here — days, foods, meals and weigh-ins are combined, and nothing currently logged is deleted. Anything you deleted here stays deleted rather than reappearing.</p>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => { void chooseFile(event.target.files?.[0] ?? null); event.target.value = ""; }} />
            <button className="button secondary" onClick={() => fileRef.current?.click()}>Choose a backup file…</button>
            {error ? <p className="settings-error" role="alert">{error}</p> : null}
          </section>

          <section className="settings-block settings-danger">
            <h3>Delete everything</h3>
            <p>
              Removes every diary day, food, meal, weigh-in and target from this browser. There is
              no Undo for this one. Download a backup first if there is any chance you want it back —
              a backup restores normally afterwards.
            </p>
            {clearing ? (
              <div className="danger-confirm">
                <label htmlFor="confirm-delete">Type <b>DELETE</b> to confirm</label>
                <input id="confirm-delete" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} autoComplete="off" placeholder="DELETE" aria-label="Type DELETE to confirm" />
                <div><button className="button danger" disabled={confirmText.trim() !== "DELETE"} onClick={onClearAll}>Delete everything</button><button className="text-button" onClick={() => { setClearing(false); setConfirmText(""); }}>Cancel</button></div>
              </div>
            ) : (
              <button className="button danger" onClick={() => setClearing(true)}>Delete everything…</button>
            )}
          </section>

          <section className="settings-block settings-truth">
            <h3>Where this is stored</h3>
            <p>
              This browser keeps a local working copy under this exact address. When the status
              above says it is saved on the Mac Mini, it is also stored there and shared between
              connected devices. Clearing browser data removes this browser copy; a downloaded
              backup remains a useful independent safety copy.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}

/**
 * What a single Undo would put back. A deleted diary entry has to remember which
 * day and which position it came from; everything else is restored whole.
 */
type PendingUndo =
  | { kind: "log"; dayKey: string; entry: SavedLogEntry; index: number }
  | { kind: "record"; record: RemovedRecord };

/**
 * The last line of defence between a rendering bug and a blank white screen.
 *
 * On 2026-08-30 a single call to an API that does not exist outside a secure
 * context took down the entire app: no message, no recovery, just a blank page
 * on every phone. React unmounts the whole tree when a render throws and
 * nothing catches it, so the *absence* of this boundary is what turned a small
 * bug into a total outage.
 *
 * It deliberately does not try to be clever. It says what happened in plain
 * English, states that logged food is safe (it is — the diary is written to
 * storage and the Mac Mini as it happens, not on unmount), and offers a reload.
 */
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // The only place this is recoverable from, so it must never be swallowed.
    console.error("[nourish] the app stopped rendering:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-crash" role="alert">
        <div className="app-crash-card">
          <span className="eyebrow">Nourish hit a problem</span>
          <h1>Something on this screen stopped working.</h1>
          <p>Your logged food is safe — every entry is saved as you add it, on this device and on the Mac Mini. Nothing has been lost.</p>
          <p className="app-crash-detail">{this.state.error.message}</p>
          <button className="button lime full" onClick={() => window.location.reload()}>Reload Nourish</button>
        </div>
      </div>
    );
  }
}

export default function Home() {
  return <AppErrorBoundary><NourishApp /></AppErrorBoundary>;
}

function NourishApp() {
  const [clock, setClock] = useState(() => getBangaloreClock(new Date()));
  const [area, setArea] = useState<Area>("track");
  const [trackView, setTrackView] = useState<TrackView>("today");
  const [planView, setPlanView] = useState<PlanView>("items");
  const [foodDialog, setFoodDialog] = useState(false);
  const [foodDialogSelection, setFoodDialogSelection] = useState<Food | null>(null);
  const [foodDialogMealSelection, setFoodDialogMealSelection] = useState<UserMeal | null>(null);
  const [editingFoodIndex, setEditingFoodIndex] = useState<number | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Non-null while Plan’s food editor is open; `initial` null means creating. */
  const [planFoodEditor, setPlanFoodEditor] = useState<{ initial: Food | null; initialName?: string; copying?: boolean } | null>(null);
  /** Non-null while Plan’s meal builder is open; `initial` null means creating. */
  const [planMealBuilder, setPlanMealBuilder] = useState<{ initial: UserMeal | null; copying?: boolean } | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  /**
   * Which profile the diary currently in `saved` actually belongs to.
   *
   * Every read, write and sync is gated on this matching the profile in view.
   * Without it there is a window right after switching person where `saved` still
   * holds the previous diary while the storage keys and the sync target have
   * already moved — and in that window the app writes one person's food into
   * another person's diary, on the device and on the server. That is not a
   * cosmetic glitch; it is the exact thing separate profiles exist to prevent.
   */
  const [loadedProfile, setLoadedProfile] = useState<string | null>(null);
  const [cardIqImport, setCardIqImport] = useState<CardIqFoodImport | null>(null);
  const [saved, setSaved] = useState<SavedNutritionState>(emptyNutritionState);
  const [saveFailed, setSaveFailed] = useState(false);
  /** Which person's diary is open. Persisted so a phone reopens where it left off. */
  const [profileId, setProfileId] = useState<string>(DEFAULT_PROFILE_ID);
  const [profiles, setProfiles] = useState<DiaryProfile[] | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("unknown");
  /** Bumped after a failed/offline save so unchanged local work gets another route to the Mini. */
  const [syncRetry, setSyncRetry] = useState(0);
  /** Which logIds have a photo, per the diary database. Live-only: never persisted, never merged, refreshed on every pull. */
  const [photoIndex, setPhotoIndex] = useState<PhotoIndex>({});
  /** Applied the moment an upload/delete succeeds, so the thumbnail appears without waiting on the next sync. */
  const updatePhotoIndex = (logId: string, meta: LogPhotoMeta | null) => {
    setPhotoIndex((current) => {
      if (!meta) {
        if (!(logId in current)) return current;
        const { [logId]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [logId]: meta };
    });
  };
  /** The revision this device last agreed with the server on, for optimistic concurrency. */
  const revisionRef = useRef(0);
  const pushTimer = useRef<number | null>(null);
  /** The live diary, readable from inside async work without making it a dependency. */
  const savedRef = useRef<SavedNutritionState>(emptyNutritionState());
  /** The exact object last accepted by the server, so an unchanged diary is not re-sent. */
  const lastPushedRef = useRef<SavedNutritionState | null>(null);
  const storageKeys = nutritionStorageKeys(profileId);
  const activeProfile = profiles?.find((profile) => profile.id === profileId) ?? null;
  const profileName = activeProfile?.name ?? (profileId === DEFAULT_PROFILE_ID ? "Kanwar" : "This person");
  const profileAvatar = profileInitials(profileName);
  const foodCatalog = mergeFoodCatalog(baseLogFoods, saved.customFoods);
  const legacyMeals: UserMeal[] = saved.customFoods.filter((food) => food.category === "Meal").map((food) => ({
    id: `legacy-${food.id}`,
    name: food.name,
    createdAt: "2026-08-13",
    components: [{ ...food, id: `legacy-item-${food.id}`, brand: "Legacy", category: "Product" }],
  }));
  const logMeals = [...saved.userMeals, ...legacyMeals, ...builtInUserMeals];
  /** Undoable messages hold much longer: a 2.6s window is too short to click. */
  const notify = (message: string, holdMs = 2600) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => {
      setToast("");
      toastTimer.current = null;
    }, holdMs);
  };
  // Which person was last open on this device. Read before any diary, because it
  // decides which diary to read.
  useEffect(() => {
    // Deferred like every other load in this file: reading storage during the
    // effect body would set state mid-render and cascade a second pass.
    const timer = window.setTimeout(() => {
      try {
        const remembered = window.localStorage.getItem(PROFILE_STORAGE_KEY);
        if (remembered) setProfileId(remembered);
      } catch {
        // A browser that refuses storage still gets the default profile.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStorageLoaded(false);
      // Newest schema first, then older keys, then the backup — so a corrupted live
      // key recovers instead of presenting an empty diary as if nothing was logged.
      const raw = readStoredNutritionRaw(window.localStorage, storageKeys);
      const restored = parseSavedNutritionState(raw);
      // Stamping ids here rather than in the parser keeps parsing pure, and gets it
      // done before anything can be synced — an unidentified entry cannot be merged.
      const loaded = withLogIds(restored, freshUnique);
      // The ref is updated in the same breath as the state: the sync effects read
      // it, and a ref still pointing at the previous person is how a diary ends up
      // filed under the wrong name.
      savedRef.current = loaded;
      lastPushedRef.current = null;
      revisionRef.current = 0;
      setSaved(loaded);
      // Photos are per-profile and live-fetched; the previous person's index must not
      // linger on screen while the new person's diary is still loading.
      setPhotoIndex({});
      setLoadedProfile(profileId);
      setStorageLoaded(true);
      // Discarding a damaged record is right — guessing at it would corrupt
      // totals — but doing it silently is not. KP gets told his diary shrank.
      if (restored.rejected > 0) {
        window.setTimeout(() => notify(`${restored.rejected} damaged saved ${restored.rejected === 1 ? "record" : "records"} could not be restored`, 8000), 0);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profileId, storageKeys.live]);

  /**
   * Fold in whatever the Mac Mini already holds for this person, once, on open.
   *
   * Local first, server second, and the merge keeps both — so opening the app on
   * a second phone adds to the diary rather than replacing either copy.
   */
  useEffect(() => {
    // Never sync a diary that belongs to whoever was on screen a moment ago.
    if (!storageLoaded || loadedProfile !== profileId) return;
    let cancelled = false;
    void (async () => {
      setSyncStatus("syncing");
      const available = await fetchProfiles();
      if (cancelled) return;
      setProfiles(available);
      if (!available) {
        setSyncStatus("local-only");
        return;
      }
      const pulled = await pullDiary(profileId, savedRef.current);
      if (cancelled) return;
      if (pulled.state) {
        setSaved(pulled.state);
        revisionRef.current = pulled.revision ?? 0;
      }
      if (pulled.photos) setPhotoIndex(pulled.photos);
      setSyncStatus(pulled.status);
    })();
    return () => { cancelled = true; };
  }, [storageLoaded, loadedProfile, profileId, syncRetry]);

  /**
   * Offline work stays dirty until the host confirms it. A retry must not depend
   * on another edit: someone may log breakfast once, close nothing, and expect
   * the Mini to catch up when it wakes ten seconds later.
   */
  useEffect(() => {
    if (!storageLoaded || loadedProfile !== profileId || !["local-only", "failed", "conflict"].includes(syncStatus)) return;
    const timer = window.setTimeout(() => setSyncRetry((attempt) => attempt + 1), 10_000);
    return () => window.clearTimeout(timer);
  }, [syncStatus, storageLoaded, loadedProfile, profileId, syncRetry]);
  useEffect(() => {
    // Pure external-system sync: the diary is the source of truth and this mirrors it to
    // storage. Only today's slice is ever rewritten, so earlier days survive midnight.
    // Same guard: mid-switch, these keys belong to the new person and `saved` does not.
    if (!storageLoaded || loadedProfile !== profileId) return;
    try {
      // Mirror the newest successful payload, so even the first real log has a
      // recoverable copy if the live key is later corrupted.
      writeStoredNutritionState(window.localStorage, saved, storageKeys);
    } catch {
      // A persistent banner, not a toast that disappears: if the diary has stopped being
      // written, KP must keep seeing that until it is fixed. Deferred so the effect body
      // does not set state synchronously.
      window.setTimeout(() => setSaveFailed(true), 0);
    }
  }, [saved, storageLoaded, loadedProfile, profileId, storageKeys]);

  /**
   * Push up shortly after things stop changing.
   *
   * Debounced rather than immediate because logging a meal is several state
   * changes in a row (pick, adjust, add) and each one is not worth a round trip.
   * Local storage is already written synchronously above, so nothing is at risk
   * while this waits — the delay costs freshness on the other device, never data.
   */
  useEffect(() => {
    savedRef.current = saved;
    // Nothing to send, and no diary database to send it to, are both normal.
    if (!storageLoaded || loadedProfile !== profileId || profiles === null || lastPushedRef.current === saved) return;
    if (pushTimer.current !== null) window.clearTimeout(pushTimer.current);
    let cancelled = false;
    pushTimer.current = window.setTimeout(() => {
      pushTimer.current = null;
      const outgoing = savedRef.current;
      void (async () => {
        setSyncStatus("syncing");
        const result = await pushDiary(profileId, outgoing, revisionRef.current);
        if (cancelled) return;
        if (result.revision !== undefined) revisionRef.current = result.revision;
        // Only the host's success response proves this exact object is durable.
        // Offline/error/conflict results deliberately stay dirty for the retry effect.
        if (result.status === "synced") lastPushedRef.current = result.state ?? outgoing;
        // A merge that came back from a conflict has to be adopted, or this device
        // keeps arguing with a server that has already moved past it.
        if (result.state && result.state !== outgoing) setSaved(result.state);
        setSyncStatus(result.status);
      })();
    }, 1200);
    return () => {
      cancelled = true;
      if (pushTimer.current !== null) window.clearTimeout(pushTimer.current);
    };
  }, [saved, storageLoaded, loadedProfile, profileId, profiles]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(getBangaloreClock(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/cardiq-food-import.json")
      .then((response) => response.ok ? response.json() : null)
      // Classification and matching are re-applied here rather than trusted from the file,
      // so a matcher fix reaches KP without re-running the cardIQ import.
      .then((value: unknown) => { if (active && isCardIqFoodImport(value)) setCardIqImport(refineCardIqImport(value)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  // Quick add is ordered by how often KP actually buys the thing, then by how recently.
  // The snapshot's own order is by purchase date, which surfaced whatever happened to be
  // bought last — sugar ahead of milk — rather than what he reaches for.
  const cardIqQuickFoods = (cardIqImport?.items ?? [])
    .flatMap((item) => {
      const food = item.matchedFoodId ? foodCatalog.find((candidate) => candidate.id === item.matchedFoodId) : null;
      return food ? [{ food, orderCount: item.orderCount, lastOrdered: item.lastOrdered }] : [];
    })
    // Repeat buys of the same food across stores are one entry, keeping the combined count.
    .reduce((unique: Array<{ food: Food; orderCount: number; lastOrdered: string }>, entry) => {
      const existing = unique.find((candidate) => candidate.food.id === entry.food.id);
      if (existing) {
        existing.orderCount += entry.orderCount;
        if (entry.lastOrdered > existing.lastOrdered) existing.lastOrdered = entry.lastOrdered;
        return unique;
      }
      return [...unique, { ...entry }];
    }, [])
    .sort((a, b) => b.orderCount - a.orderCount || b.lastOrdered.localeCompare(a.lastOrdered))
    .map((entry) => entry.food);
  const quickFoods = cardIqQuickFoods.length ? cardIqQuickFoods : foodCatalog.filter((food) => food.common);
  const entries = restoreDayEntries(saved, clock.dayKey, foodCatalog);
  const extras = entries.map((entry) => entry.food);
  const undoRef = useRef<PendingUndo | null>(null);
  const foodPhotoCleanupTimers = useRef(new Map<string, number>());
  const logPhotoCleanupTimers = useRef(new Map<string, number>());
  const scheduleLogPhotoCleanup = (logId: string) => {
    const prior = logPhotoCleanupTimers.current.get(logId);
    if (prior !== undefined) window.clearTimeout(prior);
    const timer = window.setTimeout(() => {
      logPhotoCleanupTimers.current.delete(logId);
      void deleteLogPhoto(profileId, logId).then((removed) => { if (removed) updatePhotoIndex(logId, null); });
    }, 10_000);
    logPhotoCleanupTimers.current.set(logId, timer);
  };
  const cancelLogPhotoCleanup = (logId: string | undefined) => {
    if (!logId) return;
    const timer = logPhotoCleanupTimers.current.get(logId);
    if (timer !== undefined) window.clearTimeout(timer);
    logPhotoCleanupTimers.current.delete(logId);
  };
  const planned = restorePlanEntries(saved, foodCatalog);
  const totals = sumLoggedNutrition(extras, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const calories = totals.calories;
  const macros = { protein: totals.protein, carbs: totals.carbs, fat: totals.fat };
  // History excludes today, which is still being written and is already shown in full on Today.
  const history = summariseHistory(saved.days, foodCatalog).filter((day) => day.dayKey !== clock.dayKey);
  const targets = saved.targets ?? DEFAULT_TARGETS;
  const targetsAreDefaults = saved.targets === null;
  const saveTargets = (next: TargetValues) => {
    setSaved((current) => ({ ...current, targets: { ...next, updatedAt: nextTargetEditTime(current.targets?.updatedAt) } }));
    notify("Daily targets updated · saving to the Mac Mini…");
  };
  const setTodayLogs = (update: (logs: SavedLogEntry[]) => SavedLogEntry[]) => {
    setSaved((current) => withDayLogs(current, clock.dayKey, update(logsForDay(current, clock.dayKey))));
  };
  const setPlanned = (update: (entries: PlannedEntry[]) => PlannedEntry[]) => {
    setSaved((current) => ({ ...current, planned: update(restorePlanEntries(current, mergeFoodCatalog(baseLogFoods, current.customFoods))).map((entry) => ({ id: entry.id, kind: entry.kind })) }));
  };

  const saveCustomFood = (food: Food) => {
    if (!isFoodDetailsValid(food)) return;
    setSaved((current) => ({ ...current, customFoods: [...current.customFoods.filter((candidate) => candidate.id !== food.id), food] }));
    notify(`${foodLabel(food)} saved to My Foods`);
  };
  /**
   * Plan's create/edit lands in the same customFoods list Track writes to, so a
   * food added while planning is immediately loggable and an edit made while
   * logging shows up in Plan.
   */
  const savePlanFood = (draft: Food, isNew: boolean) => {
    const food = isNew ? createCustomFood({ ...draft, category: draft.category, imageUrl: draft.imageUrl, conversions: draft.conversions }, freshUnique()) : draft;
    if (!food) {
      notify("That item needs a name, a serving size, and non-negative macros");
      return;
    }
    saveCustomFood(food);
    setPlanFoodEditor(null);
  };
  /**
   * Merge a backup into the live diary. Deliberately additive: for anything that
   * collides, what is already here wins, and nothing currently logged is removed.
   * Restoring a stale file should never be able to undo today's work — the worst
   * it can do is add days KP no longer has.
   */
  const importBackup = (restored: SavedNutritionState, filename: string) => {
    const merged = mergeNutritionBackup(saved, restored);
    setSaved(merged.state);
    setSettingsOpen(false);
    const added = Object.values(merged.added).reduce((sum, count) => sum + count, 0);
    const conflicts = Object.values(merged.collisions).reduce((sum, count) => sum + count, 0);
    const skipped = Object.values(merged.skippedAtCapacity).reduce((sum, count) => sum + count, 0);
    notify(`Restored from ${filename} · ${added} new ${added === 1 ? "record" : "records"} added${conflicts ? ` · ${conflicts} ${conflicts === 1 ? "conflict kept" : "conflicts kept"} current` : ""}${skipped ? ` · ${skipped} ${skipped === 1 ? "record did" : "records did"} not fit` : ""}`, 8000);
  };

  const saveWeight = (entry: WeightEntry) => {
    setSaved((current) => ({ ...current, weights: upsertWeightEntry(current.weights, entry) }));
    notify(`Weight saved · ${entry.kg.toFixed(1)} kg`);
  };

  const nav = area === "track" ? trackNav : planNav;
  const activeView = area === "track" ? trackView : planView;
  const addFood = (food: Food, logId?: string) => {
    const isEdit = editingFoodIndex !== null;
    if (wouldDropOldestDay(saved, clock.dayKey)) notify(`Diary is full at ${MAX_STORED_DAYS} days — the oldest day will be removed`);
    const editLogIndex = isEdit && editingFoodIndex !== null ? entries[editingFoodIndex]?.logIndex : undefined;
    // A stable logId is what a photo attached in the dialog is keyed by, so it must
    // survive onto the actual saved entry — never be left to withLogIds to backfill later.
    const finalLogId = logId ?? (isEdit ? entries[editingFoodIndex ?? -1]?.logId : undefined) ?? freshUnique();
    const entry: SavedLogEntry = { ...foodToLogEntry(food), logId: finalLogId };
    setTodayLogs((logs) => isEdit ? logs.map((current, index) => index === editLogIndex ? entry : current) : [...logs, entry]);
    // An edit is finished when it is applied. A new entry is not: a real plate is several
    // foods, so the logger stays open and KP closes it when the meal is fully recorded.
    if (isEdit) {
      setFoodDialog(false);
      setFoodDialogSelection(null);
      setFoodDialogMealSelection(null);
      setEditingFoodIndex(null);
    }
    notify(`${food.name} ${isEdit ? "updated" : "added"} · ${Math.round(food.calories)} kcal`);
  };
  const addMeal = (meal: UserMeal, logId?: string) => {
    const isEdit = editingFoodIndex !== null;
    if (wouldDropOldestDay(saved, clock.dayKey)) notify(`Diary is full at ${MAX_STORED_DAYS} days — the oldest day will be removed`);
    const editLogIndex = isEdit && editingFoodIndex !== null ? entries[editingFoodIndex]?.logIndex : undefined;
    const finalLogId = logId ?? (isEdit ? entries[editingFoodIndex ?? -1]?.logId : undefined) ?? freshUnique();
    const entry: SavedLogEntry = { ...mealToLogEntry(meal, meal.id.startsWith("builtin-") ? "Reference" : "Personal"), logId: finalLogId };
    setTodayLogs((logs) => isEdit ? logs.map((current, index) => index === editLogIndex ? entry : current) : [...logs, entry]);
    if (isEdit) {
      setFoodDialog(false);
      setFoodDialogSelection(null);
      setFoodDialogMealSelection(null);
      setEditingFoodIndex(null);
    }
    notify(`${meal.name} ${isEdit ? "updated for today" : "added"} · ${Math.round(userMealTotals(meal).calories)} kcal`);
  };
  const saveUserMeal = (meal: UserMeal) => {
    setSaved((current) => ({ ...current, userMeals: upsertUserMeal(current.userMeals, meal) }));
    notify(`${meal.name} saved to Meals`);
  };
  /**
   * Removing anything keeps the removed thing aside so a misclick is one tap from
   * undone. Nothing small asks for confirmation — a modal on every delete makes
   * tidying up a chore, and an Undo that actually works is the better guarantee.
   */
  const deleteLoggedEntry = (dayKey: string, logIndex: number, label: string) => {
    const entry = logsForDay(saved, dayKey)[logIndex];
    if (!entry) return;
    undoRef.current = { kind: "log", dayKey, entry, index: logIndex };
    setSaved((current) => withDayLogs(current, dayKey, logsForDay(current, dayKey).filter((_, index) => index !== logIndex)));
    if (entry.logId) scheduleLogPhotoCleanup(entry.logId);
    notify(`${label} removed · tap Undo to put it back`, 10_000);
  };
  const deleteLoggedFood = (index: number) => {
    const removed = entries[index];
    if (!removed || removed.logIndex === undefined) return;
    deleteLoggedEntry(clock.dayKey, removed.logIndex, removed.meal?.name ?? foodLabel(removed.food));
  };
  /** Deletes a saved food, meal, weigh-in or whole day, and remembers the deletion. */
  const deleteRecord = (kind: RemovableKind, id: string, label: string) => {
    const outcome = removeRecord(saved, kind, id);
    if (!outcome.removed) return;
    undoRef.current = { kind: "record", record: outcome.removed };
    setSaved(outcome.state);
    if (outcome.removed.kind === "customFood") {
      const photoKey = foodPhotoKeyFromUrl(outcome.removed.food.imageUrl);
      if (photoKey) {
        const prior = foodPhotoCleanupTimers.current.get(photoKey);
        if (prior !== undefined) window.clearTimeout(prior);
        const timer = window.setTimeout(() => {
          foodPhotoCleanupTimers.current.delete(photoKey);
          void deleteFoodPhoto(profileId, photoKey);
        }, 10_000);
        foodPhotoCleanupTimers.current.set(photoKey, timer);
      }
    }
    if (outcome.removed.kind === "day") {
      for (const entry of outcome.removed.day.logs) if (entry.logId) scheduleLogPhotoCleanup(entry.logId);
    }
    notify(`${label} deleted · tap Undo to put it back`, 10_000);
  };
  const undoDelete = () => {
    const pending = undoRef.current;
    if (!pending) return;
    if (pending.kind === "log") {
      cancelLogPhotoCleanup(pending.entry.logId);
      setSaved((current) => withDayLogs(current, pending.dayKey, (() => {
        const logs = [...logsForDay(current, pending.dayKey)];
        logs.splice(Math.min(pending.index, logs.length), 0, pending.entry);
        return logs;
      })()));
    } else {
      if (!canRestoreRecord(saved, pending.record)) {
        notify("Undo is ready, but your saved items are full. Make room, then tap Undo — nothing was removed to make space.", 10_000);
        return;
      }
      if (pending.record.kind === "customFood") {
        const photoKey = foodPhotoKeyFromUrl(pending.record.food.imageUrl);
        const timer = photoKey ? foodPhotoCleanupTimers.current.get(photoKey) : undefined;
        if (photoKey && timer !== undefined) {
          window.clearTimeout(timer);
          foodPhotoCleanupTimers.current.delete(photoKey);
        }
      }
      if (pending.record.kind === "day") {
        for (const entry of pending.record.day.logs) cancelLogPhotoCleanup(entry.logId);
      }
      setSaved((current) => restoreRecord(current, pending.record));
    }
    undoRef.current = null;
    notify("Put back");
  };
  /**
   * The one genuinely destructive control in the app, so it is the one place that
   * insists KP types the word rather than offering an Undo he might not reach in time.
   */
  /**
   * Open a different person's diary. Their entries live under their own storage
   * keys and their own row in the database, so this swaps the whole diary rather
   * than filtering one — nothing of theirs can leak into a total of KP's.
   */
  const switchProfile = (id: string) => {
    if (id === profileId) return;
    if (pushTimer.current !== null) {
      window.clearTimeout(pushTimer.current);
      pushTimer.current = null;
    }
    lastPushedRef.current = null;
    undoRef.current = null;
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, id);
    } catch {
      // Not remembering which profile was open is a small loss, not a reason to refuse.
    }
    setProfileId(id);
    setSettingsOpen(false);
    notify(`Now showing ${profiles?.find((profile) => profile.id === id)?.name ?? id}’s diary`);
  };
  const addProfile = async (name: string) => {
    const id = toProfileId(name);
    const created = await createProfile(id, name);
    if (!created) {
      notify("Could not add that person — the Mac Mini did not accept it");
      return;
    }
    setProfiles(await fetchProfiles());
    notify(`${created.name} added · switch to their diary from Settings`);
  };
  const removeProfile = async (id: string) => {
    const name = profiles?.find((profile) => profile.id === id)?.name ?? id;
    if (!await deleteRemoteProfile(id)) {
      notify("Could not remove that person from the Mac Mini");
      return;
    }
    setProfiles(await fetchProfiles());
    if (id === profileId) switchProfile(DEFAULT_PROFILE_ID);
    notify(`${name} and everything they logged has been deleted`, 6000);
  };
  const renameActiveProfile = async (id: string, name: string) => {
    if (!await renameProfile(id, name)) {
      notify("Could not rename that person");
      return;
    }
    setProfiles(await fetchProfiles());
    notify(`Renamed to ${name}`);
  };
  const clearEverything = () => {
    setSaved((current) => clearAllUserData(current));
    undoRef.current = null;
    setSettingsOpen(false);
    notify("Everything deleted. Nourish is back to a blank diary.", 8000);
  };
  const openFoodLogger = (food: Food | null = null, editIndex: number | null = null, meal: UserMeal | null = null) => {
    setFoodDialogSelection(food);
    setFoodDialogMealSelection(meal);
    setEditingFoodIndex(editIndex);
    setFoodDialog(true);
  };
  const addItemToPlan = (food: Food) => {
    setPlanned((value) => [...value, planEntryFromFood(food)]);
    notify(`${food.name} added to today’s draft`);
  };
  const addMealToPlan = (meal: Recipe) => {
    setPlanned((value) => [...value, planEntryFromMeal(meal)]);
    notify(`${meal.name} added to today’s draft`);
  };
  const removeFromPlan = (index: number) => setPlanned((value) => value.filter((_, itemIndex) => itemIndex !== index));
  const switchArea = (next: Area) => {
    setArea(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const switchView = (id: PlanView | TrackView) => {
    if (area === "track") setTrackView(id as TrackView);
    else setPlanView(id as PlanView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderContent = () => {
    if (area === "track") {
      if (trackView === "today") return <TodayView clock={clock} profileName={profileName} calories={calories} macros={macros} entries={entries} quickFoods={quickFoods} weights={saved.weights} hasCardIqImport={cardIqImport !== null} targets={targets} targetsAreDefaults={targetsAreDefaults} history={history} profileId={profileId} photoIndex={photoIndex} onLog={() => openFoodLogger()} onAdd={(food) => openFoodLogger(food)} onEdit={(index) => openFoodLogger(entries[index]?.food ?? null, index, entries[index]?.meal ?? null)} onDelete={deleteLoggedFood} onSaveWeight={saveWeight} onDeleteWeight={(date) => deleteRecord("weight", date, `The ${date} weigh-in`)} onOpenMeals={() => { setArea("plan"); setPlanView("meals"); window.scrollTo({ top: 0, behavior: "smooth" }); }} onSaveTargets={saveTargets} />;
      if (trackView === "history") return <HistoryView history={history} clock={clock} targets={targets} entriesFor={(dayKey) => restoreDayEntries(saved, dayKey, foodCatalog)} profileId={profileId} photoIndex={photoIndex} onDeleteEntry={deleteLoggedEntry} onDeleteDay={(dayKey) => deleteRecord("day", dayKey, `${dayKey}`)} />;
      if (trackView === "trends") return <TrendsView history={history} targets={targets} />;
      return <PurchasesView cardIqImport={cardIqImport} onAdd={(food) => openFoodLogger(food)} onCreateFromPurchase={(name) => setPlanFoodEditor({ initial: null, initialName: name })} />;
    }
    if (planView === "items") return <ItemsView planned={planned} catalog={foodCatalog} onPlan={addItemToPlan} onRemove={removeFromPlan} onCreate={() => setPlanFoodEditor({ initial: null })} onEdit={(food) => setPlanFoodEditor({ initial: food })} onCopy={(food) => setPlanFoodEditor({ initial: food, copying: true })} onDelete={(food) => deleteRecord("customFood", food.id, foodLabel(food))} />;
    return <MealsView onRecipe={setRecipe} planned={planned} catalog={foodCatalog} userMeals={saved.userMeals} onPlan={addMealToPlan} onPlanFood={addItemToPlan} onRemove={removeFromPlan} onCreateMeal={() => setPlanMealBuilder({ initial: null })} onEditMeal={(meal) => setPlanMealBuilder({ initial: meal })} onCopyMeal={(meal) => setPlanMealBuilder({ initial: meal, copying: true })} onDeleteMeal={(meal) => deleteRecord("userMeal", meal.id, meal.name)} />;
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand"><span>N</span><div><strong>Nourish</strong><small>Personal nutrition</small></div></div>
        <div className="area-switch" aria-label="Main sections"><button className={area === "plan" ? "active" : ""} onClick={() => switchArea("plan")}><span>PLAN</span><small>Decide what to eat</small></button><button className={area === "track" ? "active" : ""} onClick={() => switchArea("track")}><span>TRACK</span><small>See how you’re doing</small></button></div>
        <nav className="side-nav" aria-label={`${area} navigation`}>{nav.map((item) => <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => switchView(item.id)}><i>{item.icon}</i><span>{item.label}</span></button>)}</nav>
        <div className="sidebar-footer"><span className="kp-avatar">{profileAvatar}</span><div><strong>{profileName}</strong><small>{targetsAreDefaults ? "Set personal targets" : `${targets.calories.toLocaleString("en-IN")} kcal target`}</small></div><button aria-label="Open settings" onClick={() => setSettingsOpen(true)}>•••</button></div>
      </aside>
      <div className="mobile-topbar"><div className="brand"><span>N</span><strong>Nourish</strong></div><div className="mobile-area"><button className={area === "plan" ? "active" : ""} onClick={() => switchArea("plan")}>Plan</button><button className={area === "track" ? "active" : ""} onClick={() => switchArea("track")}>Track</button></div><button className="kp-avatar mobile-settings" aria-label={`Open settings for ${profileName}`} onClick={() => setSettingsOpen(true)}><span>{profileAvatar}</span></button></div>
      <div className="mobile-subnav">{nav.map((item) => <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => switchView(item.id)}>{item.label}</button>)}</div>
      <main className="workspace">
        {saveFailed ? <div className="save-warning" role="alert"><strong>Nourish cannot save to this browser.</strong><span>Anything you log now will be lost when you close the tab. This usually means private browsing or a full storage quota.</span></div> : null}
        <div className={`persistence-status ${syncStatus}`} role="status" aria-live="polite"><i aria-hidden="true" /><span><strong>{describeSyncStatus(syncStatus, profileName)}</strong>{syncStatus === "synced" ? " Every change is stored outside app releases." : syncStatus === "syncing" ? " Your browser copy is already safe while this finishes." : syncStatus === "unknown" ? " Connecting to the durable diary…" : " Keep this tab open; Nourish retries automatically."}</span></div>
        {renderContent()}
      </main>
      {area === "track" ? <button className="mobile-log-button" onClick={() => openFoodLogger()}>＋ Log food</button> : null}
      {foodDialog ? <FoodDialog initialFood={foodDialogSelection} initialMeal={foodDialogMealSelection} editing={editingFoodIndex !== null} editingLogId={editingFoodIndex !== null ? entries[editingFoodIndex]?.logId ?? null : null} catalog={foodCatalog} meals={logMeals} dayKey={clock.dayKey} profileId={profileId} photoIndex={photoIndex} onClose={() => { setFoodDialog(false); setFoodDialogSelection(null); setFoodDialogMealSelection(null); setEditingFoodIndex(null); }} onAdd={addFood} onAddMeal={addMeal} onSaveFood={saveCustomFood} onSaveMeal={saveUserMeal} onPhotoChange={updatePhotoIndex} /> : null}
      <RecipeDrawer recipe={recipe} onClose={() => setRecipe(null)} onPlan={addMealToPlan} />
      {settingsOpen ? <SettingsPanel state={saved} dayKey={clock.dayKey} onClose={() => setSettingsOpen(false)} onImport={importBackup} onClearAll={clearEverything} profiles={profiles} profileId={profileId} activeProfile={activeProfile} syncStatus={syncStatus} onSwitchProfile={switchProfile} onAddProfile={addProfile} onRenameProfile={renameActiveProfile} onRemoveProfile={removeProfile} /> : null}
      {planFoodEditor ? <PlanFoodEditor initial={planFoodEditor.initial} initialName={planFoodEditor.initialName} copying={planFoodEditor.copying} profileId={profileId} onClose={() => setPlanFoodEditor(null)} onSave={savePlanFood} /> : null}
      {planMealBuilder ? <PlanMealBuilder initial={planMealBuilder.initial} copying={planMealBuilder.copying} catalog={foodCatalog} dayKey={clock.dayKey} onClose={() => setPlanMealBuilder(null)} onSave={(meal) => { saveUserMeal(meal); setPlanMealBuilder(null); }} /> : null}
      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite"><i>✓</i><span>{toast}</span>{toast.includes("tap Undo") ? <button className="toast-undo" onClick={undoDelete}>Undo</button> : null}</div>
    </div>
  );
}
