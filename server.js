import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./src/config/database.js";
import warrantyRoutes from "./src/routes/warrantyRoutes.js";
import mongoose from "mongoose";

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
// DEBUG endpoint (tạm thời — xóa sau khi fix)
// ================================
app.get("/api/debug", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const stateNames = ["disconnected", "connected", "connecting", "disconnecting"];

    let recordCount = 0;
    let sampleRecord = null;
    if (dbState === 1) {
      const col = mongoose.connection.collection("warrantyrecords");
      recordCount = await col.countDocuments();
      sampleRecord = await col.findOne(
        { customerPhoneNormalized: "0848549959" },
        { projection: { productName: 1, customerPhoneNormalized: 1, status: 1 } }
      );
    }

    res.json({
      version: "2.0-fallback",
      dbState: stateNames[dbState] || dbState,
      dbName: mongoose.connection.name,
      recordCount,
      sampleRecord,
      MAIN_API_URL: process.env.MAIN_API_URL,
      MAIN_SITE_URL: process.env.MAIN_SITE_URL,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    console.log(
      `🛡️  Warranty Microservice running on http://localhost:${PORT}`,
    );
    console.log(`🔗  Main API URL: ${process.env.MAIN_API_URL}`);
    console.log(
      `🌐  Main Site URL: ${process.env.MAIN_SITE_URL || "http://localhost:5173"}`,
    );
    console.log(
      `🗄️  MongoDB URI: ${process.env.MONGODB_URI?.replace(/\/\/.*@/, "//***@") || "local"}`,
    );
  });
});

export default app;
