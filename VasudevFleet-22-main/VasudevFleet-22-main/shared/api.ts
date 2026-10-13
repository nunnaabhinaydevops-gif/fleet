/**
 * Shared code between client and server
 * Useful to share types between both sides of the application.
 */

export interface DemoResponse {
  message: string;
}

export type AuditAction = "create" | "update" | "delete" | "approve" | "cancel";

export interface AuditLog {
  id: string;
  timestamp: string;
  tripId: string;
  action: AuditAction;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  updatedBy: string;
  comments: string;
  status: "success" | "failed";
}
