import { load } from "cheerio";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local") || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

function recipeFromJsonLd(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = recipeFromJsonLd(item); if (found) return found; }
    return null;
  }
  if (typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const type = obj["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return obj;
  if (obj["@graph"]) return recipeFromJsonLd(obj["@graph"]);
  return null;
}

function instructionText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (typeof obj.text === "string") return [obj.text];
      if (Array.isArray(obj.itemListElement)) return instructionText(obj.itemListElement);
    }
    return [];
  });
}

function textValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(", ");
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function extractNutrition(recipe: Record<string, unknown>) {
  const raw = recipe.nutrition;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const nutrition = raw as Record<string, unknown>;
  const result = {
    serving: textValue(nutrition.servingSize) || textValue(recipe.recipeYield),
    calories: textValue(nutrition.calories),
    carbohydrate: textValue(nutrition.carbohydrateContent),
    protein: textValue(nutrition.proteinContent),
    fat: textValue(nutrition.fatContent),
    saturatedFat: textValue(nutrition.saturatedFatContent),
    fiber: textValue(nutrition.fiberContent),
    sugar: textValue(nutrition.sugarContent),
    sodium: textValue(nutrition.sodiumContent),
    source: "recipe" as const
  };
  return Object.values(result).some((value, index) => index > 0 && value) ? result : undefined;
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (typeof url !== "string") return NextResponse.json({ error: "Please provide a recipe URL." }, { status: 400 });
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || isPrivateHost(parsed.hostname)) return NextResponse.json({ error: "That URL is not allowed." }, { status: 400 });

    const response = await fetch(parsed.toString(), {
      headers: { "User-Agent": "RecipeFlowchart/1.0 (+https://vercel.app)", "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`The recipe page returned ${response.status}.`);
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error("That page is too large to process.");
    const $ = load(html);

    for (const node of $('script[type="application/ld+json"]').toArray()) {
      try {
        const recipe = recipeFromJsonLd(JSON.parse($(node).text()));
        if (recipe) {
          const title = String(recipe.name || $("title").text() || "Recipe");
          const ingredients = Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient.map(String) : [];
          const instructions = instructionText(recipe.recipeInstructions);
          const text = `${title}\n\nINGREDIENTS\n${ingredients.join("\n")}\n\nINSTRUCTIONS\n${instructions.join("\n")}`;
          return NextResponse.json({ text, nutrition: extractNutrition(recipe) });
        }
      } catch { /* try next JSON-LD block */ }
    }

    $("script,style,noscript,svg,nav,footer,header,aside").remove();
    const fallback = $("main").text() || $("article").text() || $("body").text();
    const clean = fallback.replace(/\s+/g, " ").trim().slice(0, 30000);
    if (clean.length < 100) throw new Error("No readable recipe was found on that page.");
    return NextResponse.json({ text: clean });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not extract the recipe." }, { status: 500 });
  }
}
