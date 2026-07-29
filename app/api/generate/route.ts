import { NextResponse } from "next/server";
import { parseRecipeDeterministically } from "../../../lib/parser";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "prepNotes", "ingredients", "stages", "finalStep", "finalIngredientIds", "finalInputStageIds", "tips"],
  properties: {
    title: { type: "string" },
    prepNotes: { type: "array", items: { type: "string" }, maxItems: 4 },
    ingredients: {
      type: "array", minItems: 1,
      items: { type: "object", additionalProperties: false, required: ["id", "text"], properties: { id: { type: "string" }, text: { type: "string" } } }
    },
    stages: {
      type: "array", minItems: 1, maxItems: 16,
      items: {
        type: "object", additionalProperties: false, required: ["id", "label", "ingredientIds", "instruction", "branch", "inputStageIds"],
        properties: {
          id: { type: "string" }, label: { type: "string" }, instruction: { type: "string" },
          ingredientIds: { type: "array", items: { type: "string" }, minItems: 1 },
          branch: { type: "boolean" },
          inputStageIds: { type: "array", items: { type: "string" } }
        }
      }
    },
    finalStep: { type: "string" },
    finalIngredientIds: { type: "array", items: { type: "string" } },
    finalInputStageIds: { type: "array", items: { type: "string" } },
    tips: { type: "array", items: { type: "string" }, maxItems: 8 }
  }
};

export async function POST(request: Request) {
  try {
    const { recipeText, allowAiFallback = true } = await request.json();
    if (typeof recipeText !== "string" || recipeText.trim().length < 30) return NextResponse.json({ error: "Paste a fuller recipe before generating a chart." }, { status: 400 });
    if (recipeText.length > 40000) return NextResponse.json({ error: "Recipe text is too long." }, { status: 400 });

    const deterministic = parseRecipeDeterministically(recipeText);
    const shouldUseAi = Boolean(allowAiFallback) && deterministic.confidence < 0.72 && Boolean(process.env.OPENAI_API_KEY);

    if (!shouldUseAi) {
      return NextResponse.json({
        ...deterministic.chart,
        meta: { method: "deterministic", confidence: deterministic.confidence, warnings: deterministic.warnings }
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        store: false,
        instructions: "You are a fallback parser. Convert the supplied recipe into accurate flowchart data. Preserve quantities and temperatures. List every real ingredient once in original order and use ids i1, i2, etc.; omit unquantified duplicate ingredient artifacts when a quantified equivalent exists. Make each suitable recipe instruction line one stage. Use the instruction's own verb or short compound verbs as its label and retain useful destinations such as 'put in pan'. Stage ingredientIds contain the ingredients in that stage's output. inputStageIds identify earlier stage outputs consumed by this stage. Mark branch true for a separately prepared component. Put oven or pan preparation in prepNotes. Put the last action in finalStep, ingredients first added there in finalIngredientIds, and active stage outputs feeding it in finalInputStageIds. Move storage advice, shelf-life notes, and non-action hints into tips instead of cooking stages. Do not invent details.",
        input: recipeText,
        text: { format: { type: "json_schema", name: "recipe_flowchart", strict: true, schema } }
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json({
        ...deterministic.chart,
        meta: { method: "deterministic", confidence: deterministic.confidence, warnings: [...deterministic.warnings, "AI fallback failed, so the deterministic result was used."] }
      });
    }
    const outputText = payload.output_text || payload.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("The AI returned no chart data.");
    return NextResponse.json({ ...JSON.parse(outputText), meta: { method: "ai-fallback", confidence: deterministic.confidence, warnings: deterministic.warnings } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate the chart." }, { status: 500 });
  }
}
