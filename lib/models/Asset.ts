import mongoose, { Schema, Document, Model, models } from "mongoose";

export interface IAsset extends Document {
  name: string;
  category: string;
  dateOfPurchase: Date;
  warrantyDetails: string;
  warrantyExpiryDate?: Date;
  billUrl?: string;
  billPublicId?: string;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    dateOfPurchase: { type: Date, required: true },
    warrantyDetails: { type: String, default: "" },
    warrantyExpiryDate: { type: Date },
    billUrl: { type: String },
    billPublicId: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AssetSchema.index({ name: "text", category: "text" });

const Asset: Model<IAsset> = models.Asset ?? mongoose.model<IAsset>("Asset", AssetSchema);
export default Asset;
