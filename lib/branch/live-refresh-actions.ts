"use server";

import { refresh } from "next/cache";

/** Force le RSC de la page courante (cache client prod). */
export async function bumpBranchLiveAction() {
  try {
    refresh();
  } catch {
    /* hors d’une action liée à une page */
  }
}
