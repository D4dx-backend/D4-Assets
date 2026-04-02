import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Movement from "@/lib/models/Movement";
import DamageReport from "@/lib/models/DamageReport";
import ActivityLog from "@/lib/models/ActivityLog";
import Asset from "@/lib/models/Asset";
// These imports ensure Mongoose registers the schemas used in populate()
import "@/lib/models/Event";
import "@/lib/models/Person";
import "@/lib/models/User";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "movement";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const assetName = (searchParams.get("assetName") ?? "").trim().slice(0, 100);
  const status = searchParams.get("status");
  const search = (searchParams.get("search") ?? "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const skip = (page - 1) * limit;

  await connectDB();

  if (type === "damage") {
    const query: Record<string, unknown> = {};
    if (from || to) {
      query.createdAt = {
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(new Date(to).setHours(23, 59, 59, 999)) }),
      };
    }
    if (assetName) {
      const assets = await Asset.find({ name: { $regex: assetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }).select("_id").lean();
      query.asset = { $in: assets.map((a) => a._id) };
    }

    const [reports, total] = await Promise.all([
      DamageReport.find(query)
        .populate("asset", "name category")
        .populate("event", "name location")
        .populate("movement", "outDate inDate returnBy verifiedBy")
        .populate("reportedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DamageReport.countDocuments(query),
    ]);

    return NextResponse.json({ success: true, data: reports, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  if (type === "activity") {
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const actQuery: Record<string, unknown> = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      actQuery.$or = [
        { userName: { $regex: escaped, $options: "i" } },
        { action: { $regex: escaped, $options: "i" } },
        { module: { $regex: escaped, $options: "i" } },
        { details: { $regex: escaped, $options: "i" } },
      ];
    }
    if (from || to) {
      actQuery.createdAt = {
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(new Date(to).setHours(23, 59, 59, 999)) }),
      };
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(actQuery)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(actQuery),
    ]);

    return NextResponse.json({ success: true, data: logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }

  // Default: movement report
  const query: Record<string, unknown> = {};
  if (from || to) {
    query.outDate = {
      ...(from && { $gte: new Date(from) }),
      ...(to && { $lte: new Date(new Date(to).setHours(23, 59, 59, 999)) }),
    };
  }
  if (status) query.status = status;

  if (assetName) {
    const assets = await Asset.find({ name: { $regex: assetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }).select("_id").lean();
    query.asset = { $in: assets.map((a) => a._id) };
  }

  if (search) {
    // Server-side text search across related fields via $lookup + $match
    // Simpler: match on the populated fields we have — use aggregation for exact server-side search
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchingAssets = await Asset.find({ name: { $regex: escaped, $options: "i" } }).select("_id").lean();
    if (matchingAssets.length) {
      query.asset = { $in: matchingAssets.map((a) => a._id) };
    }
  }

  const [movements, total] = await Promise.all([
    Movement.find(query)
      .populate("asset", "name category")
      .populate("event", "name location fromDate toDate")
      .populate("allocatedPerson", "name")
      .populate("outBy", "name")
      .sort({ outDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Movement.countDocuments(query),
  ]);

  return NextResponse.json({ success: true, data: movements, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}
