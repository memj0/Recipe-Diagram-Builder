import type { RecipeChart } from "./types";

const sectionHeadings = /^(ingredients?|what you(?:'|’)ll need|instructions?|method|directions?|steps?|preparation)\s*:?[\s]*$/i;
const ingredientStart = /^(?:\d+\s+)?(?:\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?)?\s*(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|grams?|g|kg|ml|l|oz|ounces?|lb|lbs|pounds?|cloves?|cans?|packets?|pinch|dash|handful|large|medium|small)?\b/i;
const actionWords = /\b(preheat|heat|warm|melt|whisk|mix|stir|fold|beat|blend|combine|add|put|pour|bake|roast|grill|fry|simmer|boil|chill|freeze|cool|leave|rest|serve|season|slice|cut|chop|dice|knead|roll|assemble|sandwich|stack|layer|fill|coat|cover|spread|line|grease|decorate)\b/i;
const prepWords = /(preheat|grease|butter .*pan|line .*pan|prepare .*tin|set .*oven|heat (?:the )?oven)/i;

function cleanLine(value: string) {
  return value.replace(/^[\s•●▪◦*-]+/, "").replace(/^\d+[.)]\s*/, "").replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, char => char.toUpperCase());
}

function actionLabel(step: string) {
  const componentName = step.match(/^\s*to make\s+(?:the\s+)?([a-z][a-z -]{1,28}?)(?:,|\s+(?:put|mix|stir|combine|add|heat|whisk|beat)\b)/i);
  if (componentName) return `make ${componentName[1].trim().toLowerCase()}`;

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
    ingredients: removeUnquantifiedDuplicates(ingredients).slice(0, 40),
    instructions: [...new Set(instructions)].slice(0, 30)
  };
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
      const matches = (tokensByIngredient.get(ingredient.id) || []).filter(token => instructionTokens.has(token));
      return matches.length >= 2 || matches.some(token => tokenFrequency.get(token) === 1);
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
    const overlappingComponents = components
      .map((component, componentIndex) => ({ component, componentIndex }))
      .filter(({ component }) => matched.some(id => component.ingredientIds.has(id)));
    let inputStageIds: string[] = [];

    if (mergesComponents && components.length) {
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
  const stageIngredientIds = new Set(stages.flatMap(stage => stage.ingredientIds));
  const finalOnlyIds = new Set(finalIngredientIds.filter(id => !stageIngredientIds.has(id)));
  const orderedIngredients = [
    ...ingredients.filter(ingredient => !finalOnlyIds.has(ingredient.id)),
    ...ingredients.filter(ingredient => finalOnlyIds.has(ingredient.id))
  ];
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
    tips: separated.tips
  };

  return { chart, confidence, warnings };
}
