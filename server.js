import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./src/config/database.js";
import warrantyRoutes from "./src/routes/warrantyRoutes.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// ================================
// Middleware
// ================================
app.use(cors());
app.use(express.json());

// ================================
// Config endpoint - trả về biến môi trường an toàn cho frontend
// ================================
app.get("/api/config", (req, res) => {
  res.json({
    mainSiteUrl: process.env.MAIN_SITE_URL || "http://localhost:5173",
  });
});

// ================================
// Serve static frontend files
// ================================
app.use(express.static(path.join(__dirname, "public")));

// ================================
// API Routes (proxy to main app)
// ================================
app.use("/api/warranty", warrantyRoutes);

// ================================
// SPA fallback - serve index.html
// ================================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================================
// Error handler
// ================================
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ================================
// Connect DB → Start server
// ================================
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🛡️  Warranty Microservice running on http://localhost:${PORT}`);
    console.log(`🔗  Main API URL: ${process.env.MAIN_API_URL}`);
    console.log(`🌐  Main Site URL: ${process.env.MAIN_SITE_URL || "http://localhost:5173"}`);
    console.log(`🗄️  MongoDB URI: ${process.env.MONGODB_URI?.replace(/\/\/.*@/, "//***@") || "local"}`);
  });
});


export default app;
