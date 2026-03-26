import { connectDB } from "@/lib/mongodb";
import ActivityLog from "@/lib/models/ActivityLog";

interface LogActivityParams {
  userId: string;
  userName: string;
  action: string;
  module: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await connectDB();
    await ActivityLog.create({
      user: params.userId,
      userName: params.userName,
      action: params.action,
      module: params.module,
      resourceId: params.resourceId,
      details: params.details,
      ipAddress: params.ipAddress,
    });
  } catch {
    // Logging failures must never break the main flow
    console.error("Failed to log activity:", params);
  }
}
