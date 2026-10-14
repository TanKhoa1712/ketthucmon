const productService = require("../services/product.service");

async function list(req, res) {
  const result = await productService.list(req.query);
  return res.status(200).json({ success: true, ...result });
}

async function getById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Mã sản phẩm không hợp lệ" });
  }
  const product = await productService.getById(id);
  return res.status(200).json({ success: true, data: product });
}

async function create(req, res) {
  const product = await productService.create(req.body || {});
  return res.status(201).json({ success: true, data: product });
}

async function update(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Mã sản phẩm không hợp lệ" });
  }
  const product = await productService.update(id, req.body || {});
  return res.status(200).json({ success: true, data: product });
}

async function remove(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Mã sản phẩm không hợp lệ" });
  }
  await productService.remove(id);
  return res.status(200).json({ success: true, message: "Đã xóa sản phẩm" });
}

async function categories(req, res) {
  const data = await productService.categories();
  return res.status(200).json({ success: true, data });
}

async function addCategory(req, res) {
  const data = await productService.addCategory(req.body || {});
  return res.status(201).json({ success: true, data });
}

async function updateCategory(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Mã danh mục không hợp lệ" });
  }
  const data = await productService.updateCategory(id, req.body || {});
  return res.status(200).json({ success: true, data });
}

async function removeCategory(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Mã danh mục không hợp lệ" });
  }
  await productService.removeCategory(id);
  return res.status(200).json({ success: true, message: "Đã xóa danh mục" });
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
