import mongoose, { Schema, Document, Model, models } from "mongoose";

export interface IPerson extends Document {
  name: string;
  phone?: string;
  email?: string;
  department?: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PersonSchema = new Schema<IPerson>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    department: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

PersonSchema.index({ isActive: 1, name: 1 });

const Person: Model<IPerson> = models.Person ?? mongoose.model<IPerson>("Person", PersonSchema);
export default Person;
