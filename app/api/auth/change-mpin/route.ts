import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { logActivity } from "@/lib/activityLogger";

/**
 * POST /api/auth/change-mpin
 * Body: { currentMpin: string; newMpin: string }
 * Verifies the current MPIN then hashes and saves the new one.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { currentMpin: string; newMpin: string };
  const { currentMpin, newMpin } = body;

  if (!currentMpin || !newMpin) {
    return NextResponse.json({ error: "Both current and new MPIN are required" }, { status: 400 });
  }
  if (!/^\d{4,6}$/.test(newMpin)) {
    return NextResponse.json({ error: "New MPIN must be 4–6 digits" }, { status: 400 });
  }

  await connectDB();

  const user = await User.findById(session.user.id).select("+mpin");
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isValid = await user.compareMpin(currentMpin);
  if (!isValid) {
    return NextResponse.json({ error: "Current MPIN is incorrect" }, { status: 403 });
  }

  user.mpin = newMpin; // pre-save hook will hash it
  await user.save();

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "UPDATE",
    module: "Settings",
    resourceId: session.user.id,
    details: "Changed own MPIN",
  });

  return NextResponse.json({ success: true });
}
