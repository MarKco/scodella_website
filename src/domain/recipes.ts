// Port ridotto di Recipes.kt: quale ricetta (ingredienti e allergeni) mostrare per un piatto in un menu.
import type { Menu, Recipe, SeasonRecipes } from './types';

const GLUTEN = 'GLUTEN';
const TRACE = 'trace:';

const hits = (code: string, found: string[]) => (code === GLUTEN ? found.some((f) => f.startsWith('GLUTEN_')) : found.includes(code));

export function violates(recipe: Recipe, token: string): boolean {
  if (token.startsWith(TRACE)) return hits(token.slice(TRACE.length), recipe.traces);
  return hits(token, recipe.allergens) || recipe.tags.includes(token);
}

export function compatible(recipe: Recipe, restrictions: string[]): boolean {
  return restrictions.every((r) => !violates(recipe, r));
}

/** La ricetta del piatto (chiave del catalogo) nel menu, o `null` se non c'è o la dieta non la ammette. */
export function findRecipe(recipes: SeasonRecipes | undefined, menu: Menu, dishKeyOfCatalog: string): { id: string; recipe: Recipe } | null {
  if (!recipes) return null;
  const id = recipes.links[dishKeyOfCatalog];
  const recipe = id ? recipes.recipes[id] : undefined;
  if (!id || !recipe || !compatible(recipe, menu.restrictions)) return null;
  return { id, recipe };
}
