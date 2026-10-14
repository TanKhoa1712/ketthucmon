const prisma = require("../config/database");

function listProducts({ search, categoryId, page, limit }) {
  const where = {
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    ...(categoryId ? { categoryId } : {})
  };

  return prisma.product.findMany({
    where,
    include: { category: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit
  });
}

function countProducts({ search, categoryId }) {
  return prisma.product.count({
    where: {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(categoryId ? { categoryId } : {})
    }
  });
}

function findProductById(id) {
  return prisma.product.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true, slug: true } } }
  });
}

function createProduct(data) {
  return prisma.product.create({ data, include: { category: true } });
}

function updateProduct(id, data) {
  return prisma.product.update({ where: { id }, data, include: { category: true } });
}

function deleteProduct(id) {
  return prisma.product.delete({ where: { id } });
}

function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } }
  });
}

function createCategory(data) {
  return prisma.category.create({ data });
}

module.exports = {
  listProducts,
  countProducts,
  findProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  listCategories,
  createCategory
};
