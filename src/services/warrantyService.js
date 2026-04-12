import WarrantyRecord, { WARRANTY_STATUSES } from "../models/WarrantyRecord.js";
import { getProductById } from "./mainApiService.js";

// ─── Helpers chuẩn hóa ─────────────────────────────────────────────────────

/**
 * Chuẩn hóa số điện thoại — chỉ giữ lại chữ số
 */
export const normalizePhone = (value) =>
  String(value || "").replace(/\D+/g, "");

/**
 * Chuẩn hóa IMEI (15 chữ số)
 */
export const normalizeImei = (value) => {
  const digits = String(value || "").replace(/\D+/g, "");
  return digits.length === 15 ? digits : "";
};

/**
 * Chuẩn hóa Serial Number (chữ và số, tối thiểu 6 ký tự)
 */
export const normalizeSerial = (value) => {
  const cleaned = String(value || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cleaned.length >= 6 ? cleaned : "";
};

/**
 * Tính trạng thái bảo hành thực tế (có thể EXPIRED dù DB lưu ACTIVE)
 */
const resolveWarrantyStatus = (record, now = new Date()) => {
  const base = String(record.status || WARRANTY_STATUSES.ACTIVE).toUpperCase();
  if (
    base === WARRANTY_STATUSES.ACTIVE &&
    record.expiresAt instanceof Date &&
    record.expiresAt < now
  ) {
    return WARRANTY_STATUSES.EXPIRED;
  }
  return base;
};

/**
 * Format một record thành object trả về cho frontend
 */
const buildPublicItem = (record, now = new Date()) => {
  const expiresAt = record.expiresAt instanceof Date ? record.expiresAt : new Date(record.expiresAt);
  const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
  const remainingWarrantyDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  return {
    id: String(record._id),
    mainAppProductId: record.mainAppProductId || "",
    productName: record.productName || "Không rõ sản phẩm",
    variantSku: record.variantSku || "",
    identifier: record.imei || record.serialNumber || "",
    imei: record.imei || "",
    serialNumber: record.serialNumber || "",
    customerName: record.customerName || "",
    customerPhone: record.customerPhone || "",
    quantity: Number(record.quantity) || 1,
    purchaseDate: record.startDate,
    warrantyStartDate: record.startDate,
    warrantyExpirationDate: record.expiresAt,
    remainingWarrantyDays,
    warrantyStatus: resolveWarrantyStatus(record, now),
    warrantyType: record.warrantyType || "STORE",
    warrantyPolicy: record.warrantyTerms || "",
    warrantyMonths: Number(record.warrantyMonths) || 0,
  };
};

// ─── Enrich thông tin sản phẩm từ main app ─────────────────────────────────

/**
 * (Tuỳ chọn) Enrich thêm tên/hình ảnh sản phẩm từ main app.
 * Nếu main app offline thì bỏ qua — dùng productName đã lưu sẵn.
 */
const enrichWithProduct = async (items) => {
  // Nhóm theo mainAppProductId để batch fetch
  const ids = [...new Set(items.map((i) => i.mainAppProductId).filter(Boolean))];
  if (!ids.length) return items;

  const productMap = {};
  await Promise.allSettled(
    ids.map(async (id) => {
      try {
        const product = await getProductById(id);
        if (product) productMap[id] = product;
      } catch (_) {
        // Nếu lỗi thì bỏ qua — dữ liệu local vẫn đủ dùng
      }
    })
  );

  return items.map((item) => {
    const product = productMap[item.mainAppProductId];
    if (!product) return item;
    return {
      ...item,
      // Cập nhật tên sản phẩm mới nhất từ main app (nếu có)
      productName: product.name || item.productName,
    };
  });
};

// ─── Tra cứu bảo hành (luồng chính) ───────────────────────────────────────

/**
 * Tìm kiếm bảo hành trong database LOCAL của web bảo hành.
 * @param {{ phone?: string, imeiOrSerial?: string }} params
 */
export const searchLocalWarranty = async ({ phone = "", imeiOrSerial = "" } = {}) => {
  const normalizedPhone = normalizePhone(phone);
  const imeiKey = normalizeImei(imeiOrSerial);
  const serialKey = normalizeSerial(imeiOrSerial);
  const lookupKey = imeiKey || serialKey;

  if (!normalizedPhone && !lookupKey) {
    const err = new Error("Vui lòng nhập số điện thoại hoặc IMEI/Serial");
    err.status = 400;
    throw err;
  }

  let query;
  let searchBy;

  if (lookupKey) {
    query = { lookupKeys: lookupKey };
    searchBy = "IDENTIFIER";
  } else {
    query = { customerPhoneNormalized: normalizedPhone };
    searchBy = "PHONE";
  }

  const records = await WarrantyRecord.find(query)
    .sort({ startDate: -1, createdAt: -1 })
    .lean();

  if (!records.length) {
    const err = new Error("Không tìm thấy thông tin bảo hành");
    err.status = 404;
    throw err;
  }

  const now = new Date();
  let items = records.map((r) => buildPublicItem(r, now));

  // Enrich thông tin sản phẩm từ main app (không bắt buộc)
  try {
    items = await enrichWithProduct(items);
  } catch (_) {
    // Nếu lỗi enrich thì vẫn trả về dữ liệu local
  }

  return {
    searchBy,
    query: lookupKey || normalizedPhone,
    total: items.length,
    warranties: items,
  };
};

// ─── Tạo bản ghi bảo hành mới ─────────────────────────────────────────────

/**
 * Tạo bản ghi bảo hành trong database local.
 * Dùng khi nhập liệu bảo hành từ hệ thống quản lý.
 */
export const createWarrantyRecord = async (data = {}) => {
  const customerPhoneNormalized = normalizePhone(data.customerPhone);
  if (!customerPhoneNormalized) {
    const err = new Error("Số điện thoại khách hàng không hợp lệ");
    err.status = 400;
    throw err;
  }

  const imei = String(data.imei || "").trim();
  const serialNumber = String(data.serialNumber || "").trim();
  const imeiNormalized = normalizeImei(imei);
  const serialNormalized = normalizeSerial(serialNumber);

  // Tính lookupKeys
  const lookupKeys = [];
  if (imeiNormalized) lookupKeys.push(imeiNormalized);
  if (serialNormalized) lookupKeys.push(serialNormalized);

  // Tính ngày hết hạn
  const startDate = data.startDate ? new Date(data.startDate) : new Date();
  const warrantyMonths = Number(data.warrantyMonths) || 12;
  const expiresAt = new Date(startDate);
  expiresAt.setMonth(expiresAt.getMonth() + warrantyMonths);

  const record = await WarrantyRecord.create({
    customerName: String(data.customerName || "").trim(),
    customerPhone: String(data.customerPhone || "").trim(),
    customerPhoneNormalized,
    mainAppProductId: String(data.mainAppProductId || "").trim(),
    productName: String(data.productName || "").trim(),
    variantSku: String(data.variantSku || "").trim(),
    imei,
    imeiNormalized: imeiNormalized || undefined,
    serialNumber,
    serialNumberNormalized: serialNormalized || undefined,
    lookupKeys,
    startDate,
    expiresAt,
    warrantyMonths,
    warrantyType: data.warrantyType || "STORE",
    status: "ACTIVE",
    warrantyTerms: String(data.warrantyTerms || "").trim(),
    quantity: Number(data.quantity) || 1,
    notes: String(data.notes || "").trim(),
  });

  return record;
};

export default { searchLocalWarranty, createWarrantyRecord, normalizePhone };
