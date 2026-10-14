const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");

function createToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { subject: String(user.id), expiresIn: "7d" }
  );
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

async function register({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await userModel.findUserByEmail(normalizedEmail);
  if (existingUser) {
    const error = new Error("Email này đã được đăng ký");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await userModel.createUser({
    name: name.trim(),
    email: normalizedEmail,
    password: passwordHash
  });

  return { user, token: createToken(user) };
}

async function login({ email, password }) {
  const user = await userModel.findUserByEmail(email.trim().toLowerCase());
  const validPassword = user && await bcrypt.compare(password, user.password);
  if (!validPassword) {
    const error = new Error("Email hoặc mật khẩu không chính xác");
    error.statusCode = 401;
    throw error;
  }

  return { user: publicUser(user), token: createToken(user) };
}

module.exports = { register, login, publicUser };
