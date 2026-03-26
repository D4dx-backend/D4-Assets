import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Category from "@/lib/models/Category";
import { logActivity } from "@/lib/activityLogger";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
  return NextResponse.json({ success: true, data: categories });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json() as { name: string; description?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  await connectDB();

  const exists = await Category.findOne({ name: { $regex: `^${body.name.trim()}$`, $options: "i" } });
  if (exists) return NextResponse.json({ error: "Category already exists" }, { status: 409 });

  const category = await Category.create({
    name: body.name.trim(),
    description: body.description,
    createdBy: session.user.id,
  });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "CREATE",
    module: "Categories",
    resourceId: category._id.toString(),
    details: `Created category: ${body.name}`,
  });

  return NextResponse.json({ success: true, data: category }, { status: 201 });
}
