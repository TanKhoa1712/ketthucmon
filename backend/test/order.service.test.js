const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const modelPath = require.resolve("../src/models/order.model");
const emailPath = require.resolve("../src/services/email.service");
const servicePath = require.resolve("../src/services/order.service");
const originalModel = require.cache[modelPath];
const originalEmail = require.cache[emailPath];
const recordedCalls = [];
const emailCalls = [];

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
    updateOrderStatus: async (id, status) => ({ id, status }),
    confirmManualPayment: async (id) => ({ id, paymentStatus: "PAID" })
  }
};

require.cache[emailPath] = {
  id: emailPath,
  filename: emailPath,
  loaded: true,
  exports: {
    sendOrderConfirmation: async (...args) => emailCalls.push(args),
    sendPaymentResult: async (...args) => emailCalls.push(args)
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
  if (originalEmail) {
    require.cache[emailPath] = originalEmail;
  } else {
    delete require.cache[emailPath];
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
    shippingAddress: "  12 Nguyen Trai, Ha Noi ",
    paymentMethod: "COD"
  }, 7);

  assert.deepEqual(result, { order: {
    userId: 7,
    items: [{ productId: 2, quantity: 5 }, { productId: 4, quantity: 1 }],
    shippingName: "Nguyen Van A",
    shippingPhone: "0912345678",
    shippingAddress: "12 Nguyen Trai, Ha Noi",
    paymentMethod: "COD"
  }, paymentUrl: null });
  assert.equal(recordedCalls.length, 1);
  assert.equal(emailCalls.length, 1);
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
    await t.test(message, async () => {
      const callCount = recordedCalls.length;
      await assert.rejects(orderService.create(input, 7), {
        message,
        statusCode: 400
      });
      assert.equal(recordedCalls.length, callCount);
    });
  }
});

test("create rejects unsupported payment methods", async () => {
  await assert.rejects(orderService.create({
    items: [{ productId: 1, quantity: 1 }],
    shippingName: "Nguyen Van A",
    shippingPhone: "0912345678",
    shippingAddress: "12 Nguyen Trai, Ha Noi",
    paymentMethod: "CARD"
  }, 7), {
    message: "Phương thức thanh toán không hợp lệ",
    statusCode: 400
  });
});

test("create accepts QR transfer without VNPay configuration", async () => {
  const result = await orderService.create({
    items: [{ productId: 1, quantity: 1 }],
    shippingName: "Nguyen Van A",
    shippingPhone: "0912345678",
    shippingAddress: "12 Nguyen Trai, Ha Noi",
    paymentMethod: "QR_TRANSFER"
  }, 7);

  assert.equal(result.order.paymentMethod, "QR_TRANSFER");
  assert.equal(result.paymentUrl, null);
  assert.equal(recordedCalls.at(-1).method, "createOrder");
});

test("updateStatus rejects unsupported statuses", async () => {
  await assert.rejects(orderService.updateStatus(10, "UNKNOWN"), {
    message: "Trạng thái đơn hàng không hợp lệ",
    statusCode: 400
  });

  test("confirmManualPayment delegates the order id to the model", async () => {
    assert.deepEqual(await orderService.confirmManualPayment(12), {
      id: 12,
      paymentStatus: "PAID"
    });
  });
});
