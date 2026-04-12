import axios from "axios";

const MAIN_API_URL = process.env.MAIN_API_URL || "http://localhost:5000/api";

const mainApi = axios.create({
  baseURL: MAIN_API_URL,
  timeout: 8000,
});

// ─── Lấy thông tin sản phẩm theo ID (từ main app) ─────────────────────────

/**
 * Lấy thông tin sản phẩm theo MongoDB ObjectId từ main app.
 * Gọi endpoint công khai: GET /api/universal-products/:id
 * @param {string} productId
 * @returns {Promise<object|null>} product object hoặc null nếu không tìm thấy
 */
export const getProductById = async (productId) => {
  if (!productId) return null;
  try {
    const response = await mainApi.get(`/universal-products/${productId}`);
    return response.data?.data?.product || null;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

/**
 * Tìm kiếm sản phẩm theo tên / model / SKU từ main app.
 * Gọi endpoint công khai: GET /api/universal-products?search=<query>
 * @param {string} query
 * @returns {Promise<Array>} danh sách sản phẩm
 */
export const searchProducts = async (query = "") => {
  if (!query.trim()) return [];
  try {
    const response = await mainApi.get("/universal-products", {
      params: { search: query.trim(), limit: 20 },
    });
    return response.data?.data?.products || [];
  } catch (_) {
    return [];
  }
};

export default { getProductById, searchProducts };
