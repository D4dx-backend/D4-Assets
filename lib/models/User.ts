import mongoose, { Schema, Document, Model, models } from "mongoose";
import bcrypt from "bcryptjs";

// Granular module permissions
export interface IPermissions {
  assets: boolean;
  events: boolean;
  movements: boolean;
  persons: boolean;
  reports: boolean;
  categories: boolean;
  users: boolean;
}

export type UserRole = "admin" | "manager" | "operator" | "viewer";

export interface IUser extends Document {
  name: string;
  email: string;
  mpin: string;           // hashed 4-6 digit PIN
  role: UserRole;
  permissions: IPermissions;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  compareMpin(candidate: string): Promise<boolean>;
}

const defaultPermissions = (role: UserRole): IPermissions => {
  if (role === "admin" || role === "manager") {
    return { assets: true, events: true, movements: true, persons: true, reports: true, categories: true, users: role === "admin" };
  }
  if (role === "operator") {
    return { assets: true, events: true, movements: true, persons: true, reports: false, categories: false, users: false };
  }
  // viewer
  return { assets: true, events: true, movements: false, persons: false, reports: true, categories: false, users: false };
};

const PermissionsSchema = new Schema<IPermissions>({
  assets: { type: Boolean, default: true },
  events: { type: Boolean, default: true },
  movements: { type: Boolean, default: false },
  persons: { type: Boolean, default: false },
  reports: { type: Boolean, default: false },
  categories: { type: Boolean, default: false },
  users: { type: Boolean, default: false },
}, { _id: false });

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mpin: { type: String, required: true, minlength: 4 },
    role: { type: String, enum: ["admin", "manager", "operator", "viewer"], default: "operator" },
    permissions: { type: PermissionsSchema, default: () => defaultPermissions("operator") },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(UserSchema as any).pre("save", async function (this: IUser, next: () => void) {
  if (!this.isModified("mpin")) return next();
  this.mpin = await bcrypt.hash(this.mpin, 12);
  next();
});

UserSchema.methods.compareMpin = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.mpin as string);
};

export { defaultPermissions };

// Prevent leaking mpin in JSON responses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
UserSchema.set("toJSON", {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(_doc: any, ret: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    delete ret.mpin;
    return ret;
  },
});

const User: Model<IUser> = models.User ?? mongoose.model<IUser>("User", UserSchema);
export default User;
