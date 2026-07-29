import type { RecipeChart } from "./types";

export const sampleRecipe: RecipeChart = {
  title: "Espresso Brownies",
  prepNotes: ["Butter and flour an 8 × 8-inch pan", "Preheat oven to 350°F (170°C)"],
  ingredients: [
    { id: "i1", text: "4 oz (115 g) unsalted butter" },
    { id: "i2", text: "1 cup (200 g) sugar" },
    { id: "i3", text: "1/4 tsp vanilla extract" },
    { id: "i4", text: "1 shot freshly brewed espresso" },
    { id: "i5", text: "2 large eggs" },
    { id: "i6", text: "1/2 cup (80 g) all-purpose flour" },
    { id: "i7", text: "1/3 cup cocoa powder" },
    { id: "i8", text: "1/4 tsp baking soda" },
    { id: "i9", text: "1/4 tsp table salt" }
  ],
  stages: [
    { id: "s1", label: "melt", ingredientIds: ["i1"], instruction: "Melt the butter." },
    { id: "s2", label: "mix", ingredientIds: ["i1", "i2", "i3", "i4"], instruction: "Mix in sugar, vanilla and espresso." },
    { id: "s3", label: "mix", ingredientIds: ["i1", "i2", "i3", "i4", "i5"], instruction: "Mix in the eggs." },
    { id: "s4", label: "fold in", ingredientIds: ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8", "i9"], instruction: "Fold in the dry ingredients." }
  ],
  finalStep: "Bake at 350°F (170°C) for 30–40 minutes"
};
