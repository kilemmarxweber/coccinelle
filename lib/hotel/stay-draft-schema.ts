import { z } from "zod";

export const hotelDraftCheckoutStepSchema = z.enum(["guest", "paiement"]);
export type HotelDraftCheckoutStep = z.infer<typeof hotelDraftCheckoutStepSchema>;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

export const hotelStayDraftPayloadSchema = z.object({
  step: hotelDraftCheckoutStepSchema.default("guest"),
  roomTypeId: z.string().uuid(),
  roomTypeName: z.string().trim().min(1),
  checkInDate: dateOnlySchema,
  checkOutDate: dateOnlySchema,
  nights: z.number().int().min(1),
  priceNight: z.number().finite().nonnegative(),
  totalAmount: z.number().finite().nonnegative(),
  guestPrenom: z.string().trim().default(""),
  guestNom: z.string().trim().default(""),
  guestPhone: z.string().trim().default(""),
});

export type HotelStayDraftPayload = z.infer<typeof hotelStayDraftPayloadSchema>;

export const hotelDraftGuestAdvanceSchema = hotelStayDraftPayloadSchema.extend({
  guestPrenom: z.string().trim().min(1, "Prénom requis.").max(80),
  guestNom: z.string().trim().min(1, "Nom requis.").max(80),
  guestPhone: z.string().trim().min(5, "Téléphone requis.").max(30),
});

export const createHotelStayDraftInputSchema = z.object({
  orgSlug: z.string().trim().min(1),
  roomTypeId: z.string().uuid(),
  checkInDate: dateOnlySchema,
  checkOutDate: dateOnlySchema,
});

export const updateHotelStayDraftInputSchema = z.object({
  orgSlug: z.string().trim().min(1),
  draftToken: z.string().trim().min(1),
  payload: hotelStayDraftPayloadSchema,
});

export const advanceHotelStayDraftInputSchema = z.object({
  orgSlug: z.string().trim().min(1),
  draftToken: z.string().trim().min(1),
  payload: hotelStayDraftPayloadSchema,
});

export const payHotelStayDraftInputSchema = z.object({
  orgSlug: z.string().trim().min(1),
  draftToken: z.string().trim().min(1),
});
