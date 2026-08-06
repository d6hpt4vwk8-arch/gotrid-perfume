import { prisma } from "@/lib/prisma";

interface LogEntry {
  action: string;
  entityType: string;
  entityId?: string;
  detail?: string;
}

// Best-effort — a failed audit-log write must never roll back or block the
// admin mutation it's describing.
export async function logAdminActivity(entry: LogEntry): Promise<void> {
  try {
    await prisma.adminActivityLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        detail: entry.detail,
      },
    });
  } catch (err) {
    console.error("[admin-activity-log] failed to write entry", entry, err);
  }
}
