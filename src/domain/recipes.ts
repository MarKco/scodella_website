// Port ridotto di Recipes.kt: quale ricetta (ingredienti e allergeni) mostrare per un piatto in un menu.
import { dishKey } from './menus';
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

/**
 * Parole che indicano maiale o suoi derivati (su testi già normalizzati da `dishKey`: minuscolo, senza accenti). Rete di sicurezza oltre al
 * flag `CONTAINS_PORK` delle ricette: un piatto nuovo non marcato, o fuori dalle ricette, si riconosce comunque dal nome o dagli ingredienti.
 */
const PORK_WORDS = /\b(maial\w*|suin\w*|prosciutt\w*|speck|salam\w*|pancett\w*|guancial\w*|lard\w*|strutto|wurstel|mortadell\w*|salsicc\w*|cotechin\w*|zampon\w*|bacon)\b/;

/** Il piatto (chiave del catalogo, o il suo nome normalizzato) contiene maiale: flag della ricetta, parole nel nome o negli ingredienti. */
export function servesPork(recipes: SeasonRecipes | undefined, key: string): boolean {
  if (PORK_WORDS.test(key)) return true;
  const id = recipes?.links[key];
  const recipe = id ? recipes!.recipes[id] : undefined;
  if (!recipe) return false;
  if (recipe.flags.includes('CONTAINS_PORK')) return true;
  return recipe.ingredients.some((i) => {
    const ing = recipes!.ingredients[i];
    return !!ing && PORK_WORDS.test(dishKey(`${ing.name} ${ing.composition ?? ''}`));
  });
}

/** La ricetta del piatto (chiave del catalogo) nel menu, o `null` se non c'è o la dieta non la ammette. */
export function findRecipe(recipes: SeasonRecipes | undefined, menu: Menu, dishKeyOfCatalog: string): { id: string; recipe: Recipe } | null {
  if (!recipes) return null;
  const id = recipes.links[dishKeyOfCatalog];
  const recipe = id ? recipes.recipes[id] : undefined;
  if (!id || !recipe || !compatible(recipe, menu.restrictions)) return null;
  return { id, recipe };
}
