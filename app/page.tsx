"use client";

import { CSSProperties, FormEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RecipeChart } from "../lib/types";
import { sampleRecipe } from "../lib/sample";

function Chart({ recipe }: { recipe: RecipeChart }) {
  const rows = recipe.ingredients.length;
  const finalColumn = recipe.stages.length + 2;
  const longestIngredient = Math.max(...recipe.ingredients.map(ingredient => ingredient.text.length), 20);
  const ingredientWidth = Math.min(480, Math.max(280, longestIngredient * 6.5 + 28));
  const stageWidths = recipe.stages.map(stage => Math.min(112, Math.max(76, stage.label.length * 6 + 20)));
  const finalWidth = Math.min(180, Math.max(130, recipe.finalStep.length * 1.8));
  const chartWidth = ingredientWidth + stageWidths.reduce((total, width) => total + width, 0) + finalWidth;
  const ingredientIndex = useMemo(
    () => new Map(recipe.ingredients.map((ingredient, index) => [ingredient.id, index + 1])),
    [recipe.ingredients]
  );

  return (
    <section className="chart-shell" id="recipe-chart" aria-label={`${recipe.title} flowchart`} style={{ width: chartWidth }}>
      <h2>{recipe.title}</h2>
      {recipe.prepNotes.map((note, index) => <div className="prep-note" key={index}>{note}</div>)}
      <div
        className="flow-grid"
        style={{
          gridTemplateColumns: `${ingredientWidth}px ${stageWidths.map(width => `${width}px`).join(" ")} ${finalWidth}px`,
          gridTemplateRows: `repeat(${rows}, minmax(40px, auto))`
        }}
      >
        {recipe.ingredients.map((ingredient, index) => (
          <div className={`ingredient${index === rows - 1 ? " ingredient-last" : ""}`} key={ingredient.id} style={{ gridColumn: 1, gridRow: index + 1 }}>
            {ingredient.text}
          </div>
        ))}

        {recipe.stages.map((stage, stageIndex) => {
          const indices = stage.ingredientIds.map(id => ingredientIndex.get(id)).filter(Boolean) as number[];
          const start = indices.length ? Math.min(...indices) : 1;
          const end = indices.length ? Math.max(...indices) : rows;
          const column = stageIndex + 2;
          const consumerIndex = recipe.stages.findIndex((candidate, candidateIndex) =>
            candidateIndex > stageIndex && candidate.inputStageIds?.includes(stage.id)
          );
          const consumerColumn = consumerIndex >= 0
            ? consumerIndex + 2
            : recipe.finalInputStageIds?.includes(stage.id)
              ? finalColumn
              : undefined;
          const hasInputs = Boolean(stage.inputStageIds?.length);
          return (
            <div className="stage-group" key={stage.id}>
              {column > 2 && (
                <div className="branch-route entry-route" aria-hidden="true" style={{ gridColumn: `2 / ${column}`, gridRow: `${start} / span ${Math.max(end - start + 1, 1)}` }} />
              )}
              {stage.branch && !hasInputs && column > 2 && (
                <div className="branch-route entry-route entry-route-top" aria-hidden="true" style={{ gridColumn: `2 / ${column}`, gridRow: `${start} / span ${Math.max(end - start + 1, 1)}` }} />
              )}
              <div className={`stage-box${column > 2 ? " nested-box" : ""}${stage.branch ? " branch-box" : ""}${(stage.inputStageIds?.length || 0) > 1 ? " merge-box" : ""}`} style={{ gridColumn: column, gridRow: `${start} / span ${Math.max(end - start + 1, 1)}` }} title={stage.instruction}>
                <strong>{stage.label}</strong>
                <span>{stage.instruction}</span>
              </div>
              {consumerColumn && column + 1 < consumerColumn && (
                <div className="branch-route output-route" aria-hidden="true" style={{ gridColumn: `${column + 1} / ${consumerColumn}`, gridRow: `${start} / span ${Math.max(end - start + 1, 1)}` }} />
              )}
            </div>
          );
        })}

        {(recipe.finalIngredientIds || []).filter(id => !recipe.stages.some(stage => stage.ingredientIds.includes(id))).map(id => {
          const row = ingredientIndex.get(id);
          return row ? (
            <div className="final-route-group" key={`final-${id}`}>
              <div className="branch-route entry-route entry-route-top final-route" aria-hidden="true" style={{ gridColumn: `2 / ${finalColumn}`, gridRow: row }} />
              <div className="branch-route entry-route final-route" aria-hidden="true" style={{ gridColumn: `2 / ${finalColumn}`, gridRow: row }} />
            </div>
          ) : null;
        })}

        <div className="final-column" style={{ gridColumn: finalColumn, gridRow: `1 / span ${rows}` }}>
          <strong>{recipe.finalStep}</strong>
        </div>
      </div>
      {recipe.tips && recipe.tips.length > 0 && (
        <aside className="tips-box" aria-label="Recipe notes and storage information">
          <h3>Recipe notes</h3>
          <ul>{recipe.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul>
        </aside>
      )}
    </section>
  );
}

function FittedChart({ recipe }: { recipe: RecipeChart }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, width: 0, height: 0, printScale: 1 });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const updateFit = () => {
      const naturalWidth = content.scrollWidth;
      const naturalHeight = content.scrollHeight;
      const scale = naturalWidth ? Math.min(1, viewport.clientWidth / naturalWidth) : 1;
      const printScale = naturalWidth ? Math.min(1, 1050 / naturalWidth) : 1;
      setFit({ scale, width: naturalWidth * scale, height: naturalHeight * scale, printScale });
    };

    const observer = new ResizeObserver(updateFit);
    observer.observe(viewport);
    observer.observe(content);
    updateFit();
    return () => observer.disconnect();
  }, [recipe]);

  const fitStyle = { width: fit.width || undefined, height: fit.height || undefined };
  const scaleStyle = {
    transform: `scale(${fit.scale})`,
    "--print-scale": fit.printScale
  } as CSSProperties;

  return (
    <div className="preview-scroll">
      <div className="chart-viewport" ref={viewportRef}>
        <div className="chart-fit" style={fitStyle}>
          <div className="chart-scale" ref={contentRef} style={scaleStyle}><Chart recipe={recipe} /></div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"text" | "url">("text");
  const [input, setInput] = useState("");
  const [recipe, setRecipe] = useState<RecipeChart>(sampleRecipe);
  const [loading, setLoading] = useState(false);
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
        body: JSON.stringify({ recipeText, allowAiFallback: false })
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
        <p>The website uses its built-in parser to identify ingredients, actions, branches and cooking stages.</p>
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
          <button className="primary" disabled={loading}>{loading ? "Building chart…" : "Create recipe chart"}</button>
          {error && <p className="error">{error}</p>}
          <p className="hint">Recipe extraction, section detection, action matching and ingredient-to-step mapping are handled by the built-in parser.</p>
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
          <FittedChart recipe={recipe} />
        </div>
      </section>
    </main>
  );
}
