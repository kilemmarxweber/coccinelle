import { sendBranchWhatsAppMessage } from "@/lib/zindua";
import { resolveNotificationBranch } from "@/lib/notifications/branch-context";
import { collectBranchPhones } from "@/lib/notifications/collect-branch-phones";
import { logNotification } from "@/lib/notifications/log";

export async function broadcastBranchPromoWhatsApp(input: {
  branchId: string;
  title: string;
  body: string;
  productName?: string | null;
}): Promise<{ sent: number; failed: number; total: number }> {
  const branch = await resolveNotificationBranch({ branchId: input.branchId });
  const phones = await collectBranchPhones(input.branchId);
  let sent = 0;
  let failed = 0;

  for (const to of phones) {
    const wa = await sendBranchWhatsAppMessage({
      to,
      name: "Client",
      branchName: branch.name,
      parts: [
        input.title,
        input.productName ? `Produit : ${input.productName}` : null,
        input.body,
      ],
    });
    if (wa) sent += 1;
    else failed += 1;
    logNotification({
      channel: "whatsapp",
      status: wa ? "sent" : "failed",
      refType: "promo_broadcast",
      branchId: branch.id,
      branchName: branch.name,
      to,
    });
  }

  return { sent, failed, total: phones.length };
}
