import type { RecipeChart } from "./types";

const sectionHeadings = /^(ingredients?|what you(?:'|’)ll need|instructions?|method|directions?|steps?|preparation)\s*:?[\s]*$/i;
const ingredientStart = /^(?:\d+\s+)?(?:\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?)?\s*(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|grams?|g|kg|ml|l|oz|ounces?|lb|lbs|pounds?|cloves?|cans?|packets?|pinch|dash|handful|large|medium|small)?\b/i;
const actionWords = /(preheat|heat|melt|whisk|mix|stir|fold|beat|blend|combine|add|pour|bake|roast|grill|fry|simmer|boil|chill|freeze|rest|serve|season|slice|chop|dice|knead|roll|assemble|spread|line|grease)/i;
const prepWords = /(preheat|grease|butter .*pan|line .*pan|prepare .*tin|set .*oven|heat oven)/i;
const finalWords = /(bake|roast|grill|simmer|boil|chill|freeze|rest|serve|cool|decorate|garnish)/i;

function cleanLine(value: string) {
  return value.replace(/^[\s•●▪◦*-]+/, "").replace(/^\d+[.)]\s*/, "").replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, char => char.toUpperCase());
}

function actionLabel(step: string) {
  const match = step.match(actionWords);
  if (!match) return "combine";
  const word = match[1].toLowerCase();
  if (word === "combine" || word === "add" || word === "stir") return "mix";
  if (word === "beat") return "whisk";
  if (word === "roast" || word === "grill" || word === "fry") return "cook";
  if (word === "freeze") return "chill";
  return word;
}

function ingredientTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:to taste|divided|plus more|for serving|optional|fresh|ground|unsalted|salted|large|medium|small|finely|roughly|chopped|diced|sliced|melted|softened)\b/g, " ")
    .replace(/\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|\b(?:cup|cups|tbsp|tablespoon|tsp|teaspoon|g|kg|ml|l|oz|ounce|ounces|lb|lbs|pound|clove|cloves|can|cans|pinch|dash)\b/g, " ")
    .split(/[^a-z]+/)
    .filter(word => word.length > 2);
}

function parseSections(recipeText: string) {
  const rawLines = recipeText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  let title = rawLines[0] || "Recipe";
  const ingredients: string[] = [];
  const instructions: string[] = [];
  let section: "unknown" | "ingredients" | "instructions" = "unknown";

  for (let index = 0; index < rawLines.length; index++) {
    const line = rawLines[index];
    const lower = line.toLowerCase().replace(/:$/, "");
    if (/^(ingredients?|what you(?:'|’)ll need)$/.test(lower)) { section = "ingredients"; continue; }
    if (/^(instructions?|method|directions?|steps?|preparation)$/.test(lower)) { section = "instructions"; continue; }
    if (index === 0 && !sectionHeadings.test(line) && line.length < 120 && !actionWords.test(line)) { title = line; continue; }

    if (section === "ingredients") ingredients.push(line);
    else if (section === "instructions") instructions.push(line);
  }

  if (!ingredients.length || !instructions.length) {
    const candidates = rawLines.slice(rawLines[0] === title ? 1 : 0);
    for (const line of candidates) {
      const looksIngredient = ingredientStart.test(line) && !/[.!?]$/.test(line) && line.length < 150;
      if (looksIngredient && !actionWords.test(line)) ingredients.push(line);
      else if (actionWords.test(line) || line.length > 70) instructions.push(line);
    }
  }

  return {
    title: titleCase(title.replace(/^(recipe\s*:)/i, "").trim() || "Recipe"),
    ingredients: [...new Set(ingredients)].slice(0, 40),
    instructions: [...new Set(instructions)].slice(0, 30)
  };
}

export function parseRecipeDeterministically(recipeText: string): { chart: RecipeChart; confidence: number; warnings: string[] } {
  const parsed = parseSections(recipeText);
  const warnings: string[] = [];
  const ingredients = parsed.ingredients.map((text, index) => ({ id: `i${index + 1}`, text }));
  const prepNotes = parsed.instructions.filter(step => prepWords.test(step)).slice(0, 4);
  const cookingSteps = parsed.instructions.filter(step => !prepNotes.includes(step));
  const finalIndex = cookingSteps.findLastIndex(step => finalWords.test(step));
  const finalStep = finalIndex >= 0 ? cookingSteps[finalIndex] : cookingSteps.at(-1) || "Serve when ready.";
  const stageSteps = cookingSteps.filter((_, index) => index !== finalIndex).slice(0, 8);

  const stages = stageSteps.map((instruction, index) => {
    const lower = instruction.toLowerCase();
    let matched = ingredients.filter(ingredient => {
      const tokens = ingredientTokens(ingredient.text);
      return tokens.some(token => lower.includes(token));
    }).map(ingredient => ingredient.id);

    if (!matched.length && ingredients.length) {
      const progressiveEnd = Math.max(1, Math.ceil(((index + 1) / Math.max(stageSteps.length, 1)) * ingredients.length));
      matched = ingredients.slice(0, progressiveEnd).map(ingredient => ingredient.id);
    }

    return {
      id: `s${index + 1}`,
      label: actionLabel(instruction),
      ingredientIds: matched,
      instruction
    };
  });

  if (!ingredients.length) warnings.push("No clear ingredient list was detected.");
  if (parsed.instructions.length < 2) warnings.push("Only a small number of instruction steps were detected.");
  if (!stages.length) warnings.push("No intermediate cooking stages were detected.");

  let confidence = 0;
  if (ingredients.length >= 3) confidence += 0.4;
  else confidence += ingredients.length * 0.1;
  if (parsed.instructions.length >= 3) confidence += 0.35;
  else confidence += parsed.instructions.length * 0.1;
  if (stages.some(stage => stage.ingredientIds.length > 0)) confidence += 0.15;
  if (prepNotes.length || finalIndex >= 0) confidence += 0.1;
  confidence = Math.min(1, Number(confidence.toFixed(2)));

  const chart: RecipeChart = {
    title: parsed.title,
    prepNotes,
    ingredients: ingredients.length ? ingredients : [{ id: "i1", text: "Ingredients could not be identified" }],
    stages: stages.length ? stages : [{ id: "s1", label: "prepare", ingredientIds: ["i1"], instruction: cookingSteps[0] || "Review and prepare the recipe ingredients." }],
    finalStep
  };

  return { chart, confidence, warnings };
}
