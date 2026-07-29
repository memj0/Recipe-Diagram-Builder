"use client";

import { FormEvent, useMemo, useState } from "react";
import type { RecipeChart } from "../lib/types";
import { sampleRecipe } from "../lib/sample";

function Chart({ recipe }: { recipe: RecipeChart }) {
  const rows = recipe.ingredients.length;
  const ingredientIndex = useMemo(
    () => new Map(recipe.ingredients.map((ingredient, index) => [ingredient.id, index + 1])),
    [recipe.ingredients]
  );

  return (
    <section className="chart-shell" id="recipe-chart" aria-label={`${recipe.title} flowchart`}>
      <h2>{recipe.title}</h2>
      {recipe.prepNotes.map((note, index) => <div className="prep-note" key={index}>{note}</div>)}
      <div className="flow-grid" style={{ gridTemplateColumns: `minmax(310px, 2.7fr) repeat(${recipe.stages.length}, minmax(92px, .72fr)) minmax(140px, 1fr)` }}>
        <div className="ingredient-column">
          {recipe.ingredients.map((ingredient) => <div className="ingredient" key={ingredient.id}>{ingredient.text}</div>)}
        </div>

        {recipe.stages.map((stage) => {
          const indices = stage.ingredientIds.map(id => ingredientIndex.get(id)).filter(Boolean) as number[];
          const start = Math.min(...indices, 1);
          const end = Math.max(...indices, rows);
          return (
            <div className="stage-column" key={stage.id}>
              <div className="stage-spacer" style={{ flex: start - 1 }} />
              <div className="stage-box" style={{ flex: Math.max(end - start + 1, 1) }} title={stage.instruction}>
                <strong>{stage.label}</strong>
                <span>{stage.instruction}</span>
              </div>
              <div className="stage-spacer" style={{ flex: Math.max(rows - end, 0) }} />
            </div>
          );
        })}

        <div className="final-column"><strong>{recipe.finalStep}</strong></div>
      </div>
    </section>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"text" | "url">("text");
  const [input, setInput] = useState("");
  const [recipe, setRecipe] = useState<RecipeChart>(sampleRecipe);
  const [loading, setLoading] = useState(false);
  const [allowAiFallback, setAllowAiFallback] = useState(true);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      let recipeText = input.trim();
      if (mode === "url") {
        const extractResponse = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: recipeText })
        });
        const extracted = await extractResponse.json();
        if (!extractResponse.ok) throw new Error(extracted.error || "Could not read that recipe URL.");
        recipeText = extracted.text;
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeText, allowAiFallback })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create the chart.");
      setRecipe(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="hero">
        <span className="eyebrow">RECIPE → FLOWCHART</span>
        <h1>Turn any written recipe into a visual cooking chart.</h1>
        <p>The website first uses its own deterministic parser to identify ingredients, actions and cooking stages. AI is only used as an optional fallback when the recipe structure is too ambiguous.</p>
      </header>

      <section className="workspace">
        <form onSubmit={submit} className="input-card">
          <div className="tabs" role="tablist">
            <button type="button" className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>Paste recipe</button>
            <button type="button" className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>Recipe link</button>
          </div>
          <label htmlFor="recipe-input">{mode === "text" ? "Recipe text" : "Public recipe URL"}</label>
          {mode === "text" ? (
            <textarea id="recipe-input" value={input} onChange={e => setInput(e.target.value)} placeholder="Paste ingredients and instructions here…" rows={12} />
          ) : (
            <input id="recipe-input" type="url" value={input} onChange={e => setInput(e.target.value)} placeholder="https://example.com/recipe" />
          )}
          <label className="fallback-option">
            <input type="checkbox" checked={allowAiFallback} onChange={event => setAllowAiFallback(event.target.checked)} />
            <span><strong>Allow AI fallback</strong><small>Only activates when the built-in parser has low confidence.</small></span>
          </label>
          <button className="primary" disabled={loading}>{loading ? "Building chart…" : "Create recipe chart"}</button>
          {error && <p className="error">{error}</p>}
          <p className="hint">The main engine is non-AI. Recipe JSON-LD, section detection, action matching and ingredient-to-step mapping are handled deterministically.</p>
        </form>

        <div className="preview-card">
          <div className="preview-toolbar">
            <div>
              <span>Live result</span>
              {recipe.meta && <span className={`method-badge ${recipe.meta.method}`}>
                {recipe.meta.method === "deterministic" ? "Built-in parser" : "AI fallback"} · {Math.round(recipe.meta.confidence * 100)}% parser confidence
              </span>}
            </div>
            <button type="button" onClick={() => window.print()}>Print / save PDF</button>
          </div>
          <div className="preview-scroll"><Chart recipe={recipe} /></div>
        </div>
      </section>
    </main>
  );
}
