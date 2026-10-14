const express = require("express");
const router = express.Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Người dùng đã tạo thành công
 */
router.post("/register", (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Thông tin đăng ký không hợp lệ" });
  }

  return res.status(201).json({
    success: true,
    message: "Đăng ký thành công",
    user: {
      name,
      email,
      role: "customer"
    }
  });
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 */
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email và mật khẩu là bắt buộc" });
  }

  return res.status(200).json({
    success: true,
    message: "Đăng nhập thành công",
    token: "demo_jwt_token",
    user: {
      email,
      role: "customer"
    }
  });
});

module.exports = router;
