const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Token không hợp lệ" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const id = Number(decoded.sub);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(401).json({ success: false, message: "Token không hợp lệ" });
    }
    req.user = { id, email: decoded.email, role: decoded.role };
  } catch (error) {
    return res.status(401).json({ success: false, message: "Token hết hạn hoặc không hợp lệ" });
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Bạn không có quyền thực hiện thao tác này" });
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };
