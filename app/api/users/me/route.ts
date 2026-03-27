import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { logActivity } from "@/lib/activityLogger";

/**
 * PATCH /api/users/me
 * Allows any authenticated user to update their own name.
 * Body: { name: string }
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { name?: string };
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  user.name = name.trim();
  await user.save();

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "UPDATE",
    module: "Settings",
    resourceId: session.user.id,
    details: "Updated own display name",
  });

  return NextResponse.json({ success: true });
}
