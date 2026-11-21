"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { boutiqueRoutes } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(/[;,]/).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iName = idx("name") >= 0 ? idx("name") : idx("nom");
  const iSku = idx("sku") >= 0 ? idx("sku") : idx("code");
  const iPrice = idx("price") >= 0 ? idx("price") : idx("prix");
  const iStock = idx("stock") >= 0 ? idx("stock") : idx("qte");
  const iCat = idx("category") >= 0 ? idx("category") : idx("categorie");
  if (iName < 0) throw new Error("Colonne nom/name requise.");
  return lines.slice(1).map((line) => {
    const cols = line.split(/[;,]/);
    return {
      name: cols[iName]?.trim() ?? "",
      sku: (iSku >= 0 ? cols[iSku] : "")?.trim() || undefined,
      price: Number(iPrice >= 0 ? cols[iPrice] : 0) || 0,
      stock: Math.floor(Number(iStock >= 0 ? cols[iStock] : 0) || 0),
      category: (iCat >= 0 ? cols[iCat] : "")?.trim() || "Divers",
    };
  });
}

export async function importShopCatalogCsvAction(input: {
  organizationId: string;
  branchId: string;
  csv: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    input.branchId,
  );
  if (!branch || branch.organizationId !== input.organizationId) {
    throw new Error("Branche inaccessible.");
  }
  const rows = parseCsv(input.csv).filter((r) => r.name.length >= 2);
  if (!rows.length) throw new Error("Aucune ligne valide.");

  let created = 0;
  for (const row of rows) {
    let category = await prisma.shopCategory.findFirst({
      where: { branchId: input.branchId, name: row.category },
    });
    if (!category) {
      category = await prisma.shopCategory.create({
        data: { branchId: input.branchId, name: row.category },
      });
    }
    const sku =
      row.sku?.slice(0, 32) ||
      row.name.slice(0, 8).toUpperCase().replace(/\s+/g, "") +
        String(created + 1).padStart(3, "0");
    const exists = await prisma.shopProduct.findFirst({
      where: { branchId: input.branchId, sku },
    });
    if (exists) continue;
    await prisma.shopProduct.create({
      data: {
        branchId: input.branchId,
        categoryId: category.id,
        name: row.name,
        sku,
        price: row.price,
        stockQty: row.stock,
        kind: "ARTICLE",
        active: true,
      },
    });
    created += 1;
  }
  revalidatePath(boutiqueRoutes.produits(input.organizationId, input.branchId));
  revalidatePath(boutiqueRoutes.marketing(input.organizationId, input.branchId));
  return { created, skipped: rows.length - created };
}
