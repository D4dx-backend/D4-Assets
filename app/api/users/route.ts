import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import User, { defaultPermissions, type UserRole } from "@/lib/models/User";
import { logActivity } from "@/lib/activityLogger";

// GET /api/users – admin only
export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  await connectDB();
  const [users, total] = await Promise.all([
    User.find({}).select("-mpin").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments({}),
  ]);

  return NextResponse.json({
    success: true,
    data: users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
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
