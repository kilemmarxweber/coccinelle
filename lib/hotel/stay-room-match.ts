/** Matching saisie libre ↔ séjour CHECKED_IN (n° de chambre). */

export type StayRoomMatch = {
  id: string;
  guestName: string;
  room: { number: string };
};

/** Extrait un n° de chambre depuis une saisie libre (ex. "12", "Ch. 12", "chambre 101"). */
export function extractRoomNumber(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const labeled = t.match(
    /(?:ch(?:ambre)?\.?\s*|room\s*|#)\s*([a-z0-9_-]+)/i,
  );
  if (labeled?.[1]) return labeled[1].toUpperCase();
  if (/^[a-z0-9_-]{1,8}$/i.test(t)) return t.toUpperCase();
  return null;
}

export function matchStayByRoom<T extends StayRoomMatch>(
  stays: T[],
  roomHint: string | null,
): T | null {
  if (!roomHint) return null;
  const exact = stays.find(
    (s) => s.room.number.trim().toUpperCase() === roomHint,
  );
  if (exact) return exact;
  return (
    stays.find((s) => s.room.number.trim().toUpperCase().endsWith(roomHint)) ??
    null
  );
}

/** Résultat de résolution chambre → séjour check-in (ou absence de client). */
export type RoomStayLookup<T extends StayRoomMatch = StayRoomMatch> =
  | { status: "idle" }
  | { status: "matched"; roomNumber: string; stay: T }
  | { status: "no_guest"; roomNumber: string }
  | { status: "no_checkins" };

export function lookupRoomStay<T extends StayRoomMatch>(
  stays: T[],
  rawInput: string,
): RoomStayLookup<T> {
  const roomNumber = extractRoomNumber(rawInput);
  if (!roomNumber) return { status: "idle" };
  if (stays.length === 0) return { status: "no_checkins" };
  const stay = matchStayByRoom(stays, roomNumber);
  if (stay) return { status: "matched", roomNumber, stay };
  return { status: "no_guest", roomNumber };
}
