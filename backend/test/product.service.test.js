const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const modelPath = require.resolve("../src/models/product.model");
const servicePath = require.resolve("../src/services/product.service");
const originalModel = require.cache[modelPath];
const calls = [];
let categories = [];

require.cache[modelPath] = {
  id: modelPath,
  filename: modelPath,
  loaded: true,
  exports: {
    listProducts: async (query) => {
      calls.push({ method: "listProducts", query });
      return [];
    },
    countProducts: async () => 0,
    createProduct: async (data) => {
      calls.push({ method: "createProduct", data });
      return data;
    },
    listCategories: async () => categories,
    createCategory: async (data) => {
      calls.push({ method: "createCategory", data });
      return data;
    },
    updateCategory: async (id, data) => ({ id, ...data }),
    deleteCategory: async (id) => ({ id })
  }
};

const productService = require(servicePath);

after(() => {
  delete require.cache[servicePath];
  if (originalModel) {
    require.cache[modelPath] = originalModel;
  } else {
    delete require.cache[modelPath];
  }
});

test("create normalizes product values and creates an accent-free slug", async () => {
  calls.length = 0;
  const result = await productService.create({
    name: "  Đồ Đẹp  ",
    description: "  Mô tả ",
    price: "125000",
    stock: "8",
    image: " https://example.test/image.png ",
    categoryId: "3"
  });

  assert.deepEqual(result, {
    name: "Đồ Đẹp",
    slug: "do-dep",
    description: "Mô tả",
    price: "125000.00",
    stock: 8,
    image: "https://example.test/image.png",
    categoryId: 3
  });
  assert.equal(calls[0].method, "createProduct");
});

test("list validates pagination and filter parameters", async () => {
  await assert.rejects(productService.list({ page: "0" }), {
    message: "Tham số lọc sản phẩm không hợp lệ",
    statusCode: 400
  });
  await assert.rejects(productService.list({ limit: "101" }), {
    message: "Tham số lọc sản phẩm không hợp lệ",
    statusCode: 400
  });
  await assert.rejects(productService.list({ categoryId: "invalid" }), {
    message: "Tham số lọc sản phẩm không hợp lệ",
    statusCode: 400
  });
});

test("addCategory trims names and generates a normalized slug", async () => {
  calls.length = 0;
  const result = await productService.addCategory({ name: "  Áo Đẹp  " });

  assert.deepEqual(result, { name: "Áo Đẹp", slug: "ao-dep" });
  assert.equal(calls[0].method, "createCategory");
});

test("removeCategory blocks deletion while products remain", async () => {
  categories = [{ id: 3, _count: { products: 1 } }];
  calls.length = 0;

  await assert.rejects(productService.removeCategory(3), {
    message: "Không thể xóa danh mục đang có sản phẩm",
    statusCode: 409
  });
  assert.equal(calls.some((call) => call.method === "deleteCategory"), false);
});
