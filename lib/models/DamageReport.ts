import mongoose, { Schema, Document, Model, models } from "mongoose";

export interface IDamageReport extends Document {
  movement: mongoose.Types.ObjectId;
  asset: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  type: "damage" | "defect" | "missing";
  reason: string;
  reportedBy: mongoose.Types.ObjectId;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DamageReportSchema = new Schema<IDamageReport>(
  {
    movement: { type: Schema.Types.ObjectId, ref: "Movement", required: true },
    asset: { type: Schema.Types.ObjectId, ref: "Asset", required: true },
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    type: { type: String, enum: ["damage", "defect", "missing"], required: true },
    reason: { type: String, required: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isResolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },
  },
  { timestamps: true }
);

const DamageReport: Model<IDamageReport> =
  models.DamageReport ?? mongoose.model<IDamageReport>("DamageReport", DamageReportSchema);
export default DamageReport;
