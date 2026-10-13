import type { AuditLog } from "@shared/api";

const auditLogService = {
  async getAllAuditLogs(): Promise<AuditLog[]> {
    return [];
  },
  async logTripUpdate(..._args: unknown[]): Promise<void> {},
  async logTripCancellation(..._args: unknown[]): Promise<void> {},
  async logTripStatusChange(..._args: unknown[]): Promise<void> {},
  async logTripCreation(..._args: unknown[]): Promise<void> {},
};

export { auditLogService };
