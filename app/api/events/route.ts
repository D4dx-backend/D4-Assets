import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Event from "@/lib/models/Event";
import Movement from "@/lib/models/Movement";
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
  const status = searchParams.get("status");
  const search = (searchParams.get("search") ?? "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  await connectDB();
  const query: Record<string, unknown> = { isActive: true };
  if (status) query.status = status;
  if (search) query.$text = { $search: search };

  const [events, total] = await Promise.all([
    Event.find(query)
      .select("name location fromDate toDate status responsiblePerson createdAt")
      .populate("responsiblePerson", "name")
      .sort({ fromDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Event.countDocuments(query),
  ]);

  const movementCounts = await Movement.aggregate([
    { $match: { event: { $in: events.map((ev) => ev._id) } } },
    {
      $group: {
        _id: "$event",
        outCount: { $sum: { $cond: [{ $eq: ["$status", "OUT"] }, 1, 0] } },
        inCount: { $sum: { $cond: [{ $eq: ["$status", "IN"] }, 1, 0] } },
      },
    },
  ]);

  const countMap = new Map(
    movementCounts.map((c) => [c._id.toString(), { outCount: c.outCount, inCount: c.inCount }])
  );

  const data = events.map((ev) => {
    const counts = countMap.get((ev._id as { toString(): string }).toString());
    return {
      ...ev,
      outCount: counts?.outCount ?? 0,
      inCount: counts?.inCount ?? 0,
      totalAssets: (counts?.outCount ?? 0) + (counts?.inCount ?? 0),
    };
  });

  return NextResponse.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name: string;
    location: string;
    fromDate: string;
    toDate: string;
    responsiblePerson: string;
    status?: string;
  };

  const { name, location, fromDate, toDate, responsiblePerson } = body;
  if (!name || !location || !fromDate || !toDate || !responsiblePerson) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    await connectDB();
    const event = await Event.create({
      name,
      location,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      responsiblePerson,
      status: body.status ?? "upcoming",
      createdBy: resolveOid(session.user.id),
    });

    await logActivity({
      userId: session.user.id,
      userName: session.user.name,
      action: "CREATE",
      module: "Events",
      resourceId: event._id.toString(),
      details: `Created event: ${name}`,
    });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (err) {
    console.error("POST /api/events error:", err);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
