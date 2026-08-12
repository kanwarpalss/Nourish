"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { isCardIqFoodImport, type CardIqFoodImport } from "./cardiq-food";
import { getWeightTrendPoints, LEGACY_NUTRITION_STORAGE_KEY, LOCAL_NUTRITION_STORAGE_KEY, parseSavedNutritionState, shouldPersistNutritionState, shouldRestoreSavedNutritionState, stringifySavedNutritionState, upsertWeightEntry, type SavedNutritionState, type WeightEntry } from "./local-nutrition-state";
import { getBangaloreClock, getEnergyRunway, getQuantityLimit, isQuantityValid, matchesRecipe, scaleNutrition, sumLoggedNutrition, type DashboardClock } from "./prototype-logic";
import { meals, nutritionItems, SOURCE_LINKS, type Meal, type NutritionItem } from "./nutrition-data";

type Area = "plan" | "track";
type PlanView = "items" | "meals";
type TrackView = "today" | "history" | "trends" | "purchases";
type MacroKey = "protein" | "carbs" | "fat";
type Food = NutritionItem;
type Recipe = Meal;
type PlannedEntry = Pick<Meal, "id" | "name" | "calories" | "protein" | "carbs" | "fat" | "fiber"> & { serving: string; kind: "food" | "meal" };

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

const seedFoods = nutritionItems;
const recipes = meals;
const loggableMeals: Food[] = recipes.map((meal) => ({
  id: `meal-${meal.id}`,
  name: meal.name,
  brand: "Nourish",
  variant: meal.serving,
  amount: 1,
  unit: "serving",
  calories: meal.calories,
  protein: meal.protein,
  carbs: meal.carbs,
  fat: meal.fat,
  fiber: meal.fiber,
  category: "Meal",
  availability: meal.serving,
  aliases: meal.tags,
  source: { label: "Calculated recipe", url: SOURCE_LINKS.ifct, trust: "Reference" },
}));
const seedLogFoods = [...seedFoods, ...loggableMeals];

function foodLabel(food: Pick<Food, "brand" | "name" | "variant">) {
  return [food.brand, food.name, food.variant].map((part) => part.trim()).filter(Boolean).join(" · ");
}

function foodAtBasis(food: Food): Food {
  if (!food.basis) return food;
  return { ...food, amount: food.basis.amount, calories: food.basis.calories, protein: food.basis.protein, carbs: food.basis.carbs, fat: food.basis.fat, fiber: food.basis.fiber, basis: undefined };
}

function mergeFoodCatalog(base: Food[], overrides: Food[]) {
  const byId = new Map(overrides.map((food) => [food.id, food]));
  return [...base.map((food) => byId.get(food.id) ?? food), ...overrides.filter((food) => !base.some((candidate) => candidate.id === food.id))];
}

function isFoodDetailsValid(food: Food) {
  return Boolean(food.brand.trim() && food.name.trim() && isQuantityValid(food.unit, food.amount))
    && [food.amount, food.calories, food.protein, food.carbs, food.fat, food.fiber].every((value) => Number.isFinite(value) && value >= 0);
}

function planEntryFromFood(food: Food): PlannedEntry {
  return { id: food.id, kind: "food", name: foodLabel(food), serving: `${food.amount} ${food.unit}`, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber };
}

function planEntryFromMeal(meal: Recipe): PlannedEntry {
  return { id: meal.id, kind: "meal", name: meal.name, serving: meal.serving, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, fiber: meal.fiber };
}

function restoreNutritionState(saved: SavedNutritionState, dayKey: string, catalog: Food[]) {
  if (!shouldRestoreSavedNutritionState(saved, dayKey)) return { extras: [] as Food[], planned: [] as PlannedEntry[] };
  const extras = saved.logs.flatMap((entry): Food[] => {
    const food = entry.snapshot ?? catalog.find((candidate) => candidate.id === entry.foodId);
    return food && isQuantityValid(food.unit, entry.amount) ? [scaleNutrition(food, entry.amount)] : [];
  });
  const planned = saved.planned.flatMap((entry): PlannedEntry[] => {
    if (entry.kind === "meal") {
      const meal = recipes.find((candidate) => candidate.id === entry.id);
      return meal ? [planEntryFromMeal(meal)] : [];
    }
    const food = catalog.find((candidate) => candidate.id === entry.id);
    return food ? [planEntryFromFood(food)] : [];
  });
  return { extras, planned };
}

const sampleWeekCalories = [1980, 2140, 2050, 2210, 1890, 2070, 1280];
const sampleWeekAverage = Math.round(sampleWeekCalories.reduce((sum, value) => sum + value, 0) / sampleWeekCalories.length);
const sampleMonthDays = Array.from({ length: 31 }, (_, index) => ({
  day: index + 1,
  calories: [2080, 2180, 1970, 2250, 2060, 1910, 2120][index % 7] + ((index % 3) - 1) * 35,
  protein: 118 + (index % 5) * 7,
}));

const sampleMeals = [
  { type: "Breakfast", time: "8:10", name: "Masala oats + dahi", calories: 420, macro: "24P · 58C · 12F" },
  { type: "Lunch", time: "1:25", name: "Rajma chawal bowl", calories: 610, macro: "31P · 72C · 17F" },
  { type: "Snack", time: "4:40", name: "Banana + whey", calories: 250, macro: "29P · 31C · 3F" },
];

