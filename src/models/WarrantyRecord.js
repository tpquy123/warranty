import mongoose from "mongoose";

// ─── Hằng số trạng thái bảo hành ──────────────────────────────────────────
export const WARRANTY_STATUSES = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  VOID: "VOID",
  REPLACED: "REPLACED",
};

export const WARRANTY_TYPES = {
  STORE: "STORE",
  APPLE: "APPLE",
  MANUFACTURER: "MANUFACTURER",
};

// ─── Schema ────────────────────────────────────────────────────────────────
const warrantyRecordSchema = new mongoose.Schema(
  {
    // Thông tin khách hàng
    customerName: {
      type: String,
      trim: true,
      default: "",
    },
    customerPhone: {
      type: String,
      trim: true,
      required: [true, "Số điện thoại khách hàng là bắt buộc"],
    },
    customerPhoneNormalized: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },

    // Thông tin sản phẩm (lấy từ main app lúc nhập + lưu lại để tra cứu offline)
    // productId tham chiếu sang MongoDB ObjectId bên main app — lưu dạng String
    mainAppProductId: {
      type: String,
      trim: true,
      default: "",
    },
    productName: {
      type: String,
      trim: true,
      required: [true, "Tên sản phẩm là bắt buộc"],
    },
    variantSku: {
      type: String,
      trim: true,
      default: "",
    },

    // Định danh thiết bị
    imei: {
      type: String,
      trim: true,
      default: "",
    },
    imeiNormalized: {
      type: String,
      trim: true,
      default: "",
    },
    serialNumber: {
      type: String,
      trim: true,
      default: "",
    },
    serialNumberNormalized: {
      type: String,
      trim: true,
      default: "",
    },
    // Mảng các key chuẩn hóa để tìm kiếm nhanh
    lookupKeys: [{ type: String, trim: true }],

    // Thông tin bảo hành
    startDate: {
      type: Date,
      required: [true, "Ngày bắt đầu bảo hành là bắt buộc"],
    },
    expiresAt: {
      type: Date,
      required: [true, "Ngày hết hạn bảo hành là bắt buộc"],
    },
    warrantyMonths: {
      type: Number,
      min: 0,
      default: 12,
    },
    warrantyType: {
      type: String,
      enum: Object.values(WARRANTY_TYPES),
      default: WARRANTY_TYPES.STORE,
    },
    status: {
      type: String,
      enum: Object.values(WARRANTY_STATUSES),
      default: WARRANTY_STATUSES.ACTIVE,
    },
    warrantyTerms: {
      type: String,
      trim: true,
      default: "",
    },

    // Số lượng (cho sản phẩm không có IMEI riêng)
    quantity: {
      type: Number,
      min: 1,
      default: 1,
    },

    // Bảo hành thay thế
    replacedFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarrantyRecord",
      default: null,
    },
    replacedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarrantyRecord",
      default: null,
    },

    // Ghi chú nội bộ
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
warrantyRecordSchema.index({ customerPhoneNormalized: 1, createdAt: -1 });
warrantyRecordSchema.index({ lookupKeys: 1 });
warrantyRecordSchema.index({ imeiNormalized: 1 }, { sparse: true });
warrantyRecordSchema.index({ serialNumberNormalized: 1 }, { sparse: true });
warrantyRecordSchema.index({ status: 1, expiresAt: 1 });
warrantyRecordSchema.index({ mainAppProductId: 1 });

// ─── Model ─────────────────────────────────────────────────────────────────
export default mongoose.models?.WarrantyRecord
  ? mongoose.model("WarrantyRecord")
  : mongoose.model("WarrantyRecord", warrantyRecordSchema);
