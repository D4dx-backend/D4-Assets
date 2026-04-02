import mongoose, { Schema, Document, Model, models } from "mongoose";

export interface IEvent extends Document {
  name: string;
  location: string;
  fromDate: Date;
  toDate: Date;
  responsiblePerson: mongoose.Types.ObjectId;
  status: "upcoming" | "active" | "completed";
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    responsiblePerson: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    status: { type: String, enum: ["upcoming", "active", "completed"], default: "upcoming" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EventSchema.index({ isActive: 1, status: 1, fromDate: -1 });
EventSchema.index({ name: "text", location: "text" });

const Event: Model<IEvent> = models.Event ?? mongoose.model<IEvent>("Event", EventSchema);
export default Event;
