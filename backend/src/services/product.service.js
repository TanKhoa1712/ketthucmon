const productModel = require("../models/product.model");

function makeSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function productData(input) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const price = Number(input.price);
  const stock = Number(input.stock);
  const categoryId = Number(input.categoryId);

  if (!name || !Number.isFinite(price) || price <= 0 ||
      !Number.isInteger(stock) || stock < 0 ||
      !Number.isInteger(categoryId) || categoryId < 1) {
    const error = new Error("Tên, giá, tồn kho hoặc danh mục sản phẩm không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    slug: makeSlug(name),
    description: typeof input.description === "string" ? input.description.trim() : null,
    price: price.toFixed(2),
    stock,
    image: typeof input.image === "string" && input.image.trim() ? input.image.trim() : null,
    categoryId
  };
}

async function list({ search = "", categoryId, page = "1", limit = "12" }) {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const parsedCategory = categoryId === undefined ? undefined : Number(categoryId);

  if (!Number.isInteger(parsedPage) || parsedPage < 1 ||
      !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100 ||
      (parsedCategory !== undefined && (!Number.isInteger(parsedCategory) || parsedCategory < 1))) {
    const error = new Error("Tham số lọc sản phẩm không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  const query = {
    search: typeof search === "string" ? search.trim() : "",
    categoryId: parsedCategory,
    page: parsedPage,
    limit: parsedLimit
  };
  const [data, total] = await Promise.all([
    productModel.listProducts(query),
    productModel.countProducts(query)
  ]);

  return { data, pagination: { page: parsedPage, limit: parsedLimit, total } };
}

async function getById(id) {
  const product = await productModel.findProductById(id);
  if (!product) {
    const error = new Error("Không tìm thấy sản phẩm");
    error.statusCode = 404;
    throw error;
  }
  return product;
}

function create(input) {
  return productModel.createProduct(productData(input));
}

async function update(id, input) {
  await getById(id);
  return productModel.updateProduct(id, productData(input));
}

async function remove(id) {
  await getById(id);
  return productModel.deleteProduct(id);
}

async function categories() {
  return productModel.listCategories();
}

async function addCategory(input) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    const error = new Error("Tên danh mục phải từ 2 đến 80 ký tự");
    error.statusCode = 400;
    throw error;
  }
  return productModel.createCategory({ name, slug: makeSlug(name) });
}

async function updateCategory(id, input) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    const error = new Error("Tên danh mục phải từ 2 đến 80 ký tự");
    error.statusCode = 400;
    throw error;
  }
  return productModel.updateCategory(id, { name, slug: makeSlug(name) });
}

async function removeCategory(id) {
  const category = (await productModel.listCategories()).find((item) => item.id === id);
  if (!category) {
    const error = new Error("Không tìm thấy danh mục");
    error.statusCode = 404;
    throw error;
  }
  if (category._count.products > 0) {
    const error = new Error("Không thể xóa danh mục đang có sản phẩm");
    error.statusCode = 409;
    throw error;
  }
  return productModel.deleteCategory(id);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  categories,
  addCategory,
  updateCategory,
  removeCategory
};
