/** Pièce d’identité de l’occupant — obligatoire pour tout séjour (scan / photo). */

export const GUEST_ID_DOC_TYPES = [
  "CNI",
  "PASSPORT",
  "PERMIS",
  "AUTRE",
] as const;

export type GuestIdDocType = (typeof GUEST_ID_DOC_TYPES)[number];

const MAX_ID_IMAGE_CHARS = 700_000; // ~512 Ko data URL

export function guestIdDocLabel(type: string): string {
  switch (type) {
    case "CNI":
      return "CNI";
    case "PASSPORT":
      return "Passeport";
    case "PERMIS":
      return "Permis";
    case "AUTRE":
      return "Autre";
    default:
      return type;
  }
}

export function normalizeGuestIdDocumentImage(imageUrl?: string | null): string {
  const v = imageUrl?.trim() || "";
  if (!v) throw new Error("Pièce d’identité : image (scan ou photo) obligatoire.");
  if (v.length > MAX_ID_IMAGE_CHARS) {
    throw new Error("Image pièce trop volumineuse (max. 512 Ko).");
  }
  if (
    !v.startsWith("data:image/") &&
    !v.startsWith("https://") &&
    !v.startsWith("http://")
  ) {
    throw new Error("Format d’image pièce invalide (JPEG, PNG ou WebP).");
  }
  if (v.startsWith("data:") && !/^data:image\/(jpeg|jpg|png|webp);/i.test(v)) {
    throw new Error("Formats acceptés : JPEG, PNG, WebP.");
  }
  return v;
}

export function readGuestIdFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choisissez une image (scan ou photo)."));
      return;
    }
    if (file.size > 512_000) {
      reject(new Error("Image trop volumineuse (max. 512 Ko)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

export function assertIndividualGuestId(input: {
  idDocumentType?: string | null;
  idDocumentNumber?: string | null;
  idDocumentImageUrl?: string | null;
}) {
  const type = input.idDocumentType?.trim() || "";
  const number = input.idDocumentNumber?.trim() || "";
  if (!(GUEST_ID_DOC_TYPES as readonly string[]).includes(type)) {
    throw new Error("Type de pièce d’identité invalide.");
  }
  if (!number) throw new Error("Numéro de pièce d’identité obligatoire.");
  const image = normalizeGuestIdDocumentImage(input.idDocumentImageUrl);
  return {
    idDocumentType: type as GuestIdDocType,
    idDocumentNumber: number,
    idDocumentImageUrl: image,
  };
}
