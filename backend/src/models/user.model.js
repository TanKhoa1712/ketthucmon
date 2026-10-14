const prisma = require("../config/database");

function findUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  });
}

function createUser(data) {
  return prisma.user.create({
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  });
}

module.exports = { findUserByEmail, findUserById, createUser };
