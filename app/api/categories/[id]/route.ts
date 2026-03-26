import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Category from "@/lib/models/Category";
import { logActivity } from "@/lib/activityLogger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { name?: string; description?: string };

  await connectDB();
  const category = await Category.findByIdAndUpdate(id, body, { new: true });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "UPDATE",
    module: "Categories",
    resourceId: id,
    details: `Updated category: ${category.name}`,
  });

  return NextResponse.json({ success: true, data: category });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();
  const category = await Category.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "DELETE",
    module: "Categories",
    resourceId: id,
    details: `Deleted category: ${category.name}`,
  });

  return NextResponse.json({ success: true });
}
