/**
 * Script tạo dữ liệu demo cho 2 khách hàng:
 *   - Nguyễn Văn A  | 0868016351
 *   - Nguyễn Văn B  | 0915015015
 *
 * Mỗi khách có 5 sản phẩm, đầy đủ tất cả trạng thái bảo hành:
 *   ACTIVE, EXPIRED, VOID, REPLACED
 *
 * Chạy: node scripts/seed-demo-customers.js
 */

import "dotenv/config";
import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://tienminhthuan333_db_user:3YcNXgYCQVx82jNq@cluster0.u438d2z.mongodb.net/warranty_db?retryWrites=true&w=majority&appName=Cluster0";

// ─── Inline schema (chạy độc lập không cần import) ────────────────────────
const warrantyRecordSchema = new mongoose.Schema(
  {
    customerName:             { type: String, default: "" },
    customerPhone:            { type: String, required: true },
    customerPhoneNormalized:  { type: String, required: true, index: true },
    mainAppProductId:         { type: String, default: "" },
    productName:              { type: String, required: true },
    variantSku:               { type: String, default: "" },
    imei:                     { type: String, default: "" },
    imeiNormalized:           { type: String },
    serialNumber:             { type: String, default: "" },
    serialNumberNormalized:   { type: String },
    lookupKeys:               [{ type: String }],
    startDate:                { type: Date, required: true },
    expiresAt:                { type: Date, required: true },
    warrantyMonths:           { type: Number, default: 12 },
    warrantyType:             { type: String, default: "STORE" },
    status:                   { type: String, default: "ACTIVE" },
    warrantyTerms:            { type: String, default: "" },
    quantity:                 { type: Number, default: 1 },
    notes:                    { type: String, default: "" },
  },
  { timestamps: true }
);

const WarrantyRecord =
  mongoose.models.WarrantyRecord ||
  mongoose.model("WarrantyRecord", warrantyRecordSchema);

