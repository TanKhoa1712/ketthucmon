const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const modelPath = require.resolve("../src/models/order.model");
const servicePath = require.resolve("../src/services/order.service");
const originalModel = require.cache[modelPath];
const recordedCalls = [];

require.cache[modelPath] = {
  id: modelPath,
  filename: modelPath,
  loaded: true,
  exports: {
    createOrder: async (data) => {
      recordedCalls.push({ method: "createOrder", data });
      return data;
    },
    listOrders: async (data) => data,
    updateOrderStatus: async (id, status) => ({ id, status })
  }
};

const orderService = require(servicePath);

after(() => {
  delete require.cache[servicePath];
  if (originalModel) {
    require.cache[modelPath] = originalModel;
  } else {
    delete require.cache[modelPath];
  }
});

test("create merges duplicate product lines and normalizes shipping details", async () => {
  recordedCalls.length = 0;
  const result = await orderService.create({
    items: [
      { productId: "2", quantity: 2 },
      { productId: 2, quantity: 3 },
      { productId: 4, quantity: 1 }
    ],
    shippingName: "  Nguyen Van A ",
    shippingPhone: " 0912345678 ",
    shippingAddress: "  12 Nguyen Trai, Ha Noi "
  }, 7);

  assert.deepEqual(result, {
    userId: 7,
    items: [{ productId: 2, quantity: 5 }, { productId: 4, quantity: 1 }],
    shippingName: "Nguyen Van A",
    shippingPhone: "0912345678",
    shippingAddress: "12 Nguyen Trai, Ha Noi"
  });
  assert.equal(recordedCalls.length, 1);
});

test("create rejects invalid and oversized carts before persistence", async (t) => {
  const invalidOrders = [
    [{ items: [] }, "Giỏ hàng phải có từ 1 đến 50 sản phẩm"],
    [{ items: [{ productId: 0, quantity: 1 }] }, "Sản phẩm hoặc số lượng không hợp lệ"],
    [{ items: [{ productId: 1, quantity: 60 }, { productId: 1, quantity: 41 }] }, "Số lượng mỗi sản phẩm không được vượt quá 100"],
    [{
      items: [{ productId: 1, quantity: 1 }],
      shippingName: "A",
      shippingPhone: "0912345678",
      shippingAddress: "Short"
    }, "Thông tin nhận hàng không hợp lệ"]
  ];

  for (const [input, message] of invalidOrders) {
    await t.test(message, () => {
      const callCount = recordedCalls.length;
      assert.throws(() => orderService.create(input, 7), {
        message,
        statusCode: 400
      });
      assert.equal(recordedCalls.length, callCount);
    });
  }
});

test("updateStatus rejects unsupported statuses", async () => {
  await assert.rejects(orderService.updateStatus(10, "UNKNOWN"), {
    message: "Trạng thái đơn hàng không hợp lệ",
    statusCode: 400
  });
});
