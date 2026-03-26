import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User, { defaultPermissions } from "@/lib/models/User";

/**
 * POST /api/auth/signup
 * Public endpoint — creates a new user account with operator role.
 * Admin can later upgrade the role from the Users page.
 * Body: { name: string; email: string; mpin: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as { name?: string; email?: string; mpin?: string };
    const { name, email, mpin } = body;

    if (!name?.trim() || !email?.trim() || !mpin) {
      return NextResponse.json({ error: "Name, email and MPIN are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (!/^\d{4,6}$/.test(mpin)) {
      return NextResponse.json({ error: "MPIN must be 4–6 digits" }, { status: 400 });
    }

    await connectDB();

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      mpin,
      role: "operator",
      permissions: defaultPermissions("operator"),
      isActive: true,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
