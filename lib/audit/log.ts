import prisma from "@/lib/prisma";

export type AuditWriteInput = {
  organizationId: string;
  branchId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string;
  actorName: string;
  reason?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  approvedByUserId?: string | null;
};

export async function writeAuditEvent(input: AuditWriteInput) {
  try {
    await prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        branchId: input.branchId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorUserId: input.actorUserId,
        actorName: input.actorName.slice(0, 120),
        reason: input.reason?.trim() || null,
        oldValue:
          input.oldValue === undefined
            ? undefined
            : (input.oldValue as object),
        newValue:
          input.newValue === undefined
            ? undefined
            : (input.newValue as object),
        approvedByUserId: input.approvedByUserId ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] write failed", err);
  }
}
