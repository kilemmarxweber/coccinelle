import { createHash } from "crypto";

export type NotificationChannel = "email" | "whatsapp";

/** Journal structuré V1 (pas de table Prisma) — masque MDP / PII sensibles. */
export function logNotification(event: {
  channel: NotificationChannel;
  status: "sent" | "skipped" | "failed";
  refType: string;
  refId?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  to?: string | null;
  reason?: string;
}) {
  const toHash = event.to
    ? createHash("sha256").update(event.to.trim().toLowerCase()).digest("hex").slice(0, 12)
    : null;
  // eslint-disable-next-line no-console
  console.info(
    "[notification]",
    JSON.stringify({
      channel: event.channel,
      status: event.status,
      refType: event.refType,
      refId: event.refId ?? null,
      branchId: event.branchId ?? null,
      branchName: event.branchName ?? null,
      toHash,
      reason: event.reason ?? null,
    }),
  );
}
