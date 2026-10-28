import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/authz";

export interface AuditInput {
  entityType: string;
  entityId: string;
  entityRef?: string | null;
  action: string;
  actorRole: Role;
  actorId: string;
  summary: string;
  payload?: Prisma.InputJsonValue;
}

/**
 * Writes an append-only audit event. Must be called inside the same transaction
 * as the state change it describes so the trail can never disagree with the data.
 * There is deliberately no update or delete helper.
 */
export async function recordAudit(tx: Tx, input: AuditInput): Promise<void> {
  await tx.auditEvent.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      entityRef: input.entityRef ?? null,
      action: input.action,
      actorRole: input.actorRole,
      actorId: input.actorId,
      summary: input.summary,
      payload: input.payload ?? {},
    },
  });
}

export async function listAuditFor(entityType: string, entityId: string, take = 50) {
  return prisma.auditEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
