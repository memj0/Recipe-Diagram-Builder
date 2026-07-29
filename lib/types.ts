export type RecipeChart = {
  title: string;
  prepNotes: string[];
  ingredients: Array<{ id: string; text: string }>;
  stages: Array<{
    id: string;
    label: string;
    ingredientIds: string[];
    instruction: string;
    branch?: boolean;
    inputStageIds?: string[];
  }>;
  finalStep: string;
  finalIngredientIds?: string[];
  finalInputStageIds?: string[];
  tips?: string[];
  meta?: {
    method: "deterministic" | "ai-fallback";
    confidence: number;
    warnings?: string[];
  };
};
