"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { isCardIqFoodImport, type CardIqFoodImport } from "./cardiq-food";
import { FoodEditor } from "./food-editor";
import {
  foodLabel,
  listsAsMeal,
  listsAsProduct,
  mergeCatalog,
  missingComponents,
  primaryImage,
  resolveCatalog,
  resolveFood,
  searchFoods,
  type Food,
  type FoodKind,
} from "./food-model";
import {
  LEGACY_NUTRITION_STORAGE_KEYS,
  LOCAL_NUTRITION_STORAGE_KEY,
  getWeightTrendPoints,
  parseSavedNutritionState,
  readStoredNutritionRaw,
  shouldPersistNutritionState,
  shouldRestoreSavedNutritionState,
  stringifySavedNutritionState,
  upsertWeightEntry,
  type SavedNutritionState,
  type SavedPlanEntry,
  type WeightEntry,
} from "./local-nutrition-state";
import { getBangaloreClock, getEnergyRunway, getQuantityLimit, isQuantityValid, matchesRecipe, scaleNutrition, sumLoggedNutrition, type DashboardClock } from "./prototype-logic";
import { SOURCE_LINKS, seedCatalog } from "./nutrition-data";

type Area = "plan" | "track";
type PlanView = "items" | "meals";
type TrackView = "today" | "history" | "trends" | "purchases";
type MacroKey = "protein" | "carbs" | "fat";
/** What the editor is currently open on: a new food of some kind, or an existing one. */
type EditorTarget = { kind: FoodKind; initial: Food | null };
/** One line of the shared day draft. Display values are resolved from the catalogue, never stored. */
type PlanLine = SavedPlanEntry & { food: Food | null; scaled: Food | null };

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

function resolvePlanLines(entries: SavedPlanEntry[], catalog: Food[]): PlanLine[] {
  return entries.map((entry) => {
    const food = catalog.find((candidate) => candidate.id === entry.id) ?? null;
    const amount = entry.amount ?? food?.amount ?? 0;
    return { ...entry, food, scaled: food && isQuantityValid(food.unit, amount) ? scaleNutrition(food, amount) : null };
  });
}

