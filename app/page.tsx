"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { isCardIqFoodImport, refineCardIqImport, type CardIqFoodImport } from "./cardiq-food";
import { buildCompositeItem, componentNutrition, defaultCompositeItems, findCompositeByLogId, findComponentFood, type CompositeComponent } from "./composite-foods";
import { LOCAL_NUTRITION_STORAGE_KEY, parseSavedNutritionState, shouldRestoreSavedNutritionState, stringifySavedNutritionState, type SavedNutritionState } from "./local-nutrition-state";
import { estimateSatiety, getBangaloreClock, getEnergyRunway, getQuantityLimit, hasNutritionTarget, isQuantityValid, matchesNutritionTarget, matchesRecipe, satietyLabel, scaleNutrition, sumLoggedNutrition, type DashboardClock, type NutritionTarget } from "./prototype-logic";
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

const foods = nutritionItems;
const recipes = meals;
const loggableMeals: Food[] = recipes.map((meal) => ({
  id: `meal-${meal.id}`,
  name: meal.name,
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
const compositeItems = defaultCompositeItems();
/** The meal shown as an example on Today. Falls back to the first recipe if the id changes. */
const suggestedMeal = recipes.find((recipe) => recipe.id === "cauli-chicken") ?? recipes[0];
const logFoods = [...compositeItems, ...foods, ...loggableMeals];

function planEntryFromFood(food: Food): PlannedEntry {
  return { id: food.id, kind: "food", name: food.brand ? `${food.brand} · ${food.name}` : food.name, serving: `${food.amount} ${food.unit}`, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber };
}

function planEntryFromMeal(meal: Recipe): PlannedEntry {
  return { id: meal.id, kind: "meal", name: meal.name, serving: meal.serving, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, fiber: meal.fiber };
}

function restoreNutritionState(saved: SavedNutritionState, dayKey: string) {
  if (!shouldRestoreSavedNutritionState(saved, dayKey)) return { extras: [] as Food[], planned: [] as PlannedEntry[] };
  const extras = saved.logs.flatMap((entry): Food[] => {
    // A composite is rebuilt from the component weights KP actually used, not the defaults.
    const composite = findCompositeByLogId(entry.foodId);
    const food = composite
      ? buildCompositeItem(composite, entry.components?.length ? entry.components : composite.components)
      : logFoods.find((candidate) => candidate.id === entry.foodId);
    return food && isQuantityValid(food.unit, entry.amount) ? [scaleNutrition(food, entry.amount)] : [];
  });
  const planned = saved.planned.flatMap((entry): PlannedEntry[] => {
    if (entry.kind === "meal") {
      const meal = recipes.find((candidate) => candidate.id === entry.id);
      return meal ? [planEntryFromMeal(meal)] : [];
    }
    const food = foods.find((candidate) => candidate.id === entry.id);
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

function TodayView({ clock, calories, macros, extras, quickFoods, hasCardIqImport, onLog, onAdd, onEdit, onOpenMeals }: {
  clock: DashboardClock;
  calories: number;
  macros: Record<MacroKey, number>;
  extras: Food[];
  quickFoods: Food[];
  hasCardIqImport: boolean;
  onLog: () => void;
  onAdd: (food: Food) => void;
  onEdit: (index: number) => void;
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
                <div className="meal-meta"><span>Logged today · {food.amount} {food.unit}</span><strong>{food.name}</strong><small>{food.protein.toFixed(1)}P · {food.carbs.toFixed(1)}C · {food.fat.toFixed(1)}F</small></div>
                <div className="entry-actions"><b>{Math.round(food.calories)} kcal</b><button onClick={() => onEdit(index)}>Edit quantity</button></div>
              </article>
            ))}
          </div>
        </section>

        <aside className="today-rail">
          <section className="quick-card surface-card">
            <div className="section-title-row"><div><span className="eyebrow">{hasCardIqImport ? "From cardIQ" : "One tap"}</span><h2>Quick add</h2></div><button className="text-button" onClick={onLog}>See all</button></div>
            <div className="quick-grid">
              {quickFoods.slice(0, 4).map((food) => (
                <button key={food.name} onClick={() => onAdd(food)}><span>{food.name}</span><b>＋</b></button>
              ))}
            </div>
          </section>
          <section className="nudge-card dark-card">
            <span className="eyebrow bright">Sample meal idea · not logged</span>
            <h2>{suggestedMeal.name}</h2>
            {/* Read from the calculated recipe rather than retyped: a hardcoded copy here
                said 406 kcal and 56 g protein while the recipe actually calculates 397
                and 55.4. */}
            <p>A researched example with {suggestedMeal.protein} g protein and {suggestedMeal.fiber} g fibre for {suggestedMeal.calories} kcal. Browse it before choosing anything.</p>
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

function PurchasesView({ onAdd, cardIqImport }: { onAdd: (food: Food) => void; cardIqImport: CardIqFoodImport | null }) {
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
          {shown.map((item) => <div className="purchase-row" key={`${item.store}-${item.name}`}><span className="purchase-name"><b>{item.name}</b><small>{item.orderCount} order{item.orderCount === 1 ? "" : "s"} · last {item.lastOrdered}</small></span><span><em>{item.store}</em></span><span className="purchase-nutrition">{item.cal}{item.food ? <small>{item.food.source.trust}</small> : null}</span><span><i className={item.match === "Matched" ? "matched" : "review"}>{item.food ? item.matchKind ?? item.match : "Needs label"}</i></span><span><button aria-label={item.food ? `Quick add ${item.name}` : `${item.name} needs nutrition review`} disabled={!item.food} onClick={() => { if (item.food) onAdd(item.food); }}>＋</button></span></div>)}
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
        <div className="fullness-line" title="Estimated from protein, fibre and energy density"><i className="fullness-track"><span style={{ width: `${estimateSatiety(recipe)}%` }} /></i><small>{satietyLabel(estimateSatiety(recipe))} · est. {estimateSatiety(recipe)}/100</small></div>
        <button className="button secondary full recipe-plan-button" onClick={() => onPlan(recipe)}>＋ Add meal to plan</button>
      </div>
    </article>
  );
}

function ItemsView({ planned, onPlan, onRemove }: { planned: PlannedEntry[]; onPlan: (food: Food) => void; onRemove: (index: number) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortByFullness, setSortByFullness] = useState(false);
  const query = search.trim().toLowerCase();
  const matched = foods.filter((food) => (filter === "All" || food.category === filter) && (!query || [food.name, food.brand, ...food.aliases].filter(Boolean).join(" ").toLowerCase().includes(query)));
  const shown = sortByFullness ? [...matched].sort((a, b) => estimateSatiety(b) - estimateSatiety(a) || b.protein - a.protein) : matched;
  return (
    <>
      <SectionHeading eyebrow="Plan · Items" title="Start with the exact thing" description="Search products you buy and raw ingredients you can find around Bengaluru. Every result keeps its serving basis and evidence strength." action={<span className="prototype-badge">{foods.length} researched items</span>} />
      <PlanSummary entries={planned} onRemove={onRemove} />
      <section className="item-search-hero surface-card">
        <div className="catalogue-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search products and ingredients" placeholder="Search Nandini milk, chia, chicken, paneer…" /></div>
        <div className="filter-row" aria-label="Item filters">
          {["All", "Ordered", "Product", "Ingredient"].map((item) => <button className={`chip ${filter === item ? "active" : ""}`} key={item} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>)}
          <button className={`chip ${sortByFullness ? "active" : ""}`} onClick={() => setSortByFullness((value) => !value)} aria-pressed={sortByFullness}>Most filling first</button>
        </div>
      </section>
      <div className="item-catalogue-grid">{shown.map((food) => <article className="item-card surface-card" key={food.id}>
        <div className="item-card-head"><span className={`trust-mark ${food.source.trust === "Label mirror" ? "review" : ""}`}>{food.source.trust}</span><small>{food.availability}</small></div>
        <div><span className="item-brand">{food.brand ?? food.category}</span><h2>{food.name}</h2><p>Per {food.amount} {food.unit}</p></div>
        <div className="item-nutrition"><strong>{Math.round(food.calories)}<small> kcal</small></strong><span>{food.protein}g <small>protein</small></span><span>{food.carbs}g <small>carbs</small></span><span>{food.fat}g <small>fat</small></span><span>{food.fiber}g <small>fibre</small></span></div>
        <div className="fullness-line" title="Estimated from protein, fibre and energy density"><i className="fullness-track"><span style={{ width: `${estimateSatiety(food)}%` }} /></i><small>{satietyLabel(estimateSatiety(food))} · est. {estimateSatiety(food)}/100</small></div>
        <div className="item-card-actions"><a href={food.source.url} target="_blank" rel="noreferrer">Source ↗</a><button className="button primary" onClick={() => onPlan(food)}>＋ Plan this</button></div>
      </article>)}</div>
      {shown.length === 0 ? <div className="empty-state"><strong>No researched item matches yet.</strong><span>Try a broader name; exact cardIQ products arrive in the purchase-import phase.</span><button className="button secondary" onClick={() => { setSearch(""); setFilter("All"); }}>Clear search</button></div> : null}
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

function MealsView({ onRecipe, planned, onPlan, onRemove }: { onRecipe: (recipe: Recipe) => void; planned: PlannedEntry[]; onPlan: (recipe: Recipe) => void; onRemove: (index: number) => void }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState({ maxCalories: "", minProtein: "", maxProtein: "" });
  const [sortByFullness, setSortByFullness] = useState(false);
  const bounds: NutritionTarget = { maxCalories: boundFrom(target.maxCalories), minProtein: boundFrom(target.minProtein), maxProtein: boundFrom(target.maxProtein) };
  const matched = recipes.filter((recipe) => matchesRecipe(recipe, search, filter) && matchesNutritionTarget(recipe, bounds));
  const shown = sortByFullness
    ? [...matched].sort((a, b) => estimateSatiety(b) - estimateSatiety(a) || b.protein - a.protein)
    : matched;
  return (
    <>
      <SectionHeading eyebrow="Plan · Meals" title="Healthy food with actual receipts" description="Creative Indian-first meals calculated from weighed ingredients, with cooking oil counted and the evidence trail kept visible." action={<span className="prototype-badge">{recipes.length} calculated meals</span>} />
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
      <div className="recipe-grid">{shown.map((recipe) => <RecipeCard recipe={recipe} onOpen={onRecipe} onPlan={onPlan} key={recipe.id} />)}</div>
      {shown.length === 0 ? <div className="empty-state"><strong>Nothing fits those numbers yet.</strong><span>{hasNutritionTarget(bounds) ? "Widen the calorie ceiling or the protein window—the catalogue is still small." : "Try a broader search or clear the active filter."}</span><button className="button secondary" onClick={() => { setSearch(""); setFilter("All"); setTarget({ maxCalories: "", minProtein: "", maxProtein: "" }); }}>Clear filters</button></div> : null}
      <div className="research-footnote"><span>Built from</span><a href={SOURCE_LINKS.ninGuidelines} target="_blank" rel="noreferrer">ICMR–NIN 2024 guidance</a><a href={SOURCE_LINKS.ifct} target="_blank" rel="noreferrer">Indian Food Composition Tables</a><a href={SOURCE_LINKS.usda} target="_blank" rel="noreferrer">USDA FoodData Central</a></div>
    </>
  );
}

function getShownLogFoods(tab: string, search: string) {
  const query = search.trim().toLowerCase();
  return logFoods.filter((food) => {
    const matchesTab = query ? true
      : tab === "Commonly ordered" ? food.common
        : tab === "Dishes" ? food.category === "Composite"
          : tab === "Products" ? food.category === "Ordered" || food.category === "Product"
            : tab === "Ingredients" ? food.category === "Ingredient"
              : food.category === "Meal";
    const matchesSearch = !query || [food.name, food.brand, ...food.aliases].filter(Boolean).join(" ").toLowerCase().includes(query);
    return matchesTab && matchesSearch;
  });
}

/**
 * The component editor for a composite dish. Each weight is prefilled and individually
 * editable, and the dish total updates as it changes.
 */
function ComponentEditor({ components, onChange }: { components: CompositeComponent[]; onChange: (next: CompositeComponent[]) => void }) {
  return (
    <div className="component-editor">
      {components.map((component, index) => {
        const food = findComponentFood(component.foodId);
        if (!food) return null;
        const stepFor = food.unit === "ml" ? 10 : food.unit === "g" ? 5 : food.unit === "piece" ? 1 : 0.25;
        const limit = getQuantityLimit(food.unit);
        const value = componentNutrition(component);
        const update = (next: number) => {
          const clamped = Math.min(limit, Math.max(0, Number(next.toFixed(2))));
          onChange(components.map((entry, entryIndex) => entryIndex === index ? { ...entry, amount: clamped } : entry));
        };
        return (
          <div className="component-row" key={`${component.foodId}-${index}`}>
            <span className="component-name">{food.name.split(" · ")[0]}</span>
            <div className="component-control">
              <button onClick={() => update(component.amount - stepFor)} aria-label={`Less ${food.name}`}>−</button>
              <label>
                <input type="number" min={0} max={limit} step={stepFor} value={component.amount} onChange={(event) => update(Number(event.target.value))} aria-label={`${food.name} amount in ${food.unit}`} />
                <span>{food.unit === "piece" ? (component.amount === 1 ? "pc" : "pcs") : food.unit}</span>
              </label>
              <button onClick={() => update(component.amount + stepFor)} aria-label={`More ${food.name}`}>＋</button>
            </div>
            <b>{Math.round(value.calories)}<small> kcal</small></b>
          </div>
        );
      })}
    </div>
  );
}

function FoodDialog({ initialFood, editing, onClose, onAdd }: { initialFood: Food | null; editing: boolean; onClose: () => void; onAdd: (food: Food) => void }) {
  const initial = initialFood ?? foods.find((food) => food.common) ?? foods[0];
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(
    initialFood?.category === "Composite" ? "Dishes"
      : initialFood?.category === "Meal" ? "Meals"
        : initialFood && !initialFood.common ? (initialFood.category === "Ingredient" ? "Ingredients" : "Products") : "Commonly ordered",
  );
  const [selectedId, setSelectedId] = useState(initial.id);
  const [quantity, setQuantity] = useState(initial.amount);
  // Component weights are held here so an edit survives switching tabs or searching, and so
  // editing a logged chapati reopens with the weight KP actually used.
  const [components, setComponents] = useState<CompositeComponent[]>(initialFood?.components ?? []);
  // Items logged without leaving the dialog, so a chapati + sabzi + curd plate is three taps.
  const [sessionLog, setSessionLog] = useState<Food[]>([]);
  const shown = getShownLogFoods(tab, search);
  const listed = shown.find((food) => food.id === selectedId) ?? null;
  const composite = listed ? findCompositeByLogId(listed.id) : null;
  // A composite is rebuilt from its current component weights; everything else is used as is.
  const selected = composite && components.length > 0 ? buildCompositeItem(composite, components) : listed;
  const step = selected?.unit === "ml" ? 50 : selected?.unit === "g" ? 10 : selected?.unit === "scoop" || selected?.unit === "serving" ? 0.25 : 1;
  const maxQuantity = selected ? getQuantityLimit(selected.unit) : 0;
  const quantityValid = selected ? isQuantityValid(selected.unit, quantity) : false;
  const scaled = selected ? scaleNutrition(selected, quantityValid ? quantity : 0) : null;
  const labelBasis = selected ? selected.basis?.amount ?? selected.amount : 0;
  const selectFood = (food: Food) => {
    setSelectedId(food.id);
    setQuantity(food.amount);
    const nextComposite = findCompositeByLogId(food.id);
    setComponents(food.components ?? nextComposite?.components ?? []);
  };
  const keepSelectionVisible = (nextTab: string, nextSearch: string) => {
    const candidates = getShownLogFoods(nextTab, nextSearch);
    if (candidates.some((food) => food.id === selectedId)) return;
    if (candidates[0]) selectFood(candidates[0]);
    else { setSelectedId(""); setQuantity(0); setComponents([]); }
  };
  const sessionTotals = sessionLog.reduce((sum, food) => ({ calories: sum.calories + food.calories, protein: sum.protein + food.protein }), { calories: 0, protein: 0 });
  const commit = (food: Food) => {
    onAdd(food);
    // Editing replaces one entry and closes; logging keeps the dialog open for the next item.
    if (editing) return;
    setSessionLog((value) => [...value, food]);
    setSearch("");
  };
  const close = () => {
    setSearch("");
    onClose();
  };
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <section className="food-dialog" role="dialog" aria-modal="true" aria-labelledby="log-food-title">
        <header><div><span className="eyebrow">Track</span><h2 id="log-food-title">Log food</h2></div><button className="close-button" onClick={close} aria-label="Close food logger">×</button></header>
        <div className="dialog-search"><span>⌕</span><input autoFocus value={search} onChange={(event) => { const next = event.target.value; setSearch(next); keepSelectionVisible(tab, next); }} placeholder="Search food, recipe or recent purchase" /></div>
        <div className="dialog-tabs">{["Commonly ordered", "Dishes", "Products", "Ingredients", "Meals"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => { setTab(item); keepSelectionVisible(item, search); }} key={item}>{item}</button>)}</div>
        {sessionLog.length > 0 ? (
          <div className="session-log">
            <span className="eyebrow">Logged just now</span>
            <div className="session-log-items">{sessionLog.map((food, index) => <span key={`${food.id}-${index}`}><b>{food.name}</b><small>{Math.round(food.calories)} kcal</small></span>)}</div>
            <strong>{Math.round(sessionTotals.calories).toLocaleString("en-IN")} kcal · {sessionTotals.protein.toFixed(0)}g protein</strong>
          </div>
        ) : null}
        <div className="food-dialog-body">
          <div className="food-results">{shown.map((food) => <button className={selected?.id === food.id ? "selected" : ""} key={food.id} onClick={() => selectFood(food)}><span className="food-initial">{food.name.charAt(0)}</span><span><strong>{food.brand ? `${food.brand} · ${food.name}` : food.name}</strong><small>{food.category === "Composite" ? food.availability : `${food.amount} ${food.unit} · ${food.source.trust}`}</small></span><span><b>{Math.round(food.calories)}</b><small>kcal</small></span><i>→</i></button>)}{shown.length === 0 ? <div className="food-results-empty"><strong>No match yet</strong><span>Try the product, brand, or ingredient name.</span></div> : null}</div>
          {selected && scaled ? <aside className="quantity-editor dark-card">
            <span className="eyebrow bright">{composite ? "Dish" : "Quantity"}</span><h3>{selected.brand ? `${selected.brand} · ` : ""}{selected.name}</h3><p>Nutrition updates while you edit.</p>
            {composite ? <>
              <ComponentEditor components={components} onChange={setComponents} />
              <small className="component-note">{composite.note}</small>
            </> : null}
            <div className="quantity-control"><button onClick={() => setQuantity((value) => Math.max(step, Number((value - step).toFixed(2))))} aria-label={`Decrease ${selected.name} quantity`}>−</button><label><input type="number" min={step} max={maxQuantity} step={step} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} aria-label={`${selected.name} quantity`} /><span>{composite ? (quantity === 1 ? composite.serving : `× ${composite.serving}`) : selected.unit}</span></label><button onClick={() => setQuantity((value) => Math.min(maxQuantity, Number((value + step).toFixed(2))))} aria-label={`Increase ${selected.name} quantity`}>＋</button></div>
            <small className={`quantity-basis ${quantityValid ? "" : "error"}`}>{quantityValid ? `Nutrition basis: ${labelBasis} ${selected.unit}` : `Enter more than 0 and no more than ${maxQuantity} ${selected.unit}`}</small>
            <div className="live-nutrition"><strong><b>{Math.round(scaled.calories)}</b><small>kcal</small></strong><span><b>{scaled.protein.toFixed(1)}g</b><small>protein</small></span><span><b>{scaled.carbs.toFixed(1)}g</b><small>carbs</small></span><span><b>{scaled.fat.toFixed(1)}g</b><small>fat</small></span><span><b>{scaled.fiber.toFixed(1)}g</b><small>fibre</small></span></div>
            <a href={selected.source.url} target="_blank" rel="noreferrer">{selected.source.label} ↗</a>
            <button className="button lime full" disabled={!quantityValid} onClick={() => commit(scaled)}>{editing ? "Update" : "Add"} {Math.round(scaled.calories)} kcal {editing ? "in today" : "to today"}</button>
          </aside> : <aside className="quantity-editor quantity-editor-empty dark-card"><span className="eyebrow bright">Quantity</span><h3>{sessionLog.length ? "Add the next thing" : "Choose a food"}</h3><p>{sessionLog.length ? "Search for whatever else was on the plate, or finish below." : "The quantity editor will appear when a result is selected."}</p></aside>}
        </div>
        {/* Finishing must always be reachable. Clearing the search after a log can leave no
            selection, so this cannot live inside the quantity editor. */}
        {editing ? null : <div className="dialog-footer"><button className="button secondary full" onClick={close}>{sessionLog.length ? `Done · ${sessionLog.length} logged` : "Done"}</button></div>}
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
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [cardIqImport, setCardIqImport] = useState<CardIqFoodImport | null>(null);
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
      const restored = restoreNutritionState(parseSavedNutritionState(window.localStorage.getItem(LOCAL_NUTRITION_STORAGE_KEY)), clock.dayKey);
      setExtras(restored.extras);
      setPlanned(restored.planned);
      setStorageLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clock.dayKey]);
  useEffect(() => {
    if (!storageLoaded) return;
    const saved: SavedNutritionState = {
      dayKey: clock.dayKey,
      logs: extras.map((food) => food.components?.length ? { foodId: food.id, amount: food.amount, components: food.components } : { foodId: food.id, amount: food.amount }),
      planned: planned.map((entry) => ({ id: entry.id, kind: entry.kind })),
    };
    try {
      window.localStorage.setItem(LOCAL_NUTRITION_STORAGE_KEY, stringifySavedNutritionState(saved));
    } catch {
      window.setTimeout(() => notify("Nourish could not save on this browser"), 0);
    }
  }, [clock.dayKey, extras, planned, storageLoaded]);
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
  const cardIqQuickFoods = (cardIqImport?.items ?? []).flatMap((item) => {
    const food = item.matchedFoodId ? foods.find((candidate) => candidate.id === item.matchedFoodId) : null;
    return food ? [food] : [];
  }).filter((food, index, all) => all.findIndex((candidate) => candidate.id === food.id) === index);
  const quickFoods = cardIqQuickFoods.length ? cardIqQuickFoods : foods.filter((food) => food.common);
  const totals = sumLoggedNutrition(extras, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const calories = totals.calories;
  const macros = { protein: totals.protein, carbs: totals.carbs, fat: totals.fat };

  const nav = area === "track" ? trackNav : planNav;
  const activeView = area === "track" ? trackView : planView;
  const addFood = (food: Food) => {
    const isEdit = editingFoodIndex !== null;
    setExtras((value) => isEdit ? value.map((entry, index) => index === editingFoodIndex ? food : entry) : [...value, food]);
    // An edit is finished when it is applied. A new entry is not: a real plate is several
    // foods, so the logger stays open and KP closes it when the meal is fully recorded.
    if (isEdit) {
      setFoodDialog(false);
      setFoodDialogSelection(null);
      setEditingFoodIndex(null);
    }
    notify(`${food.name} ${isEdit ? "updated" : "added"} · ${Math.round(food.calories)} kcal`);
  };
  const openFoodLogger = (food: Food | null = null, editIndex: number | null = null) => {
    setFoodDialogSelection(food);
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
      if (trackView === "today") return <TodayView clock={clock} calories={calories} macros={macros} extras={extras} quickFoods={quickFoods} hasCardIqImport={cardIqImport !== null} onLog={() => openFoodLogger()} onAdd={(food) => openFoodLogger(food)} onEdit={(index) => openFoodLogger(extras[index], index)} onOpenMeals={() => { setArea("plan"); setPlanView("meals"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />;
      if (trackView === "history") return <HistoryView />;
      if (trackView === "trends") return <TrendsView />;
      return <PurchasesView cardIqImport={cardIqImport} onAdd={(food) => openFoodLogger(food)} />;
    }
    if (planView === "items") return <ItemsView planned={planned} onPlan={addItemToPlan} onRemove={removeFromPlan} />;
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
      {foodDialog ? <FoodDialog initialFood={foodDialogSelection} editing={editingFoodIndex !== null} onClose={() => { setFoodDialog(false); setFoodDialogSelection(null); setEditingFoodIndex(null); }} onAdd={addFood} /> : null}
      <RecipeDrawer recipe={recipe} onClose={() => setRecipe(null)} onPlan={addMealToPlan} />
      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite"><i>✓</i><span>{toast}</span></div>
    </div>
  );
}
