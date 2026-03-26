import mongoose, { Schema, Document, Model, models } from "mongoose";

export interface IMovement extends Document {
  asset: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  allocatedPerson: mongoose.Types.ObjectId;
  status: "OUT" | "IN";
  outDate: Date;
  outBy: mongoose.Types.ObjectId;
  inDate?: Date;
  returnBy?: string;
  verifiedBy?: string;
  condition: "good" | "damaged" | "defective" | "missing";
  damageReason?: string;
  remarks?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MovementSchema = new Schema<IMovement>(
  {
    asset: { type: Schema.Types.ObjectId, ref: "Asset", required: true },
    event: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    allocatedPerson: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    status: { type: String, enum: ["OUT", "IN"], default: "OUT" },
    outDate: { type: Date, required: true, default: Date.now },
    outBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    inDate: { type: Date },
    returnBy: { type: String },
    verifiedBy: { type: String },
    condition: { type: String, enum: ["good", "damaged", "defective", "missing"], default: "good" },
    damageReason: { type: String },
    remarks: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Movement: Model<IMovement> =
  models.Movement ?? mongoose.model<IMovement>("Movement", MovementSchema);
export default Movement;
