import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Person from "@/lib/models/Person";
import { logActivity } from "@/lib/activityLogger";
import mongoose from "mongoose";

const SYSTEM_ADMIN_OID = new mongoose.Types.ObjectId("000000000000000000000000");
function resolveOid(id: string) {
  return mongoose.isValidObjectId(id) ? id : SYSTEM_ADMIN_OID;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim().slice(0, 100);
  const all = searchParams.get("all") === "true"; // for dropdown usage
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  await connectDB();

  const query: Record<string, unknown> = { isActive: true };
  if (search) query.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  if (all) {
    const persons = await Person.find(query).select("name phone email department").sort({ name: 1 }).lean();
    return NextResponse.json({ success: true, data: persons });
  }

  const skip = (page - 1) * limit;
  const [persons, total] = await Promise.all([
    Person.find(query).select("name phone email department").sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Person.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    data: persons,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { name: string; phone?: string; email?: string; department?: string };
  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    await connectDB();
    const person = await Person.create({ ...body, createdBy: resolveOid(session.user.id) });

    await logActivity({
      userId: session.user.id,
      userName: session.user.name,
      action: "CREATE",
      module: "Persons",
      resourceId: person._id.toString(),
      details: `Created person: ${body.name}`,
    });

    return NextResponse.json({ success: true, data: person }, { status: 201 });
  } catch (err) {
    console.error("POST /api/persons error:", err);
    return NextResponse.json({ error: "Failed to create person" }, { status: 500 });
  }
}
