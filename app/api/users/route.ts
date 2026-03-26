import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import User, { defaultPermissions, type UserRole } from "@/lib/models/User";
import { logActivity } from "@/lib/activityLogger";

// GET /api/users – admin only
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await connectDB();
  const users = await User.find({}).select("-mpin").lean();
  return NextResponse.json({ success: true, data: users });
}

// POST /api/users – admin only
export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json() as {
    name: string;
    email: string;
    mpin: string;
    role?: UserRole;
    permissions?: Record<string, boolean>;
  };
  const { name, email, mpin, role = "operator" } = body;

  if (!name || !email || !mpin) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!/^\d{4,6}$/.test(mpin)) {
    return NextResponse.json({ error: "MPIN must be 4–6 digits" }, { status: 400 });
  }

  await connectDB();

  const exists = await User.findOne({ email });
  if (exists) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const permissions = body.permissions ?? defaultPermissions(role);
  const user = await User.create({ name, email, mpin, role, permissions });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "CREATE",
    module: "Users",
    resourceId: user._id.toString(),
    details: `Created user ${email} with role ${role}`,
  });

  return NextResponse.json({ success: true, data: user }, { status: 201 });
}
