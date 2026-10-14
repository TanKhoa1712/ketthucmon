const express = require("express");
const productController = require("../controllers/product.controller");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const router = express.Router();

/**
 * @openapi
 * /api/categories:
 *   get:
 *     summary: Lấy danh sách danh mục
 *     tags: [Categories]
 *     responses:
 *       200: { description: Danh sách danh mục }
 */
router.get("/", productController.categories);

/**
 * @openapi
 * /api/categories:
 *   post:
 *     summary: Tạo danh mục (Admin)
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201: { description: Danh mục được tạo }
 */
router.post("/", requireAuth, requireAdmin, productController.addCategory);

module.exports = router;
