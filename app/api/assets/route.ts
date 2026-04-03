import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Asset from "@/lib/models/Asset";
import { logActivity } from "@/lib/activityLogger";
import mongoose from "mongoose";

// GET /api/assets
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim().slice(0, 100);
  const category = (searchParams.get("category") ?? "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  await connectDB();

  const query: Record<string, unknown> = { isActive: true };
  if (search) query.$text = { $search: search };
  if (category) query.category = category;

  const [assets, total] = await Promise.all([
    Asset.find(query)
      .select("name productCode category dateOfPurchase noWarranty warrantyDetails warrantyExpiryDate billUrl allowOutside createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Asset.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    data: assets,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/assets
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name: string;
    productCode?: string;
    category: string;
    dateOfPurchase: string;
    noWarranty?: boolean;
    warrantyDetails?: string;
    warrantyExpiryDate?: string;
    billUrl?: string;
    billPublicId?: string;
    allowOutside?: boolean;
  };

  const { name, productCode, category, dateOfPurchase, noWarranty, warrantyDetails, warrantyExpiryDate, billUrl, billPublicId, allowOutside } = body;

  if (!name || !category || !dateOfPurchase) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Map non-ObjectId ids (e.g. env-admin sentinel) to a valid ObjectId placeholder
  const SYSTEM_ADMIN_OID = new mongoose.Types.ObjectId("000000000000000000000000");
  const createdBy = mongoose.isValidObjectId(session.user.id)
    ? session.user.id
    : SYSTEM_ADMIN_OID;

  try {
    await connectDB();

    const asset = await Asset.create({
      name,
      productCode: productCode?.trim() || undefined,
      category,
      dateOfPurchase: new Date(dateOfPurchase),
      noWarranty: noWarranty ?? false,
      warrantyDetails: noWarranty ? "" : (warrantyDetails ?? ""),
      warrantyExpiryDate: noWarranty ? undefined : (warrantyExpiryDate ? new Date(warrantyExpiryDate) : undefined),
      billUrl,
      billPublicId,
      allowOutside: allowOutside ?? false,
      createdBy,
    });

    await logActivity({
      userId: session.user.id,
      userName: session.user.name,
      action: "CREATE",
      module: "Assets",
      resourceId: asset._id.toString(),
      details: `Created asset: ${name}`,
    });

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (err) {
    console.error("POST /api/assets error:", err);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}
