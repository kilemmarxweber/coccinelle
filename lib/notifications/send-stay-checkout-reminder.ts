import { sendBranchWhatsAppMessage } from "@/lib/zindua";
import { resolveNotificationBranch } from "@/lib/notifications/branch-context";
import { logNotification } from "@/lib/notifications/log";
import { HOTEL_CHECKOUT_HOUR } from "@/lib/hotel/constants";

export async function sendStayCheckoutReminderNotification(input: {
  branchId: string;
  stayId: string;
  guestName: string;
  guestPhone?: string | null;
  roomLabel?: string | null;
}): Promise<boolean> {
  if (!input.guestPhone?.trim()) {
    logNotification({
      channel: "whatsapp",
      status: "skipped",
      refType: "stay_checkout_reminder",
      refId: input.stayId,
      branchId: input.branchId,
      reason: "no_phone",
    });
    return false;
  }

  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  const brand = branch.name;
  const wa = await sendBranchWhatsAppMessage({
    to: input.guestPhone,
    name: input.guestName,
    branchName: brand,
    parts: [
      `Bonjour ${input.guestName},`,
      `rappel : votre sortie de ${brand} est prévue à ${HOTEL_CHECKOUT_HOUR}h.`,
      input.roomLabel ? `Espace ${input.roomLabel}.` : null,
      "Merci de préparer votre départ.",
    ],
  });
  logNotification({
    channel: "whatsapp",
    status: wa ? "sent" : "failed",
    refType: "stay_checkout_reminder",
    refId: input.stayId,
    branchId: branch.id,
    branchName: brand,
    to: input.guestPhone,
  });
  return Boolean(wa);
}
