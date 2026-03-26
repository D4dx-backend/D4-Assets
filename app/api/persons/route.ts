import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Person from "@/lib/models/Person";
import { logActivity } from "@/lib/activityLogger";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const persons = await Person.find({ isActive: true }).sort({ name: 1 }).lean();
  return NextResponse.json({ success: true, data: persons });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { name: string; phone?: string; email?: string; department?: string };
  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  await connectDB();
  const person = await Person.create({ ...body, createdBy: session.user.id });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "CREATE",
    module: "Persons",
    resourceId: person._id.toString(),
    details: `Created person: ${body.name}`,
  });

  return NextResponse.json({ success: true, data: person }, { status: 201 });
}
