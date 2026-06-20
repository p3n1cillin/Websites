import type { Business } from "../types";
import { elitePlumbing } from "./elite-plumbing";
import { sharpCutsBarbers } from "./sharp-cuts-barbers";
import { oliveTreeKitchen } from "./olive-tree-kitchen";

/**
 * Local business registry.
 *
 * To add a new business with zero coding: create a new file in this folder that
 * exports a `Business` object, then add it to the array below. That single edit
 * generates a complete, SEO-optimised website at /<slug>.
 *
 * (For larger catalogues, point the data layer at Supabase instead — see
 * lib/businesses.ts and the README.)
 */
export const LOCAL_BUSINESSES: Business[] = [
  elitePlumbing,
  sharpCutsBarbers,
  oliveTreeKitchen,
];
