import prisma from "@/lib/prisma";
import type { HotelRoomStatusValue } from "@/lib/hotel/room-status";
import { guestDisplayName } from "@/lib/hotel/stay-status";

export type RoomBoardRoom = {
  id: string;
  number: string;
  floor: string | null;
  status: HotelRoomStatusValue;
  roomTypeId: string;
  roomTypeName: string;
  priceNight: number;
  capacity: number;
  /** Guest name when an IN_HOUSE stay occupies the room */
  guestName: string | null;
};

export type RoomBoardType = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  priceNight: number;
  roomCount: number;
};

export type RoomBoardKpis = {
  total: number;
  ready: number;
  dirty: number;
  occupied: number;
  outOfOrder: number;
  /** Occupied / (total - outOfOrder), 0 if denominator is 0 */
  occupancyPercent: number;
};

export type RoomBoardData = {
  rooms: RoomBoardRoom[];
  types: RoomBoardType[];
  kpis: RoomBoardKpis;
  floors: string[];
};

function computeKpis(rooms: RoomBoardRoom[]): RoomBoardKpis {
  const total = rooms.length;
  let ready = 0;
  let dirty = 0;
  let occupied = 0;
  let outOfOrder = 0;
  for (const room of rooms) {
    switch (room.status) {
      case "AVAILABLE":
        ready += 1;
        break;
      case "CLEANING":
        dirty += 1;
        break;
      case "OCCUPIED":
        occupied += 1;
        break;
      case "OUT_OF_ORDER":
        outOfOrder += 1;
        break;
    }
  }
  const sellable = total - outOfOrder;
  const occupancyPercent =
    sellable <= 0 ? 0 : Math.round((occupied / sellable) * 100);
  return { total, ready, dirty, occupied, outOfOrder, occupancyPercent };
}

export async function listRoomsBoard(branchId: string): Promise<RoomBoardData> {
  const [typesRaw, inHouseStays] = await Promise.all([
    prisma.hotelRoomType.findMany({
      where: { branchId },
      orderBy: { name: "asc" },
      include: {
        rooms: { orderBy: [{ floor: "asc" }, { number: "asc" }] },
      },
    }),
    prisma.hotelStay.findMany({
      where: {
        branchId,
        status: "IN_HOUSE",
        roomId: { not: null },
      },
      select: {
        roomId: true,
        guestPrenom: true,
        guestNom: true,
      },
    }),
  ]);

  const guestByRoomId = new Map<string, string>();
  for (const stay of inHouseStays) {
    if (stay.roomId) {
      guestByRoomId.set(
        stay.roomId,
        guestDisplayName(stay.guestPrenom, stay.guestNom),
      );
    }
  }

  const types: RoomBoardType[] = typesRaw.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    capacity: t.capacity,
    priceNight: t.priceNight,
    roomCount: t.rooms.length,
  }));

  const rooms: RoomBoardRoom[] = typesRaw.flatMap((t) =>
    t.rooms.map((r) => ({
      id: r.id,
      number: r.number,
      floor: r.floor,
      status: r.status as HotelRoomStatusValue,
      roomTypeId: t.id,
      roomTypeName: t.name,
      priceNight: t.priceNight,
      capacity: t.capacity,
      guestName: guestByRoomId.get(r.id) ?? null,
    })),
  );

  const floorSet = new Set<string>();
  for (const room of rooms) {
    floorSet.add(room.floor?.trim() ? room.floor.trim() : "—");
  }
  const floors = Array.from(floorSet).sort((a, b) =>
    a.localeCompare(b, "fr", { numeric: true }),
  );

  return {
    rooms,
    types,
    kpis: computeKpis(rooms),
    floors,
  };
}
