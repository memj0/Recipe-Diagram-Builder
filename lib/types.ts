export type RecipeChart = {
  title: string;
  prepNotes: string[];
  ingredients: Array<{ id: string; text: string }>;
  stages: Array<{
    id: string;
    label: string;
    ingredientIds: string[];
    instruction: string;
  }>;
  finalStep: string;
  meta?: {
    method: "deterministic" | "ai-fallback";
    confidence: number;
    warnings?: string[];
  };
};
