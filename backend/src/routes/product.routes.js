const express = require("express");
const productController = require("../controllers/product.controller");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const router = express.Router();

/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: Tìm kiếm và phân trang sản phẩm
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: categoryId
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200: { description: Danh sách và thông tin phân trang }
 */
router.get("/", productController.list);

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     summary: Lấy thông tin một sản phẩm
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Chi tiết sản phẩm }
 *       404: { description: Không tìm thấy }
 */
router.get("/:id", productController.getById);

/**
 * @openapi
 * /api/products:
 *   post:
 *     summary: Tạo sản phẩm (Admin)
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price, stock, categoryId]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               price: { type: number, minimum: 0 }
 *               stock: { type: integer, minimum: 0 }
 *               image: { type: string }
 *               categoryId: { type: integer }
 *     responses:
 *       201: { description: Sản phẩm được tạo }
 */
router.post("/", requireAuth, requireAdmin, productController.create);

/**
 * @openapi
 * /api/products/{id}:
 *   put:
 *     summary: Cập nhật sản phẩm (Admin)
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price, stock, categoryId]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               price: { type: number, minimum: 0 }
 *               stock: { type: integer, minimum: 0 }
 *               image: { type: string }
 *               categoryId: { type: integer }
 *     responses:
 *       200: { description: Sản phẩm được cập nhật }
 */
router.put("/:id", requireAuth, requireAdmin, productController.update);

/**
 * @openapi
 * /api/products/{id}:
 *   delete:
 *     summary: Xóa sản phẩm (Admin)
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Sản phẩm được xóa }
 */
router.delete("/:id", requireAuth, requireAdmin, productController.remove);

module.exports = router;
