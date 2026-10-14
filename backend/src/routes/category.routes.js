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

/**
 * @openapi
 * /api/categories/{id}:
 *   put:
 *     summary: Đổi tên danh mục (Admin)
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 80 }
 *     responses:
 *       200: { description: Danh mục được cập nhật }
 *       409: { description: Tên danh mục đã tồn tại }
 */
router.put("/:id", requireAuth, requireAdmin, productController.updateCategory);

/**
 * @openapi
 * /api/categories/{id}:
 *   delete:
 *     summary: Xóa danh mục không có sản phẩm (Admin)
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Danh mục được xóa }
 *       409: { description: Danh mục đang có sản phẩm }
 */
router.delete("/:id", requireAuth, requireAdmin, productController.removeCategory);

module.exports = router;
