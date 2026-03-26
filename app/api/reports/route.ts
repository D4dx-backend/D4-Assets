import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Movement from "@/lib/models/Movement";
import DamageReport from "@/lib/models/DamageReport";
import ActivityLog from "@/lib/models/ActivityLog";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "movement";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  await connectDB();

  if (type === "damage") {
    const query: Record<string, unknown> = {};
    if (from || to) {
      query.createdAt = {
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(to) }),
      };
    }

    const reports = await DamageReport.find(query)
      .populate("asset", "name category")
      .populate("event", "name location")
      .populate("movement", "outDate inDate returnBy verifiedBy")
      .populate("reportedBy", "name")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: reports });
  }

  if (type === "activity") {
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const logs = await ActivityLog.find({})
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return NextResponse.json({ success: true, data: logs });
  }

  // Default: movement report
  const query: Record<string, unknown> = {};
  if (from || to) {
    query.outDate = {
      ...(from && { $gte: new Date(from) }),
      ...(to && { $lte: new Date(to) }),
    };
  }

  const movements = await Movement.find(query)
    .populate("asset", "name category")
    .populate("event", "name location fromDate toDate")
    .populate("allocatedPerson", "name")
    .populate("outBy", "name")
    .sort({ outDate: -1 })
    .lean();

  return NextResponse.json({ success: true, data: movements });
}
