const authService = require("../services/auth.service");
const userModel = require("../models/user.model");

function validateRegistration(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2 || name.length > 80 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    const error = new Error("Tên, email hoặc mật khẩu không hợp lệ (mật khẩu cần 8–72 ký tự)");
    error.statusCode = 400;
    throw error;
  }
  return { name, email, password };
}

async function register(req, res) {
  const result = await authService.register(validateRegistration(req.body || {}));
  return res.status(201).json({ success: true, ...result });
}

async function login(req, res) {
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email và mật khẩu là bắt buộc" });
  }
  const result = await authService.login({ email, password });
  return res.status(200).json({ success: true, ...result });
}

async function currentUser(req, res) {
  const user = await userModel.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
  }
  return res.status(200).json({ success: true, user });
}

module.exports = { register, login, currentUser };
