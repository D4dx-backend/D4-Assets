import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Category from "@/lib/models/Category";
import { logActivity } from "@/lib/activityLogger";
import mongoose from "mongoose";

const SYSTEM_ADMIN_OID = new mongoose.Types.ObjectId("000000000000000000000000");
function resolveOid(id: string) {
  return mongoose.isValidObjectId(id) ? id : SYSTEM_ADMIN_OID;
}

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

  const exists = await Category.findOne({ name: { $regex: `^${body.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
  if (exists) return NextResponse.json({ error: "Category already exists" }, { status: 409 });

  try {
    const category = await Category.create({
      name: body.name.trim(),
      description: body.description,
      createdBy: resolveOid(session.user.id),
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
  } catch (err) {
    console.error("POST /api/categories error:", err);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
