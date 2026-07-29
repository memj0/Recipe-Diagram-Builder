import type { RecipeChart } from "./types";

const sectionHeadings = /^(ingredients?|what you(?:'|’)ll need|instructions?|method|directions?|steps?|preparation)\s*:?[\s]*$/i;
const ingredientStart = /^(?:\d+\s+)?(?:\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?)?\s*(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|grams?|g|kg|ml|l|oz|ounces?|lb|lbs|pounds?|cloves?|cans?|packets?|pinch|dash|handful|large|medium|small)?\b/i;
const actionWords = /\b(preheat|heat|warm|melt|whizz|blitz|whisk|mix|stir|fold|beat|blend|check|combine|add|put|place|transfer|pour|ladle|cook|flip|bake|roast|grill|fry|simmer|boil|chill|freeze|cool|leave|rest|serve|season|slice|cut|chop|dice|knead|roll|assemble|sandwich|stack|layer|fill|coat|cover|spread|line|grease|decorate)\b/i;
const prepWords = /(preheat|grease|butter .*pan|line .*pan|prepare .*tin|set .*oven|heat (?:the )?oven)/i;

function cleanLine(value: string) {
  return value.replace(/^[\s•●▪◦*-]+/, "").replace(/^\d+[.)]\s*/, "").replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, char => char.toUpperCase());
}

function descriptiveActionLabel(step: string) {
  const match = step.match(/\b(whizz|blitz|blend|check|heat|cook|flip|put|place|transfer|add|pour|ladle|mix|combine|fold|beat|whisk|stir|assemble|sandwich|stack|layer|fill|coat|cover|spread|decorate)\b[^.!?;]*/i);
  if (!match) return undefined;

  const cleaned = match[0]
    .replace(/,?\s+(?:then|before|until|and (?:then|serve|chill|leave|put|place))\b.*$/i, "")
    .replace(/\b(?:the|a|an|just|under|about|roughly|approximately|remaining|rest of|half of|half|some of|some)\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:g|kg|ml|l|oz|lb|tsp|tbsp)s?\b/gi, " ")
    .replace(/\b(?:finely|roughly|coarsely|chopped|cubed|diced|sliced|beaten|melted|softened)\b/gi, " ")
    .replace(/\bcakes?\b/gi, "layers")
    .replace(/\band\b/gi, "&")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(/\s+/);
  if (words.length > 11) {
    const destination = cleaned.match(/\b(?:in|into|onto|over|with)\s+(?:[a-z-]+\s+){0,3}(?:pan|tin|bowl|dish|tray|blender|processor|mixture|batter|dough|ganache|icing|filling)\b/i)?.[0];
    const shortened = words.slice(0, destination ? 8 : 11).join(" ");
    return `${shortened}${destination && !shortened.includes(destination) ? ` ${destination}` : ""}`.toLowerCase();
  }

  return words.length > 1 ? cleaned.toLowerCase() : undefined;
}

function actionLabel(step: string) {
  const componentName = step.match(/^\s*to make\s+(?:the\s+)?([a-z][a-z -]{1,28}?)(?:,|\s+(?:put|mix|stir|combine|add|heat|whisk|beat)\b)/i);
  if (componentName) return `make ${componentName[1].trim().toLowerCase()}`;

  const descriptiveLabel = descriptiveActionLabel(step);
  if (descriptiveLabel) return descriptiveLabel;

  let matches = [...step.matchAll(new RegExp(actionWords.source, "gi"))]
    .filter(match => {
      const before = step.slice(0, match.index).toLowerCase();
      const word = match[1].toLowerCase();
      if (word === "heat" && /\b(?:off|the)\s+$/.test(before)) return false;
      if (word === "rest" && /\bthe\s+$/.test(before)) return false;
      return true;
    })
    .map(match => match[1].toLowerCase())
    .filter((word, index, words) => words.indexOf(word) === index);

  if ((step.match(/\bmixtures?\b/gi)?.length || 0) >= 2 || /\beverything\b/i.test(step)) return "combine";

  const cookingVerb = matches.find(word => /^(?:bake|roast|grill|fry|simmer|boil|chill|freeze)$/.test(word));
  if (cookingVerb) return cookingVerb;

  if (matches.some(word => /^(?:assemble|sandwich|stack|layer|fill|coat|cover)$/.test(word))) {
    matches = matches.filter(word => !/^(?:put|pour|add|rest)$/.test(word));
  } else if (matches.some(word => /^(?:mix|stir|whisk|beat|fold|blend|combine|heat|warm|melt|cool)$/.test(word))) {
    matches = matches.filter(word => !/^(?:put|pour|add|leave|rest)$/.test(word));
  }

  matches = matches.slice(0, 2);
  const placement = step.match(/\bput\b[^.!?]*?\b(?:in|into)\s+(?:a|an|the)?\s*(pan|bowl|tin|dish|jug|pot|tray)\b/i);
  if (matches[0] === "put" && placement) matches[0] = `put in ${placement[1].toLowerCase()}`;
  return matches.length ? matches.join(" & ") : step.split(/[.,;]/, 1)[0].trim().split(/\s+/).slice(0, 3).join(" ").toLowerCase();
}

function ingredientTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:to taste|divided|plus more|for serving|optional|fresh|ground|unsalted|salted|large|medium|small|finely|roughly|chopped|diced|sliced|melted|softened|the|and|for|with|into|from|plus|extra|remaining|little|very|handful|decoration|prepared)\b/g, " ")
    .replace(/\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]|\b(?:cup|cups|tbsp|tablespoon|tsp|teaspoon|g|kg|ml|l|oz|ounce|ounces|lb|lbs|pound|clove|cloves|can|cans|pinch|dash)\b/g, " ")
    .split(/[^a-z]+/)
    .filter(word => word.length > 2)
    .map(word => word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word);
}

function hasIngredientQuantity(text: string) {
  return /^\s*(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/u.test(text);
}

function removeUnquantifiedDuplicates(ingredients: string[]) {
  const quantifiedSignatures = new Set(
    ingredients
      .filter(hasIngredientQuantity)
      .map(ingredient => [...new Set(ingredientTokens(ingredient))].sort().join("|"))
      .filter(Boolean)
  );
  return ingredients.filter(ingredient => {
    const signature = [...new Set(ingredientTokens(ingredient))].sort().join("|");
    return hasIngredientQuantity(ingredient) || !signature || !quantifiedSignatures.has(signature);
  });
}

const tipWords = /\b(?:keeps?|will keep|store|storage|make ahead|freezable|can be frozen|leftovers?|best eaten|stays? fresh|shelf life)\b/i;
const pageFurniture = /^(?:ad|advertisement|method|ingredients?|nutrition|recipe tips?|tips?|to serve|cook mode|step\s*\d+|low|high|loading(?:\.\.\.)?)$/i;
const nutritionLine = /^(?:kcal|calories?|fat|saturates?|carbs?|carbohydrates?|sugars?|fibre|fiber|protein|salt|sodium)\s*\d/i;

function splitActionSentences(instructions: string[]) {
  return instructions.flatMap(instruction => {
    const sentences = instruction.split(/(?<=[.!?])\s+/).map(cleanLine).filter(Boolean);
    if (sentences.length < 2) return sentences;
    const steps: string[] = [];
    for (const sentence of sentences) {
      if (actionWords.test(sentence) || !steps.length) steps.push(sentence);
      else steps[steps.length - 1] = `${steps[steps.length - 1]} ${sentence}`;
    }
    return steps;
  });
}

function separateTips(instructions: string[]) {
  const tips: string[] = [];
  const actions = instructions.map(instruction => {
    const sentences = instruction.split(/(?<=[.!?])\s+/).filter(Boolean);
    const actionSentences = sentences.filter(sentence => {
      if (!tipWords.test(sentence)) return true;
      tips.push(sentence.trim());
      return false;
    });
    return actionSentences.join(" ").trim();
  }).filter(Boolean);
  return { actions, tips: [...new Set(tips)].slice(0, 8) };
}

function parseSectionsLegacy(recipeText: string) {
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
    ingredients: removeUnquantifiedDuplicates(ingredients).slice(0, 40),
    instructions: [...new Set(instructions)].slice(0, 30)
  };
}