function restoreNutritionState(saved: SavedNutritionState, dayKey: string, catalog: Food[]) {
  if (!shouldRestoreSavedNutritionState(saved, dayKey)) return { extras: [] as Food[], planned: [] as SavedPlanEntry[] };
  const extras = saved.logs.flatMap((entry): Food[] => {
    const food = entry.snapshot ?? catalog.find((candidate) => candidate.id === entry.foodId);
    return food && isQuantityValid(food.unit, entry.amount) ? [scaleNutrition(food, entry.amount)] : [];
  });
  return { extras, planned: saved.planned };
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

function FoodThumb({ food, className = "" }: { food: Food; className?: string }) {
  const image = primaryImage(food);
  if (!image) return <span className={`food-thumb placeholder ${className}`} aria-hidden="true">{food.name.charAt(0)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`food-thumb ${className}`} src={image.url} alt="" loading="lazy" />;
}

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

function TodayView({ clock, calories, macros, extras, quickFoods, weights, hasCardIqImport, planCount, onLog, onAdd, onEdit, onSaveWeight, onOpenMeals, onOpenPlan }: {
  clock: DashboardClock;
  calories: number;
  macros: Record<MacroKey, number>;
  extras: Food[];
  quickFoods: Food[];
  weights: WeightEntry[];
  hasCardIqImport: boolean;
  planCount: number;
  onLog: () => void;
  onAdd: (food: Food) => void;
  onEdit: (index: number) => void;
  onSaveWeight: (entry: WeightEntry) => void;
  onOpenMeals: () => void;
  onOpenPlan: () => void;
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
              <article className="meal-entry added" key={`${food.id}-${index}`}>
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
          {planCount > 0 ? (
            <section className="nudge-card dark-card">
              <span className="eyebrow bright">Today’s plan</span>
              <h2>{planCount} {planCount === 1 ? "item" : "items"} waiting in your draft</h2>
              <p>You planned these under Plan. Nothing is logged until you say so.</p>
              <button className="button lime" onClick={onOpenPlan}>Open the draft <span>→</span></button>
            </section>
          ) : (
            <section className="nudge-card dark-card">
              <span className="eyebrow bright">Nothing planned yet</span>
              <h2>Browse meals to build a draft</h2>
              <p>Anything you add under Plan lands in one shared draft you can log in a tap.</p>
              <button className="button lime" onClick={onOpenMeals}>Browse meals <span>→</span></button>
            </section>
          )}
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

function PlanSummary({ lines, onRemove, onAmount, onLogAll }: { lines: PlanLine[]; onRemove: (index: number) => void; onAmount: (index: number, amount: number) => void; onLogAll: () => void }) {
  const totals = lines.reduce((sum, line) => ({
    calories: sum.calories + (line.scaled?.calories ?? 0),
    protein: sum.protein + (line.scaled?.protein ?? 0),
    carbs: sum.carbs + (line.scaled?.carbs ?? 0),
    fat: sum.fat + (line.scaled?.fat ?? 0),
    fiber: sum.fiber + (line.scaled?.fiber ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const loggable = lines.filter((line) => line.scaled !== null).length;
  return (
    <section className="plan-summary dark-card">
      <div>
        <span className="eyebrow bright">Today’s draft</span>
        <h2>{lines.length ? `${Math.round(totals.calories).toLocaleString("en-IN")} kcal planned` : "Build from items or meals"}</h2>
        <p>{lines.length ? `${totals.protein.toFixed(1)}P · ${totals.carbs.toFixed(1)}C · ${totals.fat.toFixed(1)}F · ${totals.fiber.toFixed(1)}g fibre` : "Anything you add from either Plan section lands in one shared draft."}</p>
        {loggable > 0 ? <button className="button lime" onClick={onLogAll}>Log all {loggable} to today’s diary <span>→</span></button> : null}
      </div>
      <div className="plan-summary-items">
        {lines.length === 0 ? <span className="plan-empty-pill">Your selections will appear here</span> : lines.map((line, index) => (
          <span key={`${line.id}-${index}`} className={line.food ? "" : "missing"}>
            <b>{line.food ? foodLabel(line.food) : `Removed from catalogue · ${line.id}`}</b>
            {line.food ? (
              <label>
                <input type="number" min="0.01" step={line.food.unit === "g" || line.food.unit === "ml" ? 10 : 0.25} max={getQuantityLimit(line.food.unit)} value={line.amount ?? line.food.amount} onChange={(event) => onAmount(index, Number(event.target.value))} aria-label={`Planned amount of ${line.food.name}`} />
                <small>{line.food.unit}</small>
              </label>
            ) : <small>no longer available</small>}
            <button onClick={() => onRemove(index)} aria-label={`Remove ${line.food ? line.food.name : line.id} from plan`}>×</button>
          </span>
        ))}
      </div>
    </section>
  );
}

function RecipeCard({ recipe, catalog, onOpen, onPlan, onEdit }: { recipe: Food; catalog: Food[]; onOpen: (recipe: Food) => void; onPlan: (recipe: Food) => void; onEdit: (recipe: Food) => void }) {
  const image = primaryImage(recipe);
  const broken = missingComponents(recipe, catalog);
  return (
    <article className="recipe-card">
      <button className={`recipe-art ${recipe.art ?? "chia"}`} onClick={() => onOpen(recipe)} aria-label={`Open ${recipe.name}`} style={image ? { backgroundImage: `url(${image.url})` } : undefined}>
        <span>{recipe.protein}g protein</span><i /><b>{recipe.time ?? recipe.serving ?? ""}</b>
      </button>
      <div className="recipe-copy">
        <div className="recipe-tags">
          {recipe.preparedMeal ? <span className="ready-tag">Ready to eat</span> : null}
          {(recipe.tags ?? []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <button className="recipe-title" onClick={() => onOpen(recipe)}>{recipe.name}</button>
        <div className="recipe-macros"><strong>{recipe.calories} <small>kcal</small></strong><span>{recipe.protein}P</span><span>{recipe.carbs}C</span><span>{recipe.fat}F</span><span>{recipe.fiber} fibre</span></div>
        {broken.length > 0 ? <p className="component-warning" role="status">{broken.length} product{broken.length === 1 ? "" : "s"} missing — nutrition is incomplete.</p> : null}
        <div className="card-actions">
          <button className="button secondary recipe-plan-button" onClick={() => onPlan(recipe)}>＋ Add to plan</button>
          <button className="text-button" onClick={() => onEdit(recipe)}>Edit</button>
        </div>
      </div>
    </article>
  );
}

function ItemsView({ lines, catalog, onPlan, onRemove, onAmount, onLogAll, onCreate, onEdit }: {
  lines: PlanLine[];
  catalog: Food[];
  onPlan: (food: Food) => void;
  onRemove: (index: number) => void;
  onAmount: (index: number, amount: number) => void;
  onLogAll: () => void;
  onCreate: () => void;
  onEdit: (food: Food) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const products = catalog.filter(listsAsProduct);
  const shown = searchFoods(products.filter((food) => filter === "All" || (filter === "Ready meals" ? food.preparedMeal === true : food.category === filter)), search);
  return (
    <>
      <SectionHeading
        eyebrow="Plan · Items"
        title="Start with the exact thing"
        description="Search products you buy and raw ingredients you can find around Bengaluru. Add anything that is missing — it becomes available in Track straight away."
        action={<div className="heading-buttons"><span className="prototype-badge">{products.length} items</span><button className="button primary" onClick={onCreate}>＋ New product</button></div>}
      />
      <PlanSummary lines={lines} onRemove={onRemove} onAmount={onAmount} onLogAll={onLogAll} />
      <section className="item-search-hero surface-card">
        <div className="catalogue-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search products and ingredients" placeholder="Search Nandini milk, poha, chana, paneer…" /></div>
        <div className="filter-row" aria-label="Item filters">{["All", "Ordered", "Product", "Ingredient", "Ready meals"].map((item) => <button className={`chip ${filter === item ? "active" : ""}`} key={item} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>)}</div>
      </section>
      <div className="item-catalogue-grid">{shown.map((food) => <article className="item-card surface-card" key={food.id}>
        <div className="item-card-head"><span className={`trust-mark ${food.source.trust === "Label mirror" ? "review" : ""}`}>{food.source.trust}</span><small>{food.availability}</small></div>
        <div className="item-identity">
          <FoodThumb food={food} />
          <div><span className="item-brand">{food.brand}</span><h2>{food.name}</h2>{food.variant ? <span className="item-variant">{food.variant}</span> : null}<p>Per {food.amount} {food.unit}{food.packSize ? ` · ${food.packSize}` : ""}</p></div>
        </div>
        {food.preparedMeal ? <span className="ready-tag">Ready to eat · also under Meals</span> : null}
        <div className="item-nutrition"><strong>{Math.round(food.calories)}<small> kcal</small></strong><span>{food.protein}g <small>protein</small></span><span>{food.carbs}g <small>carbs</small></span><span>{food.fat}g <small>fat</small></span><span>{food.fiber}g <small>fibre</small></span></div>
        <div className="item-card-actions">
          {food.source.url ? <a href={food.source.url} target="_blank" rel="noreferrer">Source ↗</a> : <span className="personal-source">{food.source.label}</span>}
          <button className="text-button" onClick={() => onEdit(food)}>Edit</button>
          <button className="button primary" onClick={() => onPlan(food)}>＋ Plan this</button>
        </div>
      </article>)}</div>
      {shown.length === 0 ? <div className="empty-state"><strong>No item matches yet.</strong><span>Try a broader name, or add the exact product you have in the kitchen.</span><div className="empty-actions"><button className="button secondary" onClick={() => { setSearch(""); setFilter("All"); }}>Clear search</button><button className="button primary" onClick={onCreate}>＋ New product</button></div></div> : null}
      <div className="research-footnote"><span>Research base</span><a href={SOURCE_LINKS.ifct} target="_blank" rel="noreferrer">ICMR–NIN IFCT</a><a href={SOURCE_LINKS.usda} target="_blank" rel="noreferrer">USDA FoodData Central</a><a href={SOURCE_LINKS.fssai} target="_blank" rel="noreferrer">FSSAI labelling</a></div>
    </>
  );
}

function MealsView({ catalog, lines, onRecipe, onPlan, onRemove, onAmount, onLogAll, onCreate, onEdit }: {
  catalog: Food[];
  lines: PlanLine[];
  onRecipe: (recipe: Food) => void;
  onPlan: (recipe: Food) => void;
  onRemove: (index: number) => void;
  onAmount: (index: number, amount: number) => void;
  onLogAll: () => void;
  onCreate: () => void;
  onEdit: (recipe: Food) => void;
}) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  // Calculated recipes plus ready-to-eat single-label products.
  const mealFoods = catalog.filter(listsAsMeal);
  const shown = mealFoods.filter((recipe) => matchesRecipe({
    name: recipe.name,
    tags: recipe.tags ?? [],
    description: recipe.description ?? "",
    ingredients: recipe.ingredients ?? [],
    time: recipe.time ?? "",
    totalMinutes: recipe.totalMinutes ?? 0,
  }, search, filter));
  return (
    <>
      <SectionHeading
        eyebrow="Plan · Meals"
        title="Healthy food with actual receipts"
        description="Meals are combinations of products, calculated from weighed amounts. Ready-to-eat packs with their own label appear here too."
        action={<div className="heading-buttons"><span className="prototype-badge">{mealFoods.length} meals</span><button className="button primary" onClick={onCreate}>＋ New meal</button></div>}
      />
      <PlanSummary lines={lines} onRemove={onRemove} onAmount={onAmount} onLogAll={onLogAll} />
      <section className="discover-hero dark-card">
        <div><span className="eyebrow bright">Curated in Bengaluru</span><h2>Joy first.<br />Numbers intact.</h2><p>Brownies, chia bowls, paneer, rajma and cauliflower rice—built from ingredients you can realistically source in India.</p></div>
        <div className="hero-search"><label htmlFor="recipe-search">What do you feel like eating?</label><div><span>⌕</span><input id="recipe-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brownies, chia, chicken, breakfast…" /></div></div>
        <div className="hero-stat"><strong>{mealFoods.filter((recipe) => (recipe.tags ?? []).includes("High protein")).length}</strong><span>meals with at least<br />25 g protein</span></div>
      </section>
      <div className="filter-row meal-filter-row" aria-label="Meal filters">{["All", "High protein", "Low fat", "High fibre", "Vegetarian", "Vegan", "30 min or less"].map((item) => <button className={`chip ${filter === item ? "active" : ""}`} key={item} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>)}</div>
      <div className="filter-definition"><span><b>High protein</b> 25g+</span><span><b>Low fat</b> ≤10g</span><span><b>High fibre</b> 8g+</span><small>Transparent app filters, not regulatory label claims.</small></div>
      <div className="recipe-grid">{shown.map((recipe) => <RecipeCard recipe={recipe} catalog={catalog} onOpen={onRecipe} onPlan={onPlan} onEdit={onEdit} key={recipe.id} />)}</div>
      {shown.length === 0 ? <div className="empty-state"><strong>No meals match that combination yet.</strong><span>Try a broader search, or build the meal you actually cook.</span><div className="empty-actions"><button className="button secondary" onClick={() => { setSearch(""); setFilter("All"); }}>Clear filters</button><button className="button primary" onClick={onCreate}>＋ New meal</button></div></div> : null}
      <div className="research-footnote"><span>Built from</span><a href={SOURCE_LINKS.ninGuidelines} target="_blank" rel="noreferrer">ICMR–NIN 2024 guidance</a><a href={SOURCE_LINKS.ifct} target="_blank" rel="noreferrer">Indian Food Composition Tables</a><a href={SOURCE_LINKS.usda} target="_blank" rel="noreferrer">USDA FoodData Central</a></div>
    </>
  );
}

function getShownLogFoods(catalog: Food[], tab: string, search: string) {
  const byTab = catalog.filter((food) => {
    if (tab === "Commonly ordered") return food.common;
    if (tab === "Products") return listsAsProduct(food) && (food.category === "Ordered" || food.category === "Product");
    if (tab === "Ingredients") return food.category === "Ingredient";
    return listsAsMeal(food);
  });
  return search.trim() ? searchFoods(catalog, search) : byTab;
}

function FoodDialog({ initialFood, editing, catalog, onClose, onAdd, onEditFood, onCreateFood }: {
  initialFood: Food | null;
  editing: boolean;
  catalog: Food[];
  onClose: () => void;
  onAdd: (food: Food) => void;
  onEditFood: (food: Food) => void;
  onCreateFood: () => void;
}) {
  const fallback = catalog.find((food) => food.common) ?? catalog[0];
  const initial = initialFood ?? fallback;
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(initialFood && listsAsMeal(initialFood) ? "Meals" : initialFood && !initialFood.common ? (initialFood.category === "Ingredient" ? "Ingredients" : "Products") : "Commonly ordered");
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [quantity, setQuantity] = useState(initialFood?.amount ?? initial?.amount ?? 0);

  const shown = getShownLogFoods(catalog, tab, search);
  // The catalogue is the live record; a logged snapshot being edited keeps its own numbers.
  const selected = (editing && initialFood?.id === selectedId ? initialFood : catalog.find((food) => food.id === selectedId)) ?? null;
  const step = selected?.unit === "ml" ? 50 : selected?.unit === "g" ? 10 : selected?.unit === "scoop" || selected?.unit === "serving" ? 0.25 : 1;
  const maxQuantity = selected ? getQuantityLimit(selected.unit) : 0;
  const quantityValid = selected ? isQuantityValid(selected.unit, quantity) : false;
  const scaled = selected ? scaleNutrition(selected, quantityValid ? quantity : 0) : null;
  const labelBasis = selected ? selected.basis?.amount ?? selected.amount : 0;
  const keepSelectionVisible = (nextTab: string, nextSearch: string) => {
    const candidates = getShownLogFoods(catalog, nextTab, nextSearch);
    if (candidates.some((food) => food.id === selectedId)) return;
    setSelectedId(candidates[0]?.id ?? "");
    setQuantity(candidates[0]?.amount ?? 0);
  };
  const close = () => {
    setSearch("");
    onClose();
  };
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <section className="food-dialog" role="dialog" aria-modal="true" aria-labelledby="log-food-title">
        <header>
          <div><span className="eyebrow">Track</span><h2 id="log-food-title">{editing ? "Edit logged food" : "Log food"}</h2></div>
          <div className="dialog-header-actions">
            <button className="text-button" onClick={onCreateFood}>＋ New product</button>
            <button className="close-button" onClick={close} aria-label="Close food logger">×</button>
          </div>
        </header>
        <div className="dialog-search"><span>⌕</span><input autoFocus value={search} onChange={(event) => { const next = event.target.value; setSearch(next); keepSelectionVisible(tab, next); }} placeholder="Search food, meal or recent purchase" /></div>
        <div className="dialog-tabs">{["Commonly ordered", "Products", "Ingredients", "Meals"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => { setTab(item); keepSelectionVisible(item, search); }} key={item}>{item}</button>)}</div>
        <div className="food-dialog-body">
          <div className="food-results">
            {shown.map((food) => (
              <button className={selected?.id === food.id ? "selected" : ""} key={food.id} onClick={() => { setSelectedId(food.id); setQuantity(food.amount); }}>
                <FoodThumb food={food} className="food-initial" />
                <span><strong>{foodLabel(food)}</strong><small>{food.amount} {food.unit} · {food.source.trust}</small></span>
                <span><b>{Math.round(food.calories)}</b><small>kcal</small></span>
                <i>→</i>
              </button>
            ))}
            {shown.length === 0 ? <div className="food-results-empty"><strong>No match yet</strong><span>Try the product, brand, item, or variant name.</span><button className="button secondary" onClick={onCreateFood}>＋ Add this product</button></div> : null}
          </div>
          {selected && scaled ? <aside className="quantity-editor dark-card">
            <span className="eyebrow bright">Quantity</span><h3>{foodLabel(selected)}</h3><p>Nutrition updates while you edit.</p>
            <div className="quantity-control"><button onClick={() => setQuantity((value) => Math.max(step, Number((value - step).toFixed(2))))} aria-label={`Decrease ${selected.name} quantity`}>−</button><label><input type="number" min={step} max={maxQuantity} step={step} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} aria-label={`${selected.name} quantity`} /><span>{selected.unit}</span></label><button onClick={() => setQuantity((value) => Math.min(maxQuantity, Number((value + step).toFixed(2))))} aria-label={`Increase ${selected.name} quantity`}>＋</button></div>
            <small className={`quantity-basis ${quantityValid ? "" : "error"}`}>{quantityValid ? `You are adding ${quantity} ${selected.unit} · nutrition basis ${labelBasis} ${selected.unit}` : `Enter more than 0 and no more than ${maxQuantity} ${selected.unit}`}</small>
            <div className="live-nutrition"><strong><b>{Math.round(scaled.calories)}</b><small>kcal</small></strong><span><b>{scaled.protein.toFixed(1)}g</b><small>protein</small></span><span><b>{scaled.carbs.toFixed(1)}g</b><small>carbs</small></span><span><b>{scaled.fat.toFixed(1)}g</b><small>fat</small></span><span><b>{scaled.fiber.toFixed(1)}g</b><small>fibre</small></span></div>
            <button className="edit-food-button" onClick={() => onEditFood(selected)}>✎ Edit name, serving & nutrition</button>
            {selected.source.url ? <a href={selected.source.url} target="_blank" rel="noreferrer">{selected.source.label} ↗</a> : <span className="personal-source">{selected.source.label}</span>}
            <button className="button lime full add-food-button" disabled={!quantityValid} onClick={() => onAdd(scaled)}>{editing ? "Update" : "Add"} {quantity} {selected.unit} · {Math.round(scaled.calories)} kcal</button>
          </aside> : <aside className="quantity-editor quantity-editor-empty dark-card"><span className="eyebrow bright">Quantity</span><h3>Choose a food</h3><p>The quantity editor will appear when a result is selected.</p></aside>}
        </div>
      </section>
    </div>
  );
}

function RecipeDrawer({ recipe, catalog, onClose, onPlan, onEdit }: { recipe: Food | null; catalog: Food[]; onClose: () => void; onPlan: (recipe: Food) => void; onEdit: (recipe: Food) => void }) {
  if (!recipe) return null;
  const image = primaryImage(recipe);
  const componentLines = (recipe.components ?? []).map((component) => {
    const food = catalog.find((candidate) => candidate.id === component.foodId);
    return { key: component.foodId, text: food ? `${foodLabel(food)} · ${component.amount} ${food.unit}` : `Missing product · ${component.foodId}`, missing: !food };
  });
  const lines = componentLines.length > 0 ? componentLines : (recipe.ingredients ?? []).map((ingredient) => ({ key: ingredient, text: ingredient, missing: false }));
  return (
    <div className="dialog-backdrop drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <aside className="recipe-drawer" role="dialog" aria-modal="true" aria-labelledby="recipe-title">
        <button className="close-button" onClick={onClose} aria-label="Close recipe">×</button>
        <div className={`drawer-art ${recipe.art ?? "chia"}`} style={image ? { backgroundImage: `url(${image.url})` } : undefined}><span>{recipe.time ?? recipe.serving}</span><b>{recipe.protein}g protein</b></div>
        <div className="drawer-copy">
          <div className="recipe-tags">{recipe.preparedMeal ? <span className="ready-tag">Ready to eat</span> : null}{(recipe.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div>
          <h2 id="recipe-title">{recipe.name}</h2>
          <p>{recipe.description ?? recipe.availability}</p>
          <div className="drawer-macros"><span><strong>{recipe.calories}</strong><small>kcal</small></span><span><strong>{recipe.protein}g</strong><small>protein</small></span><span><strong>{recipe.carbs}g</strong><small>carbs</small></span><span><strong>{recipe.fat}g</strong><small>fat</small></span><span><strong>{recipe.fiber}g</strong><small>fibre</small></span></div>
          {lines.length > 0 ? <section><span className="eyebrow">{recipe.kind === "recipe" ? `Products · per ${recipe.serving ?? "serving"}` : "Ingredients"}</span>{lines.map((line) => <div className={`ingredient ${line.missing ? "missing" : ""}`} key={line.key}><i>{line.missing ? "!" : "✓"}</i><span>{line.text}</span></div>)}</section> : null}
          {(recipe.method ?? []).length > 0 ? <section className="recipe-method"><span className="eyebrow">Method</span>{(recipe.method ?? []).map((step, index) => <div className="ingredient" key={step}><i>{index + 1}</i><span>{step}</span></div>)}</section> : null}
          {recipe.sourceNote ? <div className="source-note"><i>i</i><span><strong>How the numbers were built</strong>{recipe.sourceNote}</span></div> : null}
          <div className="drawer-actions">
            <button className="button secondary" onClick={() => onEdit(recipe)}>✎ Edit meal</button>
            <button className="button lime" onClick={() => { onPlan(recipe); onClose(); }}>＋ Add to plan</button>
          </div>
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
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [recipe, setRecipe] = useState<Food | null>(null);
  const [planned, setPlanned] = useState<SavedPlanEntry[]>([]);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const [extras, setExtras] = useState<Food[]>([]);
  const [customFoods, setCustomFoods] = useState<Food[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const loadedDayRef = useRef<string | null>(null);
  const [cardIqImport, setCardIqImport] = useState<CardIqFoodImport | null>(null);

  // One catalogue for the whole app: seed foods, KP's own foods layered on top,
  // and every recipe's nutrition recalculated from its current components.
  const foodCatalog = resolveCatalog(mergeCatalog(seedCatalog, customFoods));
  const planLines = resolvePlanLines(planned, foodCatalog);

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
        raw = readStoredNutritionRaw((key) => window.localStorage.getItem(key));
      } catch {
        window.setTimeout(() => notify("Nourish could not read saved data in this browser"), 0);
      }
      const saved = parseSavedNutritionState(raw);
      const restored = restoreNutritionState(saved, clock.dayKey, resolveCatalog(mergeCatalog(seedCatalog, saved.customFoods)));
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
    // Rebuilt from customFoods alone so this effect depends only on what it
    // saves, rather than on a catalogue recomputed every render.
    const catalogForSave = resolveCatalog(mergeCatalog(seedCatalog, customFoods));
    const saved: SavedNutritionState = {
      dayKey: clock.dayKey,
      logs: extras.map((food) => ({ foodId: food.id, amount: food.amount, snapshot: food })),
      planned,
      // Components stay the truth for a recipe, but the stored macros are
      // refreshed too so the saved record never reads as stale on disk.
      customFoods: customFoods.map((food) => resolveFood(food, catalogForSave)),
      weights,
    };
    try {
      window.localStorage.setItem(LOCAL_NUTRITION_STORAGE_KEY, stringifySavedNutritionState(saved));
      // The upgraded record is written; older schemas would otherwise shadow it on a later read.
      for (const legacyKey of LEGACY_NUTRITION_STORAGE_KEYS) window.localStorage.removeItem(legacyKey);
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
  /**
   * Every create and edit lands here, from Plan or from Track, so the catalogue
   * both areas read from is updated in one place.
   */
  const saveFood = (food: Food) => {
    const existed = customFoods.some((candidate) => candidate.id === food.id) || seedCatalog.some((candidate) => candidate.id === food.id);
    setCustomFoods((value) => [...value.filter((candidate) => candidate.id !== food.id), food]);
    setEditorTarget(null);
    setRecipe((current) => (current && current.id === food.id ? food : current));
    notify(`${foodLabel(food)} ${existed ? "updated" : "created"} · available in Plan and Track`);
  };
  const saveWeight = (entry: WeightEntry) => {
    setWeights((value) => upsertWeightEntry(value, entry));
    notify(`${entry.kg.toFixed(1)} kg logged for ${entry.date}`);
  };
  const addToPlan = (food: Food) => {
    setPlanned((value) => [...value, { id: food.id, amount: food.amount }]);
    notify(`${food.name} added to today’s draft`);
  };
  const removeFromPlan = (index: number) => setPlanned((value) => value.filter((_, itemIndex) => itemIndex !== index));
  const setPlanAmount = (index: number, amount: number) => setPlanned((value) => value.map((entry, entryIndex) => entryIndex === index ? { ...entry, amount } : entry));
  const logPlanToDiary = () => {
    const loggable = planLines.flatMap((line) => (line.scaled ? [line.scaled] : []));
    if (loggable.length === 0) return;
    setExtras((value) => [...value, ...loggable]);
    setPlanned([]);
    setArea("track");
    setTrackView("today");
    window.scrollTo({ top: 0, behavior: "smooth" });
    notify(`${loggable.length} planned ${loggable.length === 1 ? "item" : "items"} logged to today`);
  };
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
      if (trackView === "today") return <TodayView clock={clock} calories={totals.calories} macros={macros} extras={extras} quickFoods={quickFoods} weights={weights} hasCardIqImport={cardIqImport !== null} planCount={planLines.length} onLog={() => openFoodLogger()} onAdd={(food) => openFoodLogger(food)} onEdit={(index) => openFoodLogger(extras[index], index)} onSaveWeight={saveWeight} onOpenMeals={() => { setArea("plan"); setPlanView("meals"); window.scrollTo({ top: 0, behavior: "smooth" }); }} onOpenPlan={() => { setArea("plan"); setPlanView("items"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />;
      if (trackView === "history") return <HistoryView />;
      if (trackView === "trends") return <TrendsView />;
      return <PurchasesView cardIqImport={cardIqImport} catalog={foodCatalog} onAdd={(food) => openFoodLogger(food)} />;
    }
    if (planView === "items") return <ItemsView lines={planLines} catalog={foodCatalog} onPlan={addToPlan} onRemove={removeFromPlan} onAmount={setPlanAmount} onLogAll={logPlanToDiary} onCreate={() => setEditorTarget({ kind: "product", initial: null })} onEdit={(food) => setEditorTarget({ kind: food.kind, initial: food })} />;
    return <MealsView catalog={foodCatalog} lines={planLines} onRecipe={setRecipe} onPlan={addToPlan} onRemove={removeFromPlan} onAmount={setPlanAmount} onLogAll={logPlanToDiary} onCreate={() => setEditorTarget({ kind: "recipe", initial: null })} onEdit={(food) => setEditorTarget({ kind: food.kind, initial: food })} />;
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
      {foodDialog ? <FoodDialog initialFood={foodDialogSelection} editing={editingFoodIndex !== null} catalog={foodCatalog} onClose={() => { setFoodDialog(false); setFoodDialogSelection(null); setEditingFoodIndex(null); }} onAdd={addFood} onEditFood={(food) => setEditorTarget({ kind: food.kind, initial: food })} onCreateFood={() => setEditorTarget({ kind: "product", initial: null })} /> : null}
      <RecipeDrawer recipe={recipe} catalog={foodCatalog} onClose={() => setRecipe(null)} onPlan={addToPlan} onEdit={(food) => setEditorTarget({ kind: food.kind, initial: food })} />
      {editorTarget ? <FoodEditor kind={editorTarget.kind} initial={editorTarget.initial} catalog={foodCatalog} onSave={saveFood} onClose={() => setEditorTarget(null)} /> : null}
      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite"><i>✓</i><span>{toast}</span></div>
    </div>
  );
}
