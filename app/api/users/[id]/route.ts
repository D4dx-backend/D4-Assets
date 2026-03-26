import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import User, { type UserRole } from "@/lib/models/User";
import { logActivity } from "@/lib/activityLogger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/users/[id]
export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    role?: UserRole;
    isActive?: boolean;
    mpin?: string;
    permissions?: Record<string, boolean>;
  };

  await connectDB();
  const user = await User.findById(id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (body.name) user.name = body.name;
  if (body.role) user.role = body.role;
  if (typeof body.isActive === "boolean") user.isActive = body.isActive;
  if (body.mpin) {
    if (!/^\d{4,6}$/.test(body.mpin)) {
      return NextResponse.json({ error: "MPIN must be 4–6 digits" }, { status: 400 });
    }
    user.mpin = body.mpin;
  }
  if (body.permissions) user.permissions = body.permissions as unknown as typeof user.permissions;

  await user.save();
  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "UPDATE",
    module: "Users",
    resourceId: id,
    details: `Updated user ${user.email}`,
  });

  return NextResponse.json({ success: true, data: user });
}

// DELETE /api/users/[id]
export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "DELETE",
    module: "Users",
    resourceId: id,
    details: `Deactivated user ${user.email}`,
  });

  return NextResponse.json({ success: true });
}