function MacroBar({ label, value, target, tone }: { label: string; value: number; target: number; tone: MacroKey }) {
  const percent = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="macro-row">
      <div className="macro-label">
        <span><i className={`macro-dot ${tone}`} />{label}</span>
        <strong>{value}<small> / {target}g</small></strong>
      </div>
      <div className="progress-track" role="progressbar" aria-label={`${label}: ${value} of ${target} grams`} aria-valuenow={value} aria-valuemin={0} aria-valuemax={target}>
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

function WeightCard({ dayKey, entries, onSave }: { dayKey: string; entries: WeightEntry[]; onSave: (entry: WeightEntry) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const [date, setDate] = useState(dayKey);
  const [kg, setKg] = useState("");
  const latest = entries.at(-1) ?? null;
  const previous = entries.at(-2) ?? null;
  const change = latest && previous ? Math.round((latest.kg - previous.kg) * 10) / 10 : null;
  const points = getWeightTrendPoints(entries, 300, 92);
  const chartPath = points.map((point) => `${point.x},${point.y}`).join(" ");
  const kgNumber = Number(kg);
  const valid = Number.isFinite(kgNumber) && kgNumber >= 20 && kgNumber <= 400;

  return (
    <section className="weight-card surface-card">
      <div className="section-title-row">
        <div><span className="eyebrow">Body weight</span><h2>{latest ? `${latest.kg.toFixed(1)} kg` : "Start your trend"}</h2></div>
        <button className="weight-add-button" onClick={() => setShowForm((value) => !value)}>{showForm ? "Close" : "+ Log"}</button>
      </div>
      {latest ? <div className="weight-summary"><span>Last logged {latest.date === dayKey ? "today" : latest.date}</span>{change !== null ? <strong>{change > 0 ? "+" : ""}{change.toFixed(1)} kg <small>from prior log</small></strong> : <strong>First entry</strong>}</div> : <p className="weight-empty">Log whenever you weigh in. No daily streaks or pressure.</p>}
      {showForm ? <form className="weight-form" onSubmit={(event) => { event.preventDefault(); if (!valid) return; onSave({ date, kg: kgNumber }); setKg(""); setShowForm(false); }}>
        <label><span>Date</span><input type="date" max={dayKey} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label><span>Weight</span><div><input type="number" min="20" max="400" step="0.1" inputMode="decimal" value={kg} onChange={(event) => setKg(event.target.value)} placeholder="72.5" aria-label="Weight in kilograms" /><b>kg</b></div></label>
        <button className="button primary" disabled={!valid}>Save</button>
      </form> : null}
      {entries.length ? <button className="weight-trend-toggle" onClick={() => setShowTrend((value) => !value)} aria-expanded={showTrend}>{showTrend ? "Hide trend" : "Show trend chart"} <span>{showTrend ? "↑" : "↗"}</span></button> : null}
      {showTrend ? <div className="weight-chart-wrap">
        <svg className="weight-chart" viewBox="-8 -8 316 108" role="img" aria-label={`Weight trend from ${entries[0].kg} to ${latest?.kg} kilograms across ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`} preserveAspectRatio="none">
          <polyline points={chartPath} />
          {points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="4" />)}
        </svg>
        <div><span>{entries[0].date}</span><strong>{entries.length} {entries.length === 1 ? "entry" : "entries"}</strong><span>{latest?.date}</span></div>
      </div> : null}
    </section>
  );
}

function TodayView({ clock, calories, macros, extras, quickFoods, weights, hasCardIqImport, onLog, onAdd, onEdit, onSaveWeight, onOpenMeals }: {
  clock: DashboardClock;
  calories: number;
  macros: Record<MacroKey, number>;
  extras: Food[];
  quickFoods: Food[];
  weights: WeightEntry[];
  hasCardIqImport: boolean;
  onLog: () => void;
  onAdd: (food: Food) => void;
  onEdit: (index: number) => void;
  onSaveWeight: (entry: WeightEntry) => void;
  onOpenMeals: () => void;
}) {
  const target = 2150;
  const runway = getEnergyRunway(calories, target);
  const circleProgress = Math.min(100, runway.percentage);
  const circleStyle = { "--energy-progress": `${circleProgress * 3.6}deg` } as CSSProperties;
  const description = calories === 0
    ? "Nothing is assumed. Start by logging what you actually ate today."
    : `You’ve logged ${Math.round(calories).toLocaleString("en-IN")} kcal today. Add or edit foods whenever you need.`;

  return (
    <>
      <SectionHeading
        eyebrow={clock.dateLabel}
        title={`${clock.greeting}, KP`}
        description={description}
        action={<button className="button primary" onClick={onLog}><span>＋</span> Log food</button>}
      />

      <div className="today-layout">
        <section className="energy-card dark-card">
          <div className="card-kicker"><span>Daily energy</span><span className={`status-pill ${runway.isOver ? "over" : ""}`}>{runway.isOver ? "Over sample target" : "Sample target"}</span></div>
          <div className="energy-main">
            <div className="energy-ring" style={circleStyle} role="progressbar" aria-label={`${calories} of ${target} calories eaten`} aria-valuenow={calories} aria-valuemin={0} aria-valuemax={target}>
              <div><strong>{Math.round(calories).toLocaleString("en-IN")}</strong><span>kcal eaten</span></div>
            </div>
            <div className="runway">
              <span>{runway.isOver ? "Above sample target" : "To sample target"}</span>
              <strong>{runway.amount.toLocaleString("en-IN")}</strong>
              <small>{runway.isOver ? "kcal over" : "kcal remaining"}</small>
              <p>{runway.percentage}% of the sample {target.toLocaleString("en-IN")} kcal target</p>
              <button className="button orange" onClick={onLog}>＋ Log food</button>
            </div>
          </div>
          <div className="macro-stack dark-macros">
            <span className="sample-context">Sample macro targets · replace during onboarding</span>
            <MacroBar label="Protein" value={macros.protein} target={150} tone="protein" />
            <MacroBar label="Carbs" value={macros.carbs} target={215} tone="carbs" />
            <MacroBar label="Fat" value={macros.fat} target={72} tone="fat" />
          </div>
        </section>

        <section className="timeline-panel">
          <div className="section-title-row">
            <div><span className="eyebrow">Food diary</span><h2>Today’s timeline</h2></div>
            <span className="soft-badge">{extras.length} {extras.length === 1 ? "item" : "items"} logged</span>
          </div>
          <div className={`meal-timeline ${extras.length > 1 ? "connected" : ""}`}>
            {extras.length === 0 ? <div className="timeline-empty"><strong>No food logged yet</strong><span>Your actual entries—and only your actual entries—will appear here.</span><button className="text-button" onClick={onLog}>Log your first food</button></div> : extras.map((food, index) => (
              <article className="meal-entry added" key={`${food.name}-${index}`}>
                <i className="timeline-dot" />
                <div className="meal-meta"><span className="logged-volume">{food.amount} {food.unit} logged today</span><strong>{foodLabel(food)}</strong><small>{food.protein.toFixed(1)}P · {food.carbs.toFixed(1)}C · {food.fat.toFixed(1)}F</small></div>
                <div className="entry-actions"><b>{Math.round(food.calories)} kcal</b><button onClick={() => onEdit(index)}>Edit food & quantity</button></div>
              </article>
            ))}
          </div>
        </section>

        <aside className="today-rail">
          <section className="quick-card surface-card">
            <div className="section-title-row"><div><span className="eyebrow">{hasCardIqImport ? "From cardIQ" : "One tap"}</span><h2>Quick add</h2></div><button className="text-button" onClick={onLog}>See all</button></div>
            <div className="quick-grid">
              {quickFoods.slice(0, 4).map((food) => (
                <button key={food.id} onClick={() => onAdd(food)}><span>{foodLabel(food)}</span><b>＋</b></button>
              ))}
            </div>
          </section>
          <WeightCard dayKey={clock.dayKey} entries={weights} onSave={onSaveWeight} />
          <section className="nudge-card dark-card">
            <span className="eyebrow bright">Sample meal idea · not logged</span>
            <h2>Pepper chicken cauliflower rice</h2>
            <p>A researched example with 56 g protein and 10.8 g fibre for 406 kcal. Browse it before choosing anything.</p>
            <button className="button lime" onClick={onOpenMeals}>Browse meals <span>→</span></button>
          </section>
          <section className="week-card surface-card">
            <div className="section-title-row"><div><span className="eyebrow">Sample data · 7 days</span><h2>Energy rhythm preview</h2></div><strong>{sampleWeekAverage.toLocaleString("en-IN")} <small>sample avg</small></strong></div>
            <div className="mini-bars" role="img" aria-label="Sample seven-day calorie chart, not your real history">
              {sampleWeekCalories.map((value, index) => <span key={`${value}-${index}`} className={index === 6 ? "active" : ""} style={{ height: `${Math.round((value / 2300) * 100)}%` }}><i>{["S", "M", "T", "W", "T", "F", "S"][index]}</i></span>)}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function HistoryView() {
  const [selected, setSelected] = useState(8);
  const day = sampleMonthDays[selected - 1];
  return (
    <>
      <SectionHeading eyebrow="Track · History · Sample preview" title="What your history will look like" description="Everything in this view is illustrative until Nourish has enough of your real dated logs." action={<span className="prototype-badge">Sample data</span>} />
      <div className="history-layout">
        <section className="surface-card calendar-card">
          <div className="section-title-row"><div><span className="eyebrow">Sample month · August 2026</span><h2>Example calorie consistency</h2></div><span className="prototype-badge">Not your data</span></div>
          <div className="calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}</div>
          <div className="month-grid">
            {sampleMonthDays.map((item) => {
              const state = item.calories > 2180 ? "over" : item.calories < 1950 ? "under" : "within";
              return <button key={item.day} className={`${state} ${selected === item.day ? "selected" : ""}`} onClick={() => setSelected(item.day)} aria-pressed={selected === item.day}><span>{item.day}</span><b>{item.calories}</b><small>kcal</small></button>;
            })}
          </div>
        </section>
        <aside className="history-detail dark-card">
          <span className="eyebrow bright">Sample day · {selected} August</span>
          <h2>{day.calories.toLocaleString("en-IN")} <small>kcal</small></h2>
          <p className="history-message">A steady day with a strong lunch and room left for an intentional dinner.</p>
          <div className="history-metrics">
            <div><span>Protein</span><strong>{day.protein} g</strong></div>
            <div><span>Carbs</span><strong>204 g</strong></div>
            <div><span>Fat</span><strong>68 g</strong></div>
          </div>
          <div className="history-meals">
            {sampleMeals.map((meal) => <div key={meal.type}><span>{meal.type}</span><strong>{meal.name}</strong><b>{meal.calories}</b></div>)}
          </div>
          <span className="sample-note">Sample only · real dated history is not available yet.</span>
        </aside>
      </div>
    </>
  );
}

function TrendsView() {
  const range = "30D";
  const sampleBars = [72, 84, 68, 91, 77, 82, 73, 88, 79, 86, 69, 76, 90, 83];
  return (
    <>
      <SectionHeading eyebrow="Track · Trends · Sample preview" title="What your trends will look like" description="These charts demonstrate the future experience; none of the values or insights below are based on your food diary yet." action={<span className="prototype-badge">Sample data</span>} />
      <div className="trends-grid">
        <section className="surface-card calorie-trend">
          <div className="section-title-row"><div><span className="eyebrow">Sample daily energy · {range}</span><h2>Illustrative calorie pattern</h2></div><span className="prototype-badge">Not your data</span></div>
          <div className="trend-chart" role="img" aria-label={`${range} sample calorie trend, not your real data`}>
            <i className="target-line"><span>Sample target</span></i>
            {sampleBars.map((height, index) => <span key={`${height}-${index}`} className={index > 10 ? "recent" : ""} style={{ height: `${height}%` }} />)}
          </div>
          <div className="chart-axis"><span>10 Jul</span><span>24 Jul</span><span>8 Aug</span></div>
        </section>
        <section className="trend-insight dark-card">
          <span className="eyebrow bright">Sample insight · not yours</span>
          <h2>Nourish will surface patterns after enough real logs.</h2>
          <p>For example, it could notice when protein tends to be missed earlier in the day—without pretending that pattern exists yet.</p>
          <div className="insight-number"><strong>Example</strong><span>Real insights will cite the days and meals behind them.</span></div>
        </section>
        <section className="surface-card macro-average">
          <span className="eyebrow">Sample macro split</span><h2>Illustrative only</h2>
          <div className="macro-donut" role="img" aria-label="Sample energy split, not your real data"><div><strong>29%</strong><span>sample</span></div></div>
          <div className="macro-legend"><span><i className="protein" />Protein <b>29%</b></span><span><i className="carbs" />Carbs <b>42%</b></span><span><i className="fat" />Fat <b>29%</b></span></div>
        </section>
        <section className="surface-card consistency-card">
          <span className="eyebrow">Sample consistency</span><h2>Example month</h2><p>Real consistency appears after you have enough dated logs.</p>
          <div className="dot-field">{Array.from({ length: 30 }, (_, i) => <i key={i} className={i < 18 ? "hit" : i < 26 ? "near" : "miss"} />)}</div>
        </section>
      </div>
    </>
  );
}

function PurchasesView({ onAdd, cardIqImport, catalog }: { onAdd: (food: Food) => void; cardIqImport: CardIqFoodImport | null; catalog: Food[] }) {
  const [filter, setFilter] = useState<"All" | "Needs review">("All");
  const purchaseItems = (cardIqImport?.items ?? []).map((item) => {
    const food = item.matchedFoodId ? catalog.find((candidate) => candidate.id === item.matchedFoodId) ?? null : null;
    return { ...item, food, match: food ? "Matched" as const : "Review" as const, cal: food ? `${Math.round(food.calories)} kcal / ${food.amount} ${food.unit}` : "Exact pack label needed" };
  });
  const shown = filter === "Needs review" ? purchaseItems.filter((item) => item.match === "Review") : purchaseItems;
  const stores = ["Instamart", "Amazon", "BigBasket"] as const;
  return (
    <>
      <SectionHeading eyebrow="Track · Purchases" title="Your food shelf, already waiting" description={cardIqImport ? `Your actual food products from the last year of cardIQ orders. Matched foods are ready to log; the rest wait for an exact nutrition label.` : "Run the local cardIQ import to bring your real orders here. No order history is stored in Git."} action={<span className="prototype-badge">{cardIqImport ? `Synced ${cardIqImport.generatedAt.slice(0, 10)}` : "Local import needed"}</span>} />
      <div className="purchase-summary">
        {stores.map((name, index) => { const items = purchaseItems.filter((item) => item.store === name); const ready = items.filter((item) => item.food).length; return <section className={`source-card dark-card ${["lime", "orange", "cream"][index]}`} key={name}><span>{name}</span><strong>{items.length}</strong><small>food products in the last year</small><i>{ready} nutrition-ready</i></section>; })}
      </div>
      <section className="surface-card purchase-table-card">
        <div className="section-title-row"><div><span className="eyebrow">Personal catalogue</span><h2>Recently purchased foods</h2></div><div className="table-actions"><button className={`chip ${filter === "All" ? "active" : ""}`} onClick={() => setFilter("All")}>All</button><button className={`chip ${filter === "Needs review" ? "active" : ""}`} onClick={() => setFilter("Needs review")}>Needs review</button></div></div>
        <div className="purchase-table">
          <div className="purchase-row header"><span>Item</span><span>Store</span><span>Nutrition</span><span>Status</span><span /></div>
          {shown.map((item) => <div className="purchase-row" key={`${item.store}-${item.name}`}><span className="purchase-name"><b>{item.name}</b><small>{item.orderCount} order{item.orderCount === 1 ? "" : "s"} · last {item.lastOrdered}</small></span><span><em>{item.store}</em></span><span>{item.cal}</span><span><i className={item.match === "Matched" ? "matched" : "review"}>{item.food ? item.matchKind ?? item.match : "Needs label"}</i></span><span><button aria-label={item.food ? `Quick add ${item.name}` : `${item.name} needs nutrition review`} disabled={!item.food} onClick={() => { if (item.food) onAdd(item.food); }}>＋</button></span></div>)}
          {shown.length === 0 ? <div className="empty-state"><strong>{cardIqImport ? "Nothing in this view." : "Your cardIQ food snapshot is not here yet."}</strong><span>{cardIqImport ? "Try the other filter." : "The importer keeps your personal purchase history on this Mac only."}</span></div> : null}
        </div>
      </section>
    </>
  );
}

function PlanSummary({ entries, onRemove }: { entries: PlannedEntry[]; onRemove: (index: number) => void }) {
  const totals = entries.reduce((sum, entry) => ({ calories: sum.calories + entry.calories, protein: sum.protein + entry.protein, carbs: sum.carbs + entry.carbs, fat: sum.fat + entry.fat, fiber: sum.fiber + entry.fiber }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  return (
    <section className="plan-summary dark-card">
      <div><span className="eyebrow bright">Today’s draft</span><h2>{entries.length ? `${Math.round(totals.calories).toLocaleString("en-IN")} kcal planned` : "Build from items or meals"}</h2><p>{entries.length ? `${totals.protein.toFixed(1)}P · ${totals.carbs.toFixed(1)}C · ${totals.fat.toFixed(1)}F · ${totals.fiber.toFixed(1)}g fibre` : "Anything you add from either Plan section lands in one shared draft."}</p></div>
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
        <button className="button secondary full recipe-plan-button" onClick={() => onPlan(recipe)}>＋ Add meal to plan</button>
      </div>
    </article>
  );
}

function ItemsView({ planned, catalog, onPlan, onRemove }: { planned: PlannedEntry[]; catalog: Food[]; onPlan: (food: Food) => void; onRemove: (index: number) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const query = search.trim().toLowerCase();
  const shown = catalog.filter((food) => food.category !== "Meal" && (filter === "All" || food.category === filter) && (!query || [food.name, food.brand, food.variant, ...food.aliases].join(" ").toLowerCase().includes(query)));
  return (
    <>
      <SectionHeading eyebrow="Plan · Items" title="Start with the exact thing" description="Search products you buy and raw ingredients you can find around Bengaluru. Every result keeps its serving basis and evidence strength." action={<span className="prototype-badge">{catalog.filter((food) => food.category !== "Meal").length} items</span>} />
      <PlanSummary entries={planned} onRemove={onRemove} />
      <section className="item-search-hero surface-card">
        <div className="catalogue-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search products and ingredients" placeholder="Search Nandini milk, chia, chicken, paneer…" /></div>
        <div className="filter-row" aria-label="Item filters">{["All", "Ordered", "Product", "Ingredient"].map((item) => <button className={`chip ${filter === item ? "active" : ""}`} key={item} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>)}</div>
      </section>
      <div className="item-catalogue-grid">{shown.map((food) => <article className="item-card surface-card" key={food.id}>
        <div className="item-card-head"><span className={`trust-mark ${food.source.trust === "Label mirror" ? "review" : ""}`}>{food.source.trust}</span><small>{food.availability}</small></div>
        <div><span className="item-brand">{food.brand}</span><h2>{food.name}</h2>{food.variant ? <span className="item-variant">{food.variant}</span> : null}<p>Per {food.amount} {food.unit}</p></div>
        <div className="item-nutrition"><strong>{Math.round(food.calories)}<small> kcal</small></strong><span>{food.protein}g <small>protein</small></span><span>{food.carbs}g <small>carbs</small></span><span>{food.fat}g <small>fat</small></span><span>{food.fiber}g <small>fibre</small></span></div>
        <div className="item-card-actions"><a href={food.source.url} target="_blank" rel="noreferrer">Source ↗</a><button className="button primary" onClick={() => onPlan(food)}>＋ Plan this</button></div>
      </article>)}</div>
      {shown.length === 0 ? <div className="empty-state"><strong>No researched item matches yet.</strong><span>Try a broader name; exact cardIQ products arrive in the purchase-import phase.</span><button className="button secondary" onClick={() => { setSearch(""); setFilter("All"); }}>Clear search</button></div> : null}
      <div className="research-footnote"><span>Research base</span><a href={SOURCE_LINKS.ifct} target="_blank" rel="noreferrer">ICMR–NIN IFCT</a><a href={SOURCE_LINKS.usda} target="_blank" rel="noreferrer">USDA FoodData Central</a><a href={SOURCE_LINKS.fssai} target="_blank" rel="noreferrer">FSSAI labelling</a></div>
    </>
  );
}

function MealsView({ onRecipe, planned, onPlan, onRemove }: { onRecipe: (recipe: Recipe) => void; planned: PlannedEntry[]; onPlan: (recipe: Recipe) => void; onRemove: (index: number) => void }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const shown = recipes.filter((recipe) => matchesRecipe(recipe, search, filter));
  return (
    <>
      <SectionHeading eyebrow="Plan · Meals" title="Healthy food with actual receipts" description="Creative Indian-first meals calculated from weighed ingredients, with cooking oil counted and the evidence trail kept visible." action={<span className="prototype-badge">{recipes.length} calculated meals</span>} />
      <PlanSummary entries={planned} onRemove={onRemove} />
      <section className="discover-hero dark-card">
        <div><span className="eyebrow bright">Curated in Bengaluru</span><h2>Joy first.<br />Numbers intact.</h2><p>Brownies, chia bowls, paneer, rajma and cauliflower rice—built from ingredients you can realistically source in India.</p></div>
        <div className="hero-search"><label htmlFor="recipe-search">What do you feel like eating?</label><div><span>⌕</span><input id="recipe-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brownies, chia, chicken, breakfast…" /></div></div>
        <div className="hero-stat"><strong>{recipes.filter((recipe) => recipe.tags.includes("High protein")).length}</strong><span>meals with at least<br />25 g protein</span></div>
      </section>
      <div className="filter-row meal-filter-row" aria-label="Meal filters">{["All", "High protein", "Low fat", "High fibre", "Vegetarian", "Vegan", "30 min or less"].map((item) => <button className={`chip ${filter === item ? "active" : ""}`} key={item} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>)}</div>
      <div className="filter-definition"><span><b>High protein</b> 25g+</span><span><b>Low fat</b> ≤10g</span><span><b>High fibre</b> 8g+</span><small>Transparent app filters, not regulatory label claims.</small></div>
      <div className="recipe-grid">{shown.map((recipe) => <RecipeCard recipe={recipe} onOpen={onRecipe} onPlan={onPlan} key={recipe.id} />)}</div>
      {shown.length === 0 ? <div className="empty-state"><strong>No meals match that combination yet.</strong><span>Try a broader search or clear the active filter.</span><button className="button secondary" onClick={() => { setSearch(""); setFilter("All"); }}>Clear filters</button></div> : null}
      <div className="research-footnote"><span>Built from</span><a href={SOURCE_LINKS.ninGuidelines} target="_blank" rel="noreferrer">ICMR–NIN 2024 guidance</a><a href={SOURCE_LINKS.ifct} target="_blank" rel="noreferrer">Indian Food Composition Tables</a><a href={SOURCE_LINKS.usda} target="_blank" rel="noreferrer">USDA FoodData Central</a></div>
    </>
  );
}

function getShownLogFoods(catalog: Food[], tab: string, search: string) {
  const query = search.trim().toLowerCase();
  return catalog.filter((food) => {
    const matchesTab = query ? true : tab === "Commonly ordered" ? food.common : tab === "Products" ? food.category === "Ordered" || food.category === "Product" : tab === "Ingredients" ? food.category === "Ingredient" : food.category === "Meal";
    const matchesSearch = !query || [food.name, food.brand, food.variant, ...food.aliases].join(" ").toLowerCase().includes(query);
    return matchesTab && matchesSearch;
  });
}

function FoodDialog({ initialFood, editing, catalog, onClose, onAdd, onSaveFood }: { initialFood: Food | null; editing: boolean; catalog: Food[]; onClose: () => void; onAdd: (food: Food) => void; onSaveFood: (food: Food) => void }) {
  const initial = initialFood ? foodAtBasis(initialFood) : catalog.find((food) => food.common) ?? catalog[0];
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(initialFood?.category === "Meal" ? "Meals" : initialFood && !initialFood.common ? (initialFood.category === "Ingredient" ? "Ingredients" : "Products") : "Commonly ordered");
  const [selectedId, setSelectedId] = useState(initial.id);
  const [quantity, setQuantity] = useState(initialFood?.amount ?? initial.amount);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draft, setDraft] = useState<Food>(initial);
  const [editedFood, setEditedFood] = useState<Food | null>(null);
  const dialogCatalog = catalog.map((food) => {
    if (editedFood?.id === food.id) return editedFood;
    if (editing && initialFood?.id === food.id) return foodAtBasis(initialFood);
    return food;
  });
  const shown = getShownLogFoods(dialogCatalog, tab, search);
  const selected = shown.find((food) => food.id === selectedId) ?? null;
  const step = selected?.unit === "ml" ? 50 : selected?.unit === "g" ? 10 : selected?.unit === "scoop" || selected?.unit === "serving" ? 0.25 : 1;
  const maxQuantity = selected ? getQuantityLimit(selected.unit) : 0;
  const quantityValid = selected ? isQuantityValid(selected.unit, quantity) : false;
  const scaled = selected ? scaleNutrition(selected, quantityValid ? quantity : 0) : null;
  const labelBasis = selected ? selected.basis?.amount ?? selected.amount : 0;
  const keepSelectionVisible = (nextTab: string, nextSearch: string) => {
    const candidates = getShownLogFoods(dialogCatalog, nextTab, nextSearch);
    if (candidates.some((food) => food.id === selectedId)) return;
    setSelectedId(candidates[0]?.id ?? "");
    setQuantity(candidates[0]?.amount ?? 0);
    setDetailsOpen(false);
  };
  const openDetails = () => {
    if (!selected) return;
    setDraft(foodAtBasis(selected));
    setDetailsOpen(true);
  };
  const saveDetails = () => {
    if (!isFoodDetailsValid(draft)) return;
    const saved: Food = {
      ...draft,
      brand: draft.brand.trim(),
      name: draft.name.trim(),
      variant: draft.variant.trim(),
      basis: undefined,
      source: { ...draft.source, label: "Edited by you", trust: "Personal" },
    };
    setEditedFood(saved);
    onSaveFood(saved);
    if (!editing || !isQuantityValid(saved.unit, quantity)) setQuantity(saved.amount);
    setDetailsOpen(false);
  };
  const close = () => {
    setSearch("");
    onClose();
  };
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <section className="food-dialog" role="dialog" aria-modal="true" aria-labelledby="log-food-title">
        <header><div><span className="eyebrow">Track</span><h2 id="log-food-title">{editing ? "Edit logged food" : "Log food"}</h2></div><button className="close-button" onClick={close} aria-label="Close food logger">×</button></header>
        <div className="dialog-search"><span>⌕</span><input autoFocus value={search} onChange={(event) => { const next = event.target.value; setSearch(next); keepSelectionVisible(tab, next); }} placeholder="Search food, recipe or recent purchase" /></div>
        <div className="dialog-tabs">{["Commonly ordered", "Products", "Ingredients", "Meals"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => { setTab(item); keepSelectionVisible(item, search); }} key={item}>{item}</button>)}</div>
        <div className="food-dialog-body">
          <div className="food-results">{shown.map((food) => <button className={selected?.id === food.id ? "selected" : ""} key={food.id} onClick={() => { setSelectedId(food.id); setQuantity(food.amount); setDetailsOpen(false); }}><span className="food-initial">{food.name.charAt(0)}</span><span><strong>{foodLabel(food)}</strong><small>{food.amount} {food.unit} · {food.source.trust}</small></span><span><b>{Math.round(food.calories)}</b><small>kcal</small></span><i>→</i></button>)}{shown.length === 0 ? <div className="food-results-empty"><strong>No match yet</strong><span>Try the product, brand, item, or variant name.</span></div> : null}</div>
          {selected && scaled ? <aside className={`quantity-editor dark-card ${detailsOpen ? "details-mode" : ""}`}>
            {detailsOpen ? <div className="food-details-editor">
              <div className="details-heading"><div><span className="eyebrow bright">Food details</span><h3>Edit anything</h3></div><button onClick={() => setDetailsOpen(false)} aria-label="Cancel food details edit">×</button></div>
              <p>Brand and item name are required. Variant can be blank.</p>
              <div className="identity-fields">
                <label><span>Brand *</span><input value={draft.brand} onChange={(event) => setDraft((food) => ({ ...food, brand: event.target.value }))} /></label>
                <label><span>Item name *</span><input value={draft.name} onChange={(event) => setDraft((food) => ({ ...food, name: event.target.value }))} /></label>
                <label><span>Variant</span><input value={draft.variant} onChange={(event) => setDraft((food) => ({ ...food, variant: event.target.value }))} placeholder="Optional, e.g. Slim / 100 ml" /></label>
              </div>
              <div className="serving-fields">
                <label><span>Nutrition basis</span><input type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft((food) => ({ ...food, amount: Number(event.target.value) }))} /></label>
                <label><span>Unit</span><select value={draft.unit} onChange={(event) => setDraft((food) => ({ ...food, unit: event.target.value as Food["unit"] }))}>{["g", "ml", "scoop", "pack", "piece", "serving"].map((unit) => <option key={unit}>{unit}</option>)}</select></label>
              </div>
              <div className="nutrition-fields">
                {(["calories", "protein", "carbs", "fat", "fiber"] as const).map((field) => <label key={field}><span>{field === "fiber" ? "Fibre" : field.charAt(0).toUpperCase() + field.slice(1)}</span><div><input type="number" min="0" step="0.1" value={draft[field]} onChange={(event) => setDraft((food) => ({ ...food, [field]: Number(event.target.value) }))} /><b>{field === "calories" ? "kcal" : "g"}</b></div></label>)}
              </div>
              <button className="button lime full" disabled={!isFoodDetailsValid(draft)} onClick={saveDetails}>Save to My Foods</button>
            </div> : <>
            <span className="eyebrow bright">Quantity</span><h3>{foodLabel(selected)}</h3><p>Nutrition updates while you edit.</p>
            <div className="quantity-control"><button onClick={() => setQuantity((value) => Math.max(step, Number((value - step).toFixed(2))))} aria-label={`Decrease ${selected.name} quantity`}>−</button><label><input type="number" min={step} max={maxQuantity} step={step} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} aria-label={`${selected.name} quantity`} /><span>{selected.unit}</span></label><button onClick={() => setQuantity((value) => Math.min(maxQuantity, Number((value + step).toFixed(2))))} aria-label={`Increase ${selected.name} quantity`}>＋</button></div>
            <small className={`quantity-basis ${quantityValid ? "" : "error"}`}>{quantityValid ? `You are adding ${quantity} ${selected.unit} · nutrition basis ${labelBasis} ${selected.unit}` : `Enter more than 0 and no more than ${maxQuantity} ${selected.unit}`}</small>
            <div className="live-nutrition"><strong><b>{Math.round(scaled.calories)}</b><small>kcal</small></strong><span><b>{scaled.protein.toFixed(1)}g</b><small>protein</small></span><span><b>{scaled.carbs.toFixed(1)}g</b><small>carbs</small></span><span><b>{scaled.fat.toFixed(1)}g</b><small>fat</small></span><span><b>{scaled.fiber.toFixed(1)}g</b><small>fibre</small></span></div>
            <button className="edit-food-button" onClick={openDetails}>✎ Edit name, serving & nutrition</button>
            {selected.source.url ? <a href={selected.source.url} target="_blank" rel="noreferrer">{selected.source.label} ↗</a> : <span className="personal-source">{selected.source.label}</span>}
            <button className="button lime full add-food-button" disabled={!quantityValid} onClick={() => onAdd(scaled)}>{editing ? "Update" : "Add"} {quantity} {selected.unit} · {Math.round(scaled.calories)} kcal</button>
            </>}
          </aside> : <aside className="quantity-editor quantity-editor-empty dark-card"><span className="eyebrow bright">Quantity</span><h3>Choose a food</h3><p>The quantity editor will appear when a result is selected.</p></aside>}
        </div>
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

export default function Home() {
  const [clock, setClock] = useState(() => getBangaloreClock(new Date()));
  const [area, setArea] = useState<Area>("track");
  const [trackView, setTrackView] = useState<TrackView>("today");
  const [planView, setPlanView] = useState<PlanView>("items");
  const [foodDialog, setFoodDialog] = useState(false);
  const [foodDialogSelection, setFoodDialogSelection] = useState<Food | null>(null);
  const [editingFoodIndex, setEditingFoodIndex] = useState<number | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [planned, setPlanned] = useState<PlannedEntry[]>([]);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const [extras, setExtras] = useState<Food[]>([]);
  const [customFoods, setCustomFoods] = useState<Food[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const loadedDayRef = useRef<string | null>(null);
  const [cardIqImport, setCardIqImport] = useState<CardIqFoodImport | null>(null);
  const foodCatalog = mergeFoodCatalog(seedLogFoods, customFoods);
  const notify = (message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => {
      setToast("");
      toastTimer.current = null;
    }, 2600);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(LOCAL_NUTRITION_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_NUTRITION_STORAGE_KEY);
      } catch {
        window.setTimeout(() => notify("Nourish could not read saved data in this browser"), 0);
      }
      const saved = parseSavedNutritionState(raw);
      const restored = restoreNutritionState(saved, clock.dayKey, mergeFoodCatalog(seedLogFoods, saved.customFoods));
      setExtras(restored.extras);
      setPlanned(restored.planned);
      setCustomFoods(saved.customFoods);
      setWeights(saved.weights);
      loadedDayRef.current = clock.dayKey;
      setStorageLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clock.dayKey]);
  useEffect(() => {
    if (!shouldPersistNutritionState(storageLoaded, loadedDayRef.current, clock.dayKey)) return;
    const saved: SavedNutritionState = {
      dayKey: clock.dayKey,
      logs: extras.map((food) => ({ foodId: food.id, amount: food.amount, snapshot: food })),
      planned: planned.map((entry) => ({ id: entry.id, kind: entry.kind })),
      customFoods,
      weights,
    };
    try {
      window.localStorage.setItem(LOCAL_NUTRITION_STORAGE_KEY, stringifySavedNutritionState(saved));
    } catch {
      window.setTimeout(() => notify("Nourish could not save on this browser"), 0);
    }
  }, [clock.dayKey, extras, planned, customFoods, weights, storageLoaded]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(getBangaloreClock(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/cardiq-food-import.json")
      .then((response) => response.ok ? response.json() : null)
      .then((value: unknown) => { if (active && isCardIqFoodImport(value)) setCardIqImport(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  const cardIqQuickFoods = (cardIqImport?.items ?? []).flatMap((item) => {
    const food = item.matchedFoodId ? foodCatalog.find((candidate) => candidate.id === item.matchedFoodId) : null;
    return food ? [food] : [];
  }).filter((food, index, all) => all.findIndex((candidate) => candidate.id === food.id) === index);
  const quickFoods = cardIqQuickFoods.length ? cardIqQuickFoods : foodCatalog.filter((food) => food.common);
  const totals = sumLoggedNutrition(extras, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const calories = totals.calories;
  const macros = { protein: totals.protein, carbs: totals.carbs, fat: totals.fat };

  const nav = area === "track" ? trackNav : planNav;
  const activeView = area === "track" ? trackView : planView;
  const addFood = (food: Food) => {
    const previous = editingFoodIndex === null ? null : extras[editingFoodIndex];
    setExtras((value) => editingFoodIndex === null ? [...value, food] : value.map((entry, index) => index === editingFoodIndex ? food : entry));
    setFoodDialog(false);
    setFoodDialogSelection(null);
    setEditingFoodIndex(null);
    notify(`${food.name} ${previous ? "updated" : "added"} · ${Math.round(food.calories)} kcal`);
  };
  const openFoodLogger = (food: Food | null = null, editIndex: number | null = null) => {
    setFoodDialogSelection(food);
    setEditingFoodIndex(editIndex);
    setFoodDialog(true);
  };
  const saveCustomFood = (food: Food) => {
    setCustomFoods((value) => [...value.filter((candidate) => candidate.id !== food.id), food]);
    notify(`${foodLabel(food)} saved to My Foods`);
  };
  const saveWeight = (entry: WeightEntry) => {
    setWeights((value) => upsertWeightEntry(value, entry));
    notify(`${entry.kg.toFixed(1)} kg logged for ${entry.date}`);
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
      if (trackView === "today") return <TodayView clock={clock} calories={calories} macros={macros} extras={extras} quickFoods={quickFoods} weights={weights} hasCardIqImport={cardIqImport !== null} onLog={() => openFoodLogger()} onAdd={(food) => openFoodLogger(food)} onEdit={(index) => openFoodLogger(extras[index], index)} onSaveWeight={saveWeight} onOpenMeals={() => { setArea("plan"); setPlanView("meals"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />;
      if (trackView === "history") return <HistoryView />;
      if (trackView === "trends") return <TrendsView />;
      return <PurchasesView cardIqImport={cardIqImport} catalog={foodCatalog} onAdd={(food) => openFoodLogger(food)} />;
    }
    if (planView === "items") return <ItemsView planned={planned} catalog={foodCatalog} onPlan={addItemToPlan} onRemove={removeFromPlan} />;
    return <MealsView onRecipe={setRecipe} planned={planned} onPlan={addMealToPlan} onRemove={removeFromPlan} />;
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand"><span>N</span><div><strong>Nourish</strong><small>Personal nutrition</small></div></div>
        <div className="area-switch" aria-label="Main sections"><button className={area === "plan" ? "active" : ""} onClick={() => switchArea("plan")}><span>PLAN</span><small>Decide what to eat</small></button><button className={area === "track" ? "active" : ""} onClick={() => switchArea("track")}><span>TRACK</span><small>See how you’re doing</small></button></div>
        <nav className="side-nav" aria-label={`${area} navigation`}>{nav.map((item) => <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => switchView(item.id)}><i>{item.icon}</i><span>{item.label}</span></button>)}</nav>
        <div className="sidebar-footer"><span className="kp-avatar">KP</span><div><strong>Kanwar</strong><small>Sample target · 2,150 kcal</small></div><button aria-label="Open settings">•••</button></div>
      </aside>
      <div className="mobile-topbar"><div className="brand"><span>N</span><strong>Nourish</strong></div><div className="mobile-area"><button className={area === "plan" ? "active" : ""} onClick={() => switchArea("plan")}>Plan</button><button className={area === "track" ? "active" : ""} onClick={() => switchArea("track")}>Track</button></div><span className="kp-avatar">KP</span></div>
      <div className="mobile-subnav">{nav.map((item) => <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => switchView(item.id)}>{item.label}</button>)}</div>
      <main className="workspace">{renderContent()}</main>
      {area === "track" ? <button className="mobile-log-button" onClick={() => openFoodLogger()}>＋ Log food</button> : null}
      {foodDialog ? <FoodDialog initialFood={foodDialogSelection} editing={editingFoodIndex !== null} catalog={foodCatalog} onClose={() => { setFoodDialog(false); setFoodDialogSelection(null); setEditingFoodIndex(null); }} onAdd={addFood} onSaveFood={saveCustomFood} /> : null}
      <RecipeDrawer recipe={recipe} onClose={() => setRecipe(null)} onPlan={addMealToPlan} />
      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite"><i>✓</i><span>{toast}</span></div>
    </div>
  );
}
