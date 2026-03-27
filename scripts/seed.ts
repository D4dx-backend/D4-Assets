/**
 * Run with: npx tsx scripts/seed.ts
 * Creates the initial admin user if one doesn't exist yet.
 * Reads credentials from .env.local:
 *   ADMIN_EMAIL (default: admin@example.com)
 *   ADMIN_MPIN  (default: 123456)
 */
import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  mpin: String,
  role: { type: String, default: "operator" },
  permissions: {
    assets: { type: Boolean, default: true },
    events: { type: Boolean, default: true },
    movements: { type: Boolean, default: true },
    persons: { type: Boolean, default: true },
    reports: { type: Boolean, default: true },
    categories: { type: Boolean, default: true },
    users: { type: Boolean, default: true },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

import bcrypt from "bcryptjs";

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env.local");

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminMpin  = process.env.ADMIN_MPIN  ?? "123456";

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const User = mongoose.models.User ?? mongoose.model("User", UserSchema);

  const hashedMpin = await bcrypt.hash(adminMpin, 12);

  const existing = await User.findOne({ email: adminEmail });
  if (existing) {
    await User.updateOne(
      { email: adminEmail },
      { $set: { mpin: hashedMpin, role: "admin", isActive: true } }
    );
    console.log(`✅ Admin user MPIN reset: ${adminEmail}  MPIN: ${adminMpin}`);
    await mongoose.disconnect();
    return;
  }

  await User.create({
    name: "System Admin",
    email: adminEmail,
    mpin: hashedMpin,
    role: "admin",
    permissions: {
      assets: true, events: true, movements: true,
      persons: true, reports: true, categories: true, users: true,
    },
  });

  console.log(`✅ Admin user created: ${adminEmail}  MPIN: ${adminMpin}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
