/**
 * Script nhập dữ liệu bảo hành test lên production warranty_db (MongoDB Atlas)
 * 
 * Chạy: node scripts/seed-warranty-data.js
 * 
 * Script này tạo các WarrantyRecord mẫu trong warranty_db của web bảo hành
 * để có thể test tra cứu trên production.
 */

import "dotenv/config";
import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://tienminhthuan333_db_user:3YcNXgYCQVx82jNq@cluster0.u438d2z.mongodb.net/warranty_db?retryWrites=true&w=majority&appName=Cluster0";

// ─── Inline schema (không import để script chạy độc lập) ──────────────────
const warrantyRecordSchema = new mongoose.Schema(
  {
    customerName: { type: String, default: "" },
    customerPhone: { type: String, required: true },
    customerPhoneNormalized: { type: String, required: true, index: true },
    mainAppProductId: { type: String, default: "" },
    productName: { type: String, required: true },
    variantSku: { type: String, default: "" },
    imei: { type: String, default: "" },
    imeiNormalized: { type: String },
    serialNumber: { type: String, default: "" },
    serialNumberNormalized: { type: String },
    lookupKeys: [{ type: String }],
    startDate: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    warrantyMonths: { type: Number, default: 12 },
    warrantyType: { type: String, default: "STORE" },
    status: { type: String, default: "ACTIVE" },
    warrantyTerms: { type: String, default: "" },
    quantity: { type: Number, default: 1 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const WarrantyRecord =
  mongoose.models.WarrantyRecord ||
  mongoose.model("WarrantyRecord", warrantyRecordSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────
const normalizePhone = (v) => String(v || "").replace(/\D+/g, "");
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

// ─── Data mẫu — thay bằng data thực của bạn ────────────────────────────────
// Đây là dữ liệu VÍ DỤ, bạn cần cập nhật với SĐT và sản phẩm thực tế
const WARRANTY_SEED_DATA = [
  {
    customerName: "Khách hàng test",
    customerPhone: "0848549959",
    productName: "iPhone 15 Pro Max 256GB Black Titanium",
    variantSku: "IP15PM-256-BLK",
    imei: "359876543210001",
    warrantyMonths: 12,
    startDate: new Date("2024-10-01"),
    notes: "Seed data for testing",
  },
  {
    customerName: "Khách hàng test",
    customerPhone: "0848549959",
    productName: "iPhone 14 128GB Midnight",
    variantSku: "IP14-128-MID",
    imei: "359876543210002",
    warrantyMonths: 12,
    startDate: new Date("2024-08-15"),
    notes: "Seed data for testing",
  },
  {
    customerName: "Khách hàng test",
    customerPhone: "0848549959",
    productName: "AirPods Pro 2nd Gen",
    variantSku: "APP-2ND-GEN",
    serialNumber: "H3YQKW1234",
    warrantyMonths: 12,
    startDate: new Date("2024-09-20"),
    notes: "Seed data for testing",
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🔌 Connecting to MongoDB Atlas warranty_db...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected!\n");

  let created = 0;
  let skipped = 0;

  for (const item of WARRANTY_SEED_DATA) {
    const phoneNorm = normalizePhone(item.customerPhone);
    const imeiNorm =
      item.imei && item.imei.replace(/\D/g, "").length === 15
        ? item.imei.replace(/\D/g, "")
        : "";
    const serialNorm = item.serialNumber
      ? item.serialNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
      : "";

    const lookupKeys = [];
    if (imeiNorm) lookupKeys.push(imeiNorm);
    if (serialNorm && serialNorm.length >= 6) lookupKeys.push(serialNorm);

    // Kiểm tra đã tồn tại chưa (theo phone + product name + startDate)
    const existing = await WarrantyRecord.findOne({
      customerPhoneNormalized: phoneNorm,
      productName: item.productName,
      startDate: item.startDate,
    });

    if (existing) {
      console.log(`⏭️  Skip (already exists): ${item.productName} - ${item.customerPhone}`);
      skipped++;
      continue;
    }

    const expiresAt = addMonths(item.startDate, item.warrantyMonths || 12);

    await WarrantyRecord.create({
      customerName: item.customerName || "",
      customerPhone: item.customerPhone,
      customerPhoneNormalized: phoneNorm,
      mainAppProductId: item.mainAppProductId || "",
      productName: item.productName,
      variantSku: item.variantSku || "",
      imei: item.imei || "",
      imeiNormalized: imeiNorm || undefined,
      serialNumber: item.serialNumber || "",
      serialNumberNormalized:
        serialNorm && serialNorm.length >= 6 ? serialNorm : undefined,
      lookupKeys,
      startDate: item.startDate,
      expiresAt,
      warrantyMonths: item.warrantyMonths || 12,
      warrantyType: "STORE",
      status: "ACTIVE",
      warrantyTerms: item.warrantyTerms || "",
      quantity: item.quantity || 1,
      notes: item.notes || "",
    });

    console.log(`✅ Created: ${item.productName} - ${item.customerPhone} (expires: ${expiresAt.toLocaleDateString("vi-VN")})`);
    created++;
  }

  console.log(`\n📊 Done! Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
