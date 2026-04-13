/**
 * sync-warranties.js
 * Đồng bộ WarrantyRecord từ DB của web chính (Store) sang warranty_db của web bảo hành.
 *
 * Cách chạy:
 *   node scripts/sync-warranties.js
 *
 * Script sẽ:
 *   1. Kết nối tới MongoDB Atlas cluster (dùng thông tin kết nối của Store)
 *   2. Tìm tất cả database có collection "warrantyrecords"
 *   3. Copy toàn bộ WarrantyRecord sang warranty_db
 *   4. Transform field names để phù hợp schema của web bảo hành
 */

import { MongoClient } from "mongodb";

// ─── Cấu hình kết nối ──────────────────────────────────────────────────────
// URI của cloud cluster (dùng chung cả Store và warranty web)
const CLUSTER_URI =
  process.env.STORE_MONGODB_URI ||
  "mongodb+srv://tienminhthuan333_db_user:3YcNXgYCQVx82jNq@cluster0.u438d2z.mongodb.net/?appName=Cluster0";

const WARRANTY_DB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://tienminhthuan333_db_user:3YcNXgYCQVx82jNq@cluster0.u438d2z.mongodb.net/warranty_db?retryWrites=true&w=majority&appName=Cluster0";

// Lọc theo SĐT cụ thể — để trống để sync tất cả
const PHONE_FILTER = process.env.PHONE_FILTER || "";

