import { searchLocalWarranty, createWarrantyRecord } from "../services/warrantyService.js";

// ─── Tra cứu bảo hành (public) ─────────────────────────────────────────────

/**
 * GET /api/warranty/search?phone=... hoặc ?imeiOrSerial=...
 * Tìm kiếm bảo hành trong database local của web bảo hành.
 */
export const searchWarrantyHandler = async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();
    const imeiOrSerial = String(
      req.query.imeiOrSerial || req.query.identifier || ""
    ).trim();

    if (!phone && !imeiOrSerial) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập số điện thoại hoặc IMEI/Serial",
      });
    }

    const data = await searchLocalWarranty({ phone, imeiOrSerial });

    return res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || "Không thể tra cứu thông tin bảo hành";

    return res.status(status).json({
      success: false,
      message,
    });
  }
};

// ─── Tạo bản ghi bảo hành mới (nội bộ) ────────────────────────────────────

/**
 * POST /api/warranty
 * Tạo bản ghi bảo hành mới trong database local.
 *
 * Body JSON:
 *   customerName    string (tuỳ chọn)
 *   customerPhone   string (bắt buộc)
 *   productName     string (bắt buộc)
 *   variantSku      string (tuỳ chọn)
 *   mainAppProductId string (tuỳ chọn — ID sản phẩm bên main app)
 *   imei            string (tuỳ chọn)
 *   serialNumber    string (tuỳ chọn)
 *   startDate       string ISO date (tuỳ chọn — mặc định hôm nay)
 *   warrantyMonths  number (tuỳ chọn — mặc định 12)
 *   warrantyType    string (tuỳ chọn — mặc định "STORE")
 *   warrantyTerms   string (tuỳ chọn)
 *   quantity        number (tuỳ chọn — mặc định 1)
 *   notes           string (tuỳ chọn)
 */
export const createWarrantyHandler = async (req, res) => {
  try {
    const record = await createWarrantyRecord(req.body);
    return res.status(201).json({
      success: true,
      message: "Tạo bảo hành thành công",
      data: { warranty: record },
    });
  } catch (error) {
    const status = error.status || 400;
    const message = error.message || "Không thể tạo bản ghi bảo hành";
    return res.status(status).json({
      success: false,
      message,
    });
  }
};

export default { searchWarrantyHandler, createWarrantyHandler };
