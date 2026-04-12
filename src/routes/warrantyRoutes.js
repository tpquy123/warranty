import express from "express";
import {
  searchWarrantyHandler,
  createWarrantyHandler,
} from "../controllers/warrantyController.js";

const router = express.Router();

/**
 * GET /api/warranty/search
 * Tra cứu bảo hành theo số điện thoại hoặc IMEI/Serial.
 * Query params: phone | imeiOrSerial | identifier
 * Public — không cần xác thực.
 */
router.get("/search", searchWarrantyHandler);

/**
 * POST /api/warranty
 * Tạo bản ghi bảo hành mới trong database local.
 * Body: xem warrantyController.createWarrantyHandler để biết các field.
 *
 * ⚠️  Trong production nên thêm middleware xác thực (API key hoặc JWT)
 *     trước khi expose route này ra ngoài.
 */
router.post("/", createWarrantyHandler);

export default router;
