import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Event from "@/lib/models/Event";
import { logActivity } from "@/lib/activityLogger";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  await connectDB();
  const query: Record<string, unknown> = { isActive: true };
  if (status) query.status = status;

  const events = await Event.find(query)
    .populate("responsiblePerson", "name")
    .populate("createdBy", "name email")
    .sort({ fromDate: -1 })
    .lean();

  return NextResponse.json({ success: true, data: events });
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

  await connectDB();
  const event = await Event.create({
    name,
    location,
    fromDate: new Date(fromDate),
    toDate: new Date(toDate),
    responsiblePerson,
    status: body.status ?? "upcoming",
    createdBy: session.user.id,
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
}
