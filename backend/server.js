
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be configured in production");
  }
  process.env.JWT_SECRET = "local-development-only-secret-change-before-production";
  console.warn("JWT_SECRET is not configured; using an insecure development-only secret");
}

const app = express();
const prisma = new PrismaClient();
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Web Bán Hàng API",
      version: "1.0.0",
      description: "API cho hệ thống website bán hàng"
    },
    servers: [{ url: "http://localhost:5000" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  },
  apis: ["./src/routes/*.js", "./src/controllers/*.js"]
});

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const { authRoutes, productRoutes, categoryRoutes, orderRoutes } = require("./src/routes");
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.status(200).json({
    name: "Web Bán Hàng API",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      products: "/api/products",
      categories: "/api/categories",
      orders: "/api/orders",
      docs: "/api-docs"
    }
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: "Backend đang hoạt động",
      database: "connected"
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(500).json({
      success: false,
      message: "Backend đang hoạt động nhưng cơ sở dữ liệu chưa sẵn sàng",
      database: "disconnected"
    });
  }
});

app.get("/api", (req, res) => {
  res.status(200).json({
    name: "Web Bán Hàng API",
    version: "1.0.0",
    docs: "/api-docs"
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  const knownPrismaStatus = {
    P2002: 409,
    P2003: 409,
    P2025: 404
  };
  const status = error.statusCode || knownPrismaStatus[error.code] || 500;
  if (status >= 500) {
    console.error("Request failed:", error);
  }
  return res.status(status).json({
    success: false,
    message: status >= 500
      ? "Đã xảy ra lỗi máy chủ"
      : error instanceof SyntaxError && error.status === 400
        ? "JSON request không hợp lệ"
        : error.message
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend đang chạy tại http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});