// ─── Helpers ───────────────────────────────────────────────────────────────
const normalizePhone = (v) => String(v || "").replace(/\D+/g, "");
const normalizeImei  = (v) => {
  const d = String(v || "").replace(/\D+/g, "");
  return d.length === 15 ? d : "";
};
const normalizeSerial = (v) => {
  const c = String(v || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return c.length >= 6 ? c : "";
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

// ─── Dữ liệu seed ─────────────────────────────────────────────────────────
/**
 * 4 trạng thái được cấu hình trong hệ thống:
 *   ACTIVE   — Còn hiệu lực
 *   EXPIRED  — Đã hết hạn (lưu DB = ACTIVE nhưng expiresAt < now, hệ thống tự resolve)
 *              Hoặc lưu thẳng status = EXPIRED
 *   VOID     — Đã huỷ / không hợp lệ
 *   REPLACED — Đã đổi máy / thay thế
 */
const SEED_DATA = [
  // ══════════════════════════════════════════════════
  // KHÁCH HÀNG 1: Nguyễn Văn A — 0868016351
  // ══════════════════════════════════════════════════

  // 1. ACTIVE — Còn hạn bảo hành
  {
    customerName:  "Nguyễn Văn A",
    customerPhone: "0868016351",
    productName:   "iPhone 15 Pro Max 256GB Black Titanium",
    variantSku:    "IP15PM-256-BTI",
    imei:          "351234567890001",
    warrantyMonths: 12,
    status:        "ACTIVE",
    startDate:     new Date("2025-06-01"),   // còn ~2 tháng
    warrantyType:  "STORE",
    warrantyTerms: "Bảo hành 12 tháng tại cửa hàng. Không áp dụng cho lỗi do va đập, nước vào máy.",
    notes:         "Khách mua máy mới, tặng kèm sạc MagSafe.",
  },

  // 2. ACTIVE — Còn hạn (sản phẩm phụ kiện)
  {
    customerName:  "Nguyễn Văn A",
    customerPhone: "0868016351",
    productName:   "Apple Watch Series 9 GPS 45mm Midnight",
    variantSku:    "AWS9-45-MID",
    serialNumber:  "F2LXK97AQWY1",
    warrantyMonths: 12,
    status:        "ACTIVE",
    startDate:     new Date("2025-10-15"),   // còn ~6 tháng
    warrantyType:  "STORE",
    warrantyTerms: "Bảo hành 12 tháng. Màn hình & pin bảo hành riêng 6 tháng.",
    notes:         "Khách mua kèm dây thay thế màu Green.",
  },

  // 3. EXPIRED — Đã hết hạn bảo hành (lưu status = EXPIRED)
  {
    customerName:  "Nguyễn Văn A",
    customerPhone: "0868016351",
    productName:   "iPad Pro M2 11-inch WiFi 256GB Space Gray",
    variantSku:    "IPADPRO-M2-11-256-SG",
    serialNumber:  "DLXF21BAWQ8H",
    warrantyMonths: 12,
    status:        "EXPIRED",
    startDate:     new Date("2024-01-10"),   // đã qua > 12 tháng
    warrantyType:  "STORE",
    warrantyTerms: "Bảo hành 12 tháng. Linh kiện thay thế bảo hành thêm 3 tháng.",
    notes:         "Đã hết hạn bảo hành ngày 10/01/2025.",
  },

  // 4. VOID — Bảo hành bị huỷ (khách tự ý sửa ngoài)
  {
    customerName:  "Nguyễn Văn A",
    customerPhone: "0868016351",
    productName:   "MacBook Air M2 8GB 256GB Starlight",
    variantSku:    "MBA-M2-8-256-STL",
    serialNumber:  "C02GT2Q2MD6N",
    warrantyMonths: 12,
    status:        "VOID",
    startDate:     new Date("2024-09-20"),
    warrantyType:  "STORE",
    warrantyTerms: "Bảo hành 12 tháng. Tem bảo hành bị bóc = mất bảo hành.",
    notes:         "Phát hiện tem bảo hành bị bóc — huỷ bảo hành theo quy định.",
  },

  // 5. REPLACED — Đã đổi máy mới
  {
    customerName:  "Nguyễn Văn A",
    customerPhone: "0868016351",
    productName:   "AirPods Pro 2nd Generation (USB-C)",
    variantSku:    "APP2-USBC",
    serialNumber:  "H9FQRW4XP2M3",
    warrantyMonths: 12,
    status:        "REPLACED",
    startDate:     new Date("2024-11-05"),
    warrantyType:  "STORE",
    warrantyTerms: "Bảo hành 12 tháng, lỗi phần cứng đổi mới trong 30 ngày đầu.",
    notes:         "Máy lỗi micro sau 2 tuần, đã đổi máy mới ngày 20/11/2024.",
  },

  // ══════════════════════════════════════════════════
  // KHÁCH HÀNG 2: Nguyễn Văn B — 0915015015
  // ══════════════════════════════════════════════════

  // 1. ACTIVE — Còn hạn bảo hành
  {
    customerName:  "Nguyễn Văn B",
    customerPhone: "0915015015",
    productName:   "Samsung Galaxy S24 Ultra 512GB Titanium Black",
    variantSku:    "SGS24U-512-TBLK",
    imei:          "351234567890011",
    warrantyMonths: 12,
    status:        "ACTIVE",
    startDate:     new Date("2025-08-20"),   // còn ~4 tháng
    warrantyType:  "STORE",
    warrantyTerms: "Bảo hành 12 tháng tại trung tâm bảo hành Samsung uỷ quyền.",
    notes:         "Khách mua kèm bộ phụ kiện S-Pen chính hãng.",
  },

  // 2. ACTIVE — Laptop còn trong hạn
  {
    customerName:  "Nguyễn Văn B",
    customerPhone: "0915015015",
    productName:   "Laptop ASUS ROG Strix G16 RTX 4070 16GB",
    variantSku:    "ROG-G16-4070-16G",
    serialNumber:  "K7R2NX91ASZP",
    warrantyMonths: 24,
    status:        "ACTIVE",
    startDate:     new Date("2025-03-01"),   // còn ~11 tháng (24 tháng)
    warrantyType:  "MANUFACTURER",
    warrantyTerms: "Bảo hành 24 tháng hãng ASUS. Hỗ trợ onsite tại nhà năm đầu.",
    notes:         "Sản phẩm bảo hành chính hãng ASUS 2 năm.",
  },

  // 3. EXPIRED — Đã hết hạn
  {
    customerName:  "Nguyễn Văn B",
    customerPhone: "0915015015",
    productName:   "Sony WH-1000XM5 Wireless Headphones Black",
    variantSku:    "WH1000XM5-BLK",
    serialNumber:  "4519756T0GH3",
    warrantyMonths: 12,
    status:        "EXPIRED",
    startDate:     new Date("2023-12-25"),   // đã qua > 12 tháng
    warrantyType:  "STORE",
    warrantyTerms: "Bảo hành 12 tháng lỗi phần cứng. Không bảo hành hư hỏng vật lý.",
    notes:         "Đã hết hạn bảo hành ngày 25/12/2024.",
  },

  // 4. VOID — Bị huỷ do ngập nước
  {
    customerName:  "Nguyễn Văn B",
    customerPhone: "0915015015",
    productName:   "iPad Air M1 WiFi 64GB Blue",
    variantSku:    "IPADAIR-M1-64-BLU",
    serialNumber:  "DMQXF87GBAP5",
    warrantyMonths: 12,
    status:        "VOID",
    startDate:     new Date("2025-01-15"),
    warrantyType:  "APPLE",
    warrantyTerms: "Bảo hành Apple 1 năm. Không bảo hành lỗi do chất lỏng.",
    notes:         "Máy bị vào nước, kiểm tra indicator chất lỏng đã đổi màu — huỷ bảo hành.",
  },

  // 5. REPLACED — Đã đổi máy
  {
    customerName:  "Nguyễn Văn B",
    customerPhone: "0915015015",
    productName:   "iPhone 14 128GB Midnight",
    variantSku:    "IP14-128-MID",
    imei:          "351234567890022",
    warrantyMonths: 12,
    status:        "REPLACED",
    startDate:     new Date("2024-07-10"),
    warrantyType:  "STORE",
    warrantyTerms: "Bảo hành 12 tháng tại cửa hàng. Đổi mới trong 30 ngày nếu lỗi phần cứng.",
    notes:         "Lỗi màn hình chớp nháy sau 3 tuần, đã đổi máy mới ngày 01/08/2024.",
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🔌 Connecting to MongoDB Atlas warranty_db...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected!\n");

  let created = 0;
  let skipped = 0;

  for (const item of SEED_DATA) {
    const phoneNorm  = normalizePhone(item.customerPhone);
    const imeiNorm   = item.imei   ? normalizeImei(item.imei)       : "";
    const serialNorm = item.serialNumber ? normalizeSerial(item.serialNumber) : "";

    const lookupKeys = [];
    if (imeiNorm)                    lookupKeys.push(imeiNorm);
    if (serialNorm && serialNorm.length >= 6) lookupKeys.push(serialNorm);

    // Kiểm tra đã tồn tại chưa (phone + productName + startDate)
    const existing = await WarrantyRecord.findOne({
      customerPhoneNormalized: phoneNorm,
      productName:             item.productName,
      startDate:               item.startDate,
    });

    if (existing) {
      console.log(`⏭️  Đã tồn tại: ${item.productName} (${item.customerPhone})`);
      skipped++;
      continue;
    }

    // Tính ngày hết hạn (dùng startDate + warrantyMonths)
    const expiresAt = addMonths(item.startDate, item.warrantyMonths || 12);

    await WarrantyRecord.create({
      customerName:           item.customerName || "",
      customerPhone:          item.customerPhone,
      customerPhoneNormalized: phoneNorm,
      mainAppProductId:       item.mainAppProductId || "",
      productName:            item.productName,
      variantSku:             item.variantSku || "",
      imei:                   item.imei || "",
      imeiNormalized:         imeiNorm || undefined,
      serialNumber:           item.serialNumber || "",
      serialNumberNormalized: serialNorm && serialNorm.length >= 6 ? serialNorm : undefined,
      lookupKeys,
      startDate:              item.startDate,
      expiresAt,
      warrantyMonths:         item.warrantyMonths || 12,
      warrantyType:           item.warrantyType || "STORE",
      status:                 item.status || "ACTIVE",
      warrantyTerms:          item.warrantyTerms || "",
      quantity:               item.quantity || 1,
      notes:                  item.notes || "",
    });

    const expStr = expiresAt.toLocaleDateString("vi-VN");
    console.log(`✅ ${item.status.padEnd(8)} | ${item.customerName} (${item.customerPhone}) | ${item.productName} — hết hạn: ${expStr}`);
    created++;
  }

  console.log(`\n📊 Hoàn thành! Đã tạo: ${created}, Bỏ qua (đã tồn tại): ${skipped}`);
  console.log("\n📋 Tóm tắt:");
  console.log("  🔵 Nguyễn Văn A — 0868016351: 5 sản phẩm (ACTIVE x2, EXPIRED, VOID, REPLACED)");
  console.log("  🟢 Nguyễn Văn B — 0915015015: 5 sản phẩm (ACTIVE x2, EXPIRED, VOID, REPLACED)");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Seed thất bại:", err);
  process.exit(1);
});
