"use client";

// The one editing surface for every food in Nourish.
//
// Plan · Items, Plan · Meals and the Track logger all open this component, so a
// product created while planning is the same record Track logs, and a macro
// corrected while logging is the same record Plan shows (ARCH-04).

import { useMemo, useState } from "react";
import {
  FOOD_UNITS,
  MIN_RECIPE_COMPONENTS,
  UNIT_LIMITS,
  computeNutrition,
  foodLabel,
  listsAsProduct,
  makeFoodId,
  searchFoods,
  validateFood,
  type Food,
  type FoodComponent,
  type FoodKind,
  type FoodUnit,
} from "./food-model";

const MACRO_FIELDS = ["calories", "protein", "carbs", "fat", "fiber"] as const;
const MACRO_LABELS: Record<(typeof MACRO_FIELDS)[number], string> = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
  fiber: "Fibre",
};

function emptyFood(kind: FoodKind, existingIds: string[]): Food {
  const base = {
    id: "",
    kind,
    brand: kind === "recipe" ? "Nourish kitchen" : "",
    name: "",
    variant: "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    availability: "",
    aliases: [] as string[],
    source: { label: "Added by you", url: "", trust: "Personal" as const },
  };
  return kind === "recipe"
    ? { ...base, amount: 1, unit: "serving", category: "Meal", serving: "1 bowl", components: [], tags: [], ingredients: [], method: [], id: makeFoodId(kind, base.brand, "new meal", existingIds) }
    : { ...base, amount: 100, unit: "g", category: "Product", id: makeFoodId(kind, "", "new product", existingIds) };
}

/** Strips a scaled copy back to its per-basis numbers so editing never compounds a scale. */
function atBasis(food: Food): Food {
  if (!food.basis) return food;
  const { basis, ...rest } = food;
  return { ...rest, amount: basis.amount, calories: basis.calories, protein: basis.protein, carbs: basis.carbs, fat: basis.fat, fiber: basis.fiber };
}

export type FoodEditorProps = {
  kind: FoodKind;
  /** null creates a new food; a food edits it in place. */
  initial: Food | null;
  catalog: Food[];
  onSave: (food: Food) => void;
  onClose: () => void;
};

