import mongoose, { Schema, Document, Model, models } from "mongoose";

export interface IActivityLog extends Document {
  user: mongoose.Types.ObjectId;
  userName: string;
  action: string;
  module: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    action: { type: String, required: true },
    module: { type: String, required: true },
    resourceId: { type: String },
    details: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

// Logs only need createdAt; disable updatedAt via { timestamps: { createdAt: true, updatedAt: false } }
ActivityLogSchema.set("timestamps", { createdAt: true, updatedAt: false });

const ActivityLog: Model<IActivityLog> =
  models.ActivityLog ?? mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
export default ActivityLog;