function parseSections(recipeText: string) {
  const rawLines = recipeText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const methodIndex = rawLines.findIndex(line => /^(?:method|instructions?|directions?|steps?|preparation)\s*:?$/i.test(line));
  const ingredientsIndex = rawLines.findIndex(line => /^(?:ingredients?|what you.+need)\s*:?$/i.test(line));
  const first = rawLines[0] || "";
  const firstIsIngredient = /^(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞]|pinch\b|dash\b|handful\b)/i.test(first);
  const title = first && !firstIsIngredient && !pageFurniture.test(first) && !actionWords.test(first) ? first : "Recipe";
  const ingredients: string[] = [];
  const instructions: string[] = [];

  if (methodIndex >= 0) {
    const start = ingredientsIndex >= 0 ? ingredientsIndex + 1 : title === first ? 1 : 0;
    for (const line of rawLines.slice(start, methodIndex)) {
      if (pageFurniture.test(line) || nutritionLine.test(line) || /keep the screen awake|per serving/i.test(line)) continue;
      if (/^(?:\(|or\b)/i.test(line) && ingredients.length) ingredients[ingredients.length - 1] += ` ${line}`;
      else if (line.length < 120) ingredients.push(line);
    }

    for (const line of rawLines.slice(methodIndex + 1)) {
      if (/^(?:recipe tips?|tips?|to serve|comments, questions and tips|rate this recipe)\s*:?$/i.test(line)) break;
      if (pageFurniture.test(line) || nutritionLine.test(line) || /keep the screen awake/i.test(line)) continue;
      if (actionWords.test(line) || line.length > 70) instructions.push(line);
    }
  }

  if (!ingredients.length || !instructions.length) {
    const legacy = parseSectionsLegacy(recipeText);
    return {
      ...legacy,
      title: firstIsIngredient ? "Recipe" : legacy.title,
      instructions: splitActionSentences(legacy.instructions)
    };
  }

  return {
    title: titleCase(title.replace(/^(recipe\s*:)/i, "").trim() || "Recipe"),
    ingredients: removeUnquantifiedDuplicates(ingredients).slice(0, 40),
    instructions: splitActionSentences([...new Set(instructions)]).slice(0, 30)
  };
}

function parseEmbeddedNutrition(recipeText: string): RecipeChart["nutrition"] | undefined {
  function nutrient(names: string) {
    const match = recipeText.match(new RegExp(`(?:^|\\n)\\s*(?:${names})\\s*:?\\s*(\\d+(?:\\.\\d+)?)\\s*(kcal|calories?|g|grams?|mg|milligrams?)?`, "im"));
    if (!match) return undefined;
    const unit = (match[2] || "g").toLowerCase();
    if (/kcal|calorie/.test(unit)) return `${match[1]} calories`;
    if (/^mg|milligram/.test(unit)) return `${match[1]} mg`;
    return `${match[1]} g`;
  }

  const nutrition = {
    serving: recipeText.match(/nutrition\s*:?\s*per\s+([^\r\n]+)/i)?.[1]?.trim()
      || recipeText.match(/serves?\s+(\d+)/i)?.[1],
    calories: nutrient("kcal|calories?"),
    carbohydrate: nutrient("carbs?|carbohydrates?"),
    protein: nutrient("protein"),
    fat: nutrient("fat"),
    saturatedFat: nutrient("saturates?|saturated fat"),
    fiber: nutrient("fibre|fiber"),
    sugar: nutrient("sugars?"),
    sodium: nutrient("salt|sodium"),
    source: "recipe" as const
  };
  return Object.entries(nutrition).some(([key, value]) => key !== "source" && value) ? nutrition : undefined;
}

