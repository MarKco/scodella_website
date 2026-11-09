import type { DishKind } from '../domain/types';

const KIND_EMOJI: Record<DishKind, string> = { VEGAN: '🌱', VEGETARIAN: '🧀', MEAT: '🍗', FISH: '🐟', COLD_CUTS: '🥓' };

export const kindEmoji = (k: DishKind): string => KIND_EMOJI[k];
