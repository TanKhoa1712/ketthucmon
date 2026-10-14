
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

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

const { authRoutes, productRoutes } = require("./src/routes");
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.status(200).json({
    name: "Web Bán Hàng API",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      products: "/api/products",
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
    res.status(500).json({
      success: false,
      message: "Backend đang hoạt động nhưng cơ sở dữ liệu chưa sẵn sàng",
      database: "disconnected",
      error: error.message
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend đang chạy tại http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});