export function parseRecipeDeterministically(recipeText: string): { chart: RecipeChart; confidence: number; warnings: string[] } {
  const parsed = parseSections(recipeText);
  const warnings: string[] = [];
  const ingredients = parsed.ingredients.map((text, index) => ({ id: `i${index + 1}`, text }));
  const separated = separateTips(parsed.instructions);
  const prepNotes = separated.actions.filter(step => prepWords.test(step)).slice(0, 4);
  const cookingSteps = separated.actions.filter(step => !prepNotes.includes(step));
  const finalIndex = cookingSteps.length - 1;
  const finalStep = cookingSteps.at(-1) || "Serve when ready.";
  const stageSteps = cookingSteps.slice(0, -1).slice(0, 16);
  const usedIngredientIds = new Set<string>();
  type Component = { ingredientIds: Set<string>; producerStageId?: string };
  let components: Component[] = [];
  let currentComponent = -1;
  const tokensByIngredient = new Map(ingredients.map(ingredient => [ingredient.id, ingredientTokens(ingredient.text)]));
  const tokenFrequency = new Map<string, number>();
  tokensByIngredient.forEach(tokens => new Set(tokens).forEach(token => tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1)));

  function ingredientsMentionedIn(instruction: string) {
    const instructionTokens = new Set(ingredientTokens(instruction));
    const candidates = ingredients.filter(ingredient => {
      const ingredientTokenList = tokensByIngredient.get(ingredient.id) || [];
      const matches = ingredientTokenList.filter(token => instructionTokens.has(token));
      return matches.length >= 2
        || (ingredientTokenList.length === 1 && matches.length === 1)
        || matches.some(token => tokenFrequency.get(token) === 1);
    });

    const bySignature = new Map<string, typeof candidates>();
    candidates.forEach(ingredient => {
      const signature = [...new Set(tokensByIngredient.get(ingredient.id) || [])].sort().join("|");
      bySignature.set(signature, [...(bySignature.get(signature) || []), ingredient]);
    });

    return [...bySignature.values()].map(group =>
      group.find(ingredient => !usedIngredientIds.has(ingredient.id)) || group[0]
    ).map(ingredient => ingredient.id);
  }

  const stages = stageSteps.map((instruction, index) => {
    const stageId = `s${index + 1}`;
    const matched = ingredientsMentionedIn(instruction);
    matched.forEach(id => usedIngredientIds.add(id));
    const mixtureMentions = instruction.match(/\bmixtures?\b/gi)?.length || 0;
    const mergesComponents = /\b(everything|all together)\b/i.test(instruction)
      || mixtureMentions >= 2
      || /\b(assemble|sandwich|stack|layer|fill|coat|cover)\b/i.test(instruction);
    const startsNewComponent = /\b(to make|meanwhile|separately|in (?:another|a separate))\b/i.test(instruction);
    const referencesCurrentFlow = /\b(this|that|the mixture|the batter|the dough|combined)\b/i.test(instruction)
      || /\b(?:in)?to the pan\b/i.test(instruction)
      || /^\s*(?:add|fold in|stir in|whisk in|beat in)\b/i.test(instruction);
    const matchedSet = new Set(matched);
    const namedMixtureReference = /\b(?:the\s+)?(?:mixture|batter|dough)\b/i.test(instruction);
    const overlappingComponents = components
      .map((component, componentIndex) => ({ component, componentIndex }))
      .filter(({ component }) => matched.some(id => component.ingredientIds.has(id)));
    let inputStageIds: string[] = [];

    if (namedMixtureReference && !overlappingComponents.length && components.length > 1) {
      const mainIndex = components.reduce((largest, component, componentIndex) =>
        component.ingredientIds.size > components[largest].ingredientIds.size ? componentIndex : largest, 0);
      const selectedIndices = new Set([mainIndex, currentComponent].filter(componentIndex => componentIndex >= 0));
      const selected = components.filter((_, componentIndex) => selectedIndices.has(componentIndex));
      inputStageIds = selected.flatMap(component => component.producerStageId ? [component.producerStageId] : []);
      const merged = new Set(selected.flatMap(component => [...component.ingredientIds]));
      matched.forEach(id => merged.add(id));
      components = components.filter((_, componentIndex) => !selectedIndices.has(componentIndex));
      components.push({ ingredientIds: merged, producerStageId: stageId });
      currentComponent = components.length - 1;
    } else if (mergesComponents && components.length) {
      inputStageIds = components.flatMap(component => component.producerStageId ? [component.producerStageId] : []);
      const merged = new Set(components.flatMap(component => [...component.ingredientIds]));
      matched.forEach(id => merged.add(id));
      components = [{ ingredientIds: merged, producerStageId: stageId }];
      currentComponent = 0;
    } else if (overlappingComponents.length) {
      const mergedIndices = new Set(overlappingComponents.map(({ componentIndex }) => componentIndex));
      const merged = new Set(matched);
      inputStageIds = overlappingComponents.flatMap(({ component }) => component.producerStageId ? [component.producerStageId] : []);
      overlappingComponents.forEach(({ component }) => component.ingredientIds.forEach(id => merged.add(id)));
      components = components.filter((_, componentIndex) => !mergedIndices.has(componentIndex));
      components.push({ ingredientIds: merged, producerStageId: stageId });
      currentComponent = components.length - 1;
    } else if (matched.length && referencesCurrentFlow && !startsNewComponent && currentComponent >= 0) {
      const component = components[currentComponent];
      if (component.producerStageId) inputStageIds = [component.producerStageId];
      matched.forEach(id => component.ingredientIds.add(id));
      component.producerStageId = stageId;
    } else if (matched.length) {
      components.push({ ingredientIds: matchedSet, producerStageId: stageId });
      currentComponent = components.length - 1;
    } else if (currentComponent >= 0) {
      const component = components[currentComponent];
      if (component.producerStageId) inputStageIds = [component.producerStageId];
      component.producerStageId = stageId;
    }
    const ingredientIds = currentComponent >= 0 ? [...components[currentComponent].ingredientIds] : matched;
    const branch = components.length > 1 && currentComponent > 0;

    return {
      id: stageId,
      label: actionLabel(instruction),
      ingredientIds,
      instruction,
      branch,
      inputStageIds: [...new Set(inputStageIds)]
    };
  });

  const finalIngredientIds = ingredientsMentionedIn(finalStep);
  const finalInputStageIds = [...new Set(components.flatMap(component => component.producerStageId ? [component.producerStageId] : []))];
  const firstUse = new Map<string, number>();
  stages.forEach((stage, stageIndex) => stage.ingredientIds.forEach(id => {
    if (!firstUse.has(id)) firstUse.set(id, stageIndex);
  }));
  finalIngredientIds.forEach(id => {
    if (!firstUse.has(id)) firstUse.set(id, stages.length);
  });
  const originalPosition = new Map(ingredients.map((ingredient, index) => [ingredient.id, index]));
  const orderedIngredients = [...ingredients].sort((left, right) => {
    const leftUse = firstUse.get(left.id) ?? Number.POSITIVE_INFINITY;
    const rightUse = firstUse.get(right.id) ?? Number.POSITIVE_INFINITY;
    return leftUse - rightUse || originalPosition.get(left.id)! - originalPosition.get(right.id)!;
  });
  const reorderedId = new Map(orderedIngredients.map((ingredient, index) => [ingredient.id, `i${index + 1}`]));
  const chartIngredients = orderedIngredients.map(ingredient => ({ id: reorderedId.get(ingredient.id)!, text: ingredient.text }));
  const chartStages = stages.map(stage => ({
    ...stage,
    ingredientIds: stage.ingredientIds.map(id => reorderedId.get(id) || id)
  }));
  const chartFinalIngredientIds = finalIngredientIds.map(id => reorderedId.get(id) || id);

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
    ingredients: chartIngredients.length ? chartIngredients : [{ id: "i1", text: "Ingredients could not be identified" }],
    stages: chartStages.length ? chartStages : [{ id: "s1", label: "prepare", ingredientIds: ["i1"], instruction: cookingSteps[0] || "Review and prepare the recipe ingredients.", inputStageIds: [] }],
    finalStep,
    finalIngredientIds: chartFinalIngredientIds,
    finalInputStageIds,
    tips: separated.tips,
    nutrition: parseEmbeddedNutrition(recipeText)
  };

  return { chart, confidence, warnings };
}
