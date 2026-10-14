const express = require("express");
const orderController = require("../controllers/order.controller");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");
const router = express.Router();

/**
 * @openapi
 * /api/orders:
 *   post:
 *     summary: Đặt hàng COD
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, shippingName, shippingPhone, shippingAddress]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: integer }
 *                     quantity: { type: integer, minimum: 1 }
 *               shippingName: { type: string }
 *               shippingPhone: { type: string }
 *               shippingAddress: { type: string }
 *     responses:
 *       201: { description: Đơn hàng được tạo }
 *       409: { description: Không đủ tồn kho }
 */
router.post("/", requireAuth, orderController.create);

/**
 * @openapi
 * /api/orders:
 *   get:
 *     summary: Lấy đơn hàng của mình (Admin xem tất cả)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sách đơn hàng }
 */
router.get("/", requireAuth, orderController.list);

router.get("/my-orders", requireAuth, orderController.list);

/**
 * @openapi
 * /api/orders/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái đơn hàng (Admin)
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, CONFIRMED, SHIPPING, DELIVERED, CANCELLED]
 *     responses:
 *       200: { description: Trạng thái được cập nhật }
 */
router.patch("/:id/status", requireAuth, requireAdmin, orderController.updateStatus);

module.exports = router;
