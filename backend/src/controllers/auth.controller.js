const jwt = require("jsonwebtoken");

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role || "customer" },
    process.env.JWT_SECRET || "demo_secret",
    { expiresIn: "7d" }
  );
}

module.exports = { generateToken };
