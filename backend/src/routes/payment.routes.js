const express = require("express");
const paymentController = require("../controllers/payment.controller");

const router = express.Router();

/**
 * @openapi
 * /api/payments/vnpay/return:
 *   get:
 *     summary: Callback trả khách hàng về sau khi thanh toán VNPay
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: vnp_SecureHash
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       303: { description: Chuyển khách hàng về trang kết quả thanh toán }
 */
router.get("/vnpay/return", paymentController.vnpayReturn);

/**
 * @openapi
 * /api/payments/vnpay/ipn:
 *   get:
 *     summary: IPN callback server-to-server từ VNPay
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: vnp_SecureHash
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Kết quả đối soát được xác nhận }
 */
router.get("/vnpay/ipn", paymentController.vnpayIpn);

module.exports = router;