// ─── Main ──────────────────────────────────────────────────────────────────
async function run() {
  const clusterClient = new MongoClient(CLUSTER_URI);
  const warrantyClient = new MongoClient(WARRANTY_DB_URI);

  try {
    console.log("🔌 Connecting to Atlas cluster...");
    await clusterClient.connect();
    await warrantyClient.connect();
    console.log("✅ Connected!\n");

    // 1. Liệt kê tất cả database trên cluster
    const adminDb = clusterClient.db("admin");
    const { databases } = await adminDb.command({ listDatabases: 1 });
    const dbNames = databases.map((d) => d.name).filter(
      (n) => !["admin", "local", "config"].includes(n)
    );

    console.log(`📦 Found databases: ${dbNames.join(", ")}\n`);

    let allStoreRecords = [];

    // 2. Tìm warrantyrecords trong từng database
    for (const dbName of dbNames) {
      const db = clusterClient.db(dbName);
      const collections = await db.listCollections().toArray();
      const hasWarranty = collections.some(
        (c) => c.name === "warrantyrecords"
      );

      if (!hasWarranty) {
        console.log(`  ⏭️  ${dbName}: no warrantyrecords collection`);
        continue;
      }

      console.log(`  ✅ ${dbName}: found warrantyrecords`);

      const query = PHONE_FILTER
        ? { customerPhoneNormalized: PHONE_FILTER.replace(/\D/g, "") }
        : {};

      const records = await db
        .collection("warrantyrecords")
        .find(query)
        .toArray();

      console.log(`     → ${records.length} records found`);
      allStoreRecords.push(...records.map((r) => ({ ...r, _sourceDb: dbName })));
    }

    if (!allStoreRecords.length) {
      console.log("\n⚠️  No warranty records found in any Store database.");
      console.log("ℹ️  Make sure POS orders have been finalized to generate warranty records.");
      return;
    }

    console.log(`\n📊 Total records to sync: ${allStoreRecords.length}`);

    // 3. Kết nối warranty_db và upsert
    const warrantyDb = warrantyClient.db("warranty_db");
    const destCollection = warrantyDb.collection("warrantyrecords");

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const record of allStoreRecords) {
      try {
        // Transform từ Store schema sang warranty web schema
        const dest = transformRecord(record);

        // Upsert theo phone + productName + startDate (idempotent)
        const filter = {
          customerPhoneNormalized: dest.customerPhoneNormalized,
          productName: dest.productName,
          startDate: dest.startDate,
        };

        // Nếu có IMEI/serial — dùng làm key chính xác hơn
        if (dest.imeiNormalized) {
          filter.imeiNormalized = dest.imeiNormalized;
          delete filter.startDate;
        } else if (dest.serialNumberNormalized) {
          filter.serialNumberNormalized = dest.serialNumberNormalized;
          delete filter.startDate;
        }

        const existing = await destCollection.findOne(filter);
        if (existing) {
          // Update nếu đã tồn tại
          await destCollection.updateOne(
            { _id: existing._id },
            { $set: { ...dest, updatedAt: new Date() } }
          );
          updated++;
          console.log(`  🔄 Updated: ${dest.productName} - ${dest.customerPhone}`);
        } else {
          await destCollection.insertOne({
            ...dest,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          inserted++;
          console.log(`  ✅ Inserted: ${dest.productName} - ${dest.customerPhone}`);
        }
      } catch (err) {
        errors++;
        console.error(`  ❌ Error processing record: ${err.message}`);
      }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Sync complete!`);
    console.log(`   Inserted : ${inserted}`);
    console.log(`   Updated  : ${updated}`);
    console.log(`   Skipped  : ${skipped}`);
    console.log(`   Errors   : ${errors}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } finally {
    await clusterClient.close();
    await warrantyClient.close();
    console.log("🔌 Disconnected.");
  }
}

// ─── Transform Store WarrantyRecord → warranty web WarrantyRecord ──────────
function transformRecord(storeRecord) {
  const {
    _id,
    __v,
    _sourceDb,
    storeId,
    deviceId,
    orderId,
    orderItemId,
    customerId,
    soldAt,
    ...rest
  } = storeRecord;

  // Chuẩn hóa phone nếu chưa có
  const customerPhoneNormalized =
    storeRecord.customerPhoneNormalized ||
    String(storeRecord.customerPhone || "").replace(/\D/g, "");

  // Tính lại lookupKeys nếu cần
  const imeiNormalized = storeRecord.imeiNormalized || "";
  const serialNumberNormalized = storeRecord.serialNumberNormalized || "";
  const lookupKeys = [];
  if (imeiNormalized) lookupKeys.push(imeiNormalized);
  if (serialNumberNormalized && serialNumberNormalized.length >= 6)
    lookupKeys.push(serialNumberNormalized);
  if (storeRecord.lookupKeys?.length) {
    for (const k of storeRecord.lookupKeys) {
      if (!lookupKeys.includes(k)) lookupKeys.push(k);
    }
  }

  return {
    // Ref sang main app (để enrich thông tin sau này)
    mainAppProductId: storeRecord.productId
      ? String(storeRecord.productId)
      : "",

    // Thông tin khách hàng
    customerName: storeRecord.customerName || "",
    customerPhone: storeRecord.customerPhone || "",
    customerPhoneNormalized,

    // Thông tin sản phẩm
    productName: storeRecord.productName || "Không rõ sản phẩm",
    variantSku: storeRecord.variantSku || "",

    // Định danh thiết bị
    imei: storeRecord.imei || "",
    imeiNormalized: imeiNormalized || undefined,
    serialNumber: storeRecord.serialNumber || "",
    serialNumberNormalized: serialNumberNormalized || undefined,
    lookupKeys,

    // Thông tin bảo hành
    startDate: storeRecord.startDate || storeRecord.soldAt || new Date(),
    expiresAt: storeRecord.expiresAt,
    warrantyMonths: Number(storeRecord.warrantyMonths) || 12,
    warrantyType: storeRecord.warrantyType || "STORE",
    status: storeRecord.status || "ACTIVE",
    warrantyTerms: storeRecord.warrantyTerms || "",
    quantity: Number(storeRecord.quantity) || 1,
    notes: storeRecord.notes || `Synced from Store DB: ${_sourceDb}`,
  };
}

// ─── Run ──────────────────────────────────────────────────────────────────
run().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