export function FoodEditor({ kind, initial, catalog, onSave, onClose }: FoodEditorProps) {
  const creating = initial === null;
  const existingIds = useMemo(() => catalog.map((food) => food.id), [catalog]);
  const [draft, setDraft] = useState<Food>(() => (initial ? atBasis(initial) : emptyFood(kind, existingIds)));
  const [componentSearch, setComponentSearch] = useState("");
  const [aliasText, setAliasText] = useState(() => (initial?.aliases ?? []).join(", "));
  const [showProblems, setShowProblems] = useState(false);

  const isRecipe = draft.kind === "recipe";
  const update = <K extends keyof Food>(key: K, value: Food[K]) => setDraft((food) => ({ ...food, [key]: value }));
  const updateNumber = (key: keyof Food, raw: string) => setDraft((food) => ({ ...food, [key]: raw === "" ? 0 : Number(raw) }));

  const components = useMemo(() => draft.components ?? [], [draft.components]);
  // Components may only be products: a meal is a combination of things that
  // each carry one nutrition label.
  const componentChoices = useMemo(
    () => searchFoods(catalog.filter(listsAsProduct), componentSearch).slice(0, 8),
    [catalog, componentSearch],
  );
  const calculated = useMemo(() => computeNutrition({ ...draft, components }, catalog), [draft, components, catalog]);
  const shown = isRecipe ? calculated : { calories: draft.calories, protein: draft.protein, carbs: draft.carbs, fat: draft.fat, fiber: draft.fiber };

  const candidate: Food = {
    ...draft,
    brand: draft.brand.trim(),
    name: draft.name.trim(),
    variant: draft.variant.trim(),
    aliases: aliasText.split(",").map((alias) => alias.trim()).filter(Boolean),
    ...(isRecipe ? { components, ...calculated } : { components: undefined }),
  };
  const validation = validateFood(candidate, catalog);

  const setComponentAmount = (foodId: string, amount: number) =>
    update("components", components.map((component) => (component.foodId === foodId ? { ...component, amount } : component)));
  const addComponent = (food: Food) => {
    if (components.some((component) => component.foodId === food.id)) return;
    update("components", [...components, { foodId: food.id, amount: food.amount } satisfies FoodComponent]);
    setComponentSearch("");
  };
  const removeComponent = (foodId: string) => update("components", components.filter((component) => component.foodId !== foodId));

  const save = () => {
    if (!validation.valid) {
      setShowProblems(true);
      return;
    }
    const id = creating ? makeFoodId(candidate.kind, candidate.brand, candidate.name, existingIds) : candidate.id;
    onSave({
      ...candidate,
      id,
      basis: undefined,
      availability: candidate.availability.trim() || (isRecipe ? candidate.serving?.trim() || "Your kitchen" : "Added by you"),
      source: {
        label: candidate.source.label.trim() || (creating ? "Added by you" : "Edited by you"),
        url: candidate.source.url.trim(),
        // A hand-entered or hand-corrected number is a personal source, not a label.
        trust: candidate.source.url.trim() && candidate.source.trust !== "Personal" ? candidate.source.trust : "Personal",
      },
    });
  };

  const title = `${creating ? "New" : "Edit"} ${isRecipe ? "meal" : "product"}`;

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="food-editor" role="dialog" aria-modal="true" aria-labelledby="food-editor-title">
        <header>
          <div>
            <span className="eyebrow">{isRecipe ? "Plan · Meals" : "Plan · Items"}</span>
            <h2 id="food-editor-title">{title}</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label={`Close ${title}`}>×</button>
        </header>

        <div className="food-editor-body">
          <div className="editor-column">
            <fieldset className="editor-group">
              <legend>Identity</legend>
              <label><span>Brand *</span><input value={draft.brand} onChange={(event) => update("brand", event.target.value)} placeholder={isRecipe ? "Nourish kitchen" : "Organic India"} /></label>
              <label><span>{isRecipe ? "Meal name *" : "Item name *"}</span><input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder={isRecipe ? "Poha with peanuts" : "Poha · thick"} /></label>
              <label><span>Variant</span><input value={draft.variant} onChange={(event) => update("variant", event.target.value)} placeholder="Optional, e.g. Roasted / 500 g" /></label>
              <label><span>Also known as</span><input value={aliasText} onChange={(event) => setAliasText(event.target.value)} placeholder="Comma separated, e.g. flattened rice, avalakki" /></label>
            </fieldset>

            {isRecipe ? (
              <fieldset className="editor-group">
                <legend>Serving</legend>
                <label><span>This meal makes</span><input value={draft.serving ?? ""} onChange={(event) => update("serving", event.target.value)} placeholder="1 breakfast bowl" /></label>
                <label><span>Time</span><input value={draft.time ?? ""} onChange={(event) => update("time", event.target.value)} placeholder="20 min" /></label>
                <label><span>Tags</span><input value={(draft.tags ?? []).join(", ")} onChange={(event) => update("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} placeholder="High protein, Vegetarian" /></label>
                <p className="editor-hint">Amounts below are for <strong>one serving</strong>. Nutrition is calculated from them and updates whenever you correct a product.</p>
              </fieldset>
            ) : (
              <fieldset className="editor-group">
                <legend>Nutrition basis</legend>
                <div className="editor-inline">
                  <label><span>Per</span><input type="number" min="0.01" step="0.01" max={UNIT_LIMITS[draft.unit]} value={draft.amount} onChange={(event) => updateNumber("amount", event.target.value)} /></label>
                  <label><span>Unit</span><select value={draft.unit} onChange={(event) => update("unit", event.target.value as FoodUnit)}>{FOOD_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                </div>
                <label><span>Pack size</span><input value={draft.packSize ?? ""} onChange={(event) => update("packSize", event.target.value)} placeholder="500 g pouch" /></label>
                <div className="nutrition-fields">
                  {MACRO_FIELDS.map((field) => (
                    <label key={field}>
                      <span>{MACRO_LABELS[field]}</span>
                      <div>
                        <input type="number" min="0" step="0.1" value={draft[field]} onChange={(event) => updateNumber(field, event.target.value)} />
                        <b>{field === "calories" ? "kcal" : "g"}</b>
                      </div>
                    </label>
                  ))}
                </div>
                <label className="editor-check">
                  <input type="checkbox" checked={draft.preparedMeal === true} onChange={(event) => update("preparedMeal", event.target.checked)} />
                  <span>Ready-to-eat meal <small>One nutrition label, so it stays a product — but it also appears under Meals.</small></span>
                </label>
              </fieldset>
            )}

            <fieldset className="editor-group">
              <legend>Where the numbers come from</legend>
              <label><span>Source</span><input value={draft.source.label} onChange={(event) => update("source", { ...draft.source, label: event.target.value })} placeholder="Pack label · 500 g pouch" /></label>
              <label><span>Evidence link</span><input value={draft.source.url} onChange={(event) => update("source", { ...draft.source, url: event.target.value })} placeholder="https://…" /></label>
              <label><span>Strength</span><select value={draft.source.trust} onChange={(event) => update("source", { ...draft.source, trust: event.target.value as Food["source"]["trust"] })}>{["Official label", "Label mirror", "Reference", "Personal"].map((trust) => <option key={trust}>{trust}</option>)}</select></label>
              <label><span>Image link</span><input value={draft.images?.[0]?.url ?? ""} onChange={(event) => update("images", event.target.value.trim() ? [{ url: event.target.value.trim(), kind: isRecipe ? "dish" : "pack" }] : undefined)} placeholder="https://… or /food-images/name.webp" /></label>
            </fieldset>
          </div>

          <div className="editor-column">
            {isRecipe ? (
              <fieldset className="editor-group editor-components">
                <legend>Products in this meal <b>{components.length}</b></legend>
                <div className="component-search">
                  <span>⌕</span>
                  <input value={componentSearch} onChange={(event) => setComponentSearch(event.target.value)} placeholder="Search a product to add…" aria-label="Search products to add to this meal" />
                </div>
                {componentSearch ? (
                  <div className="component-choices">
                    {componentChoices.map((food) => (
                      <button key={food.id} onClick={() => addComponent(food)} disabled={components.some((component) => component.foodId === food.id)}>
                        <span>{foodLabel(food)}</span><small>{Math.round(food.calories)} kcal / {food.amount} {food.unit}</small><b>＋</b>
                      </button>
                    ))}
                    {componentChoices.length === 0 ? <p className="editor-hint">No product matches. Create it under Plan · Items first.</p> : null}
                  </div>
                ) : null}
                <div className="component-list">
                  {components.length === 0 ? <p className="editor-hint">A meal is a combination — add at least {MIN_RECIPE_COMPONENTS} products.</p> : null}
                  {components.map((component) => {
                    const food = catalog.find((candidate) => candidate.id === component.foodId);
                    return (
                      <div className={`component-row ${food ? "" : "missing"}`} key={component.foodId}>
                        <span>{food ? foodLabel(food) : `Missing product · ${component.foodId}`}</span>
                        <label>
                          <input type="number" min="0.01" step="0.01" max={food ? UNIT_LIMITS[food.unit] : undefined} value={component.amount} onChange={(event) => setComponentAmount(component.foodId, Number(event.target.value))} aria-label={`Amount of ${food ? food.name : component.foodId}`} />
                          <b>{food?.unit ?? "?"}</b>
                        </label>
                        <button onClick={() => removeComponent(component.foodId)} aria-label={`Remove ${food ? food.name : component.foodId}`}>×</button>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            <div className="editor-preview dark-card">
              <span className="eyebrow bright">{isRecipe ? "Calculated per serving" : `Per ${draft.amount || 0} ${draft.unit}`}</span>
              <div className="live-nutrition">
                <strong><b>{Math.round(shown.calories)}</b><small>kcal</small></strong>
                <span><b>{shown.protein.toFixed(1)}g</b><small>protein</small></span>
                <span><b>{shown.carbs.toFixed(1)}g</b><small>carbs</small></span>
                <span><b>{shown.fat.toFixed(1)}g</b><small>fat</small></span>
                <span><b>{shown.fiber.toFixed(1)}g</b><small>fibre</small></span>
              </div>
              {isRecipe ? <p>Calculated from {components.length} product{components.length === 1 ? "" : "s"}. Correcting any of them updates this meal everywhere.</p> : null}
            </div>

            {showProblems && !validation.valid ? (
              <div className="editor-problems" role="alert" id="food-editor-problems">
                <strong>Not saved yet</strong>
                <ul>{validation.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="editor-actions">
          <button className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button lime" onClick={save} aria-describedby={showProblems && !validation.valid ? "food-editor-problems" : undefined}>
            {creating ? `Create ${isRecipe ? "meal" : "product"}` : "Save changes"}
          </button>
        </footer>
      </section>
    </div>
  );
}
