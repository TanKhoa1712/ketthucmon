const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const databasePath = require.resolve("../src/config/database");
const modelPath = require.resolve("../src/models/order.model");
const originalDatabase = require.cache[databasePath];
const originalModel = require.cache[modelPath];
let order;
const calls = [];

const transaction = {
  order: {
    findUnique: async ({ where }) => {
      calls.push({ method: "findUnique", where });
      return order?.id === where.id ? { ...order } : null;
    },
    updateMany: async ({ where, data }) => {
      calls.push({ method: "updateMany", where, data });
      const matches = order?.id === where.id &&
        order.paymentMethod === where.paymentMethod &&
        order.paymentStatus === where.paymentStatus &&
        order.status === where.status;
      if (!matches) return { count: 0 };
      order = { ...order, ...data };
      return { count: 1 };
    }
  }
};
const fakePrisma = { $transaction: (callback) => callback(transaction) };

require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: fakePrisma
};

const orderModel = require(modelPath);

after(() => {
  delete require.cache[modelPath];
  if (originalModel) require.cache[modelPath] = originalModel;
  if (originalDatabase) {
    require.cache[databasePath] = originalDatabase;
  } else {
    delete require.cache[databasePath];
  }
});

test("confirms a pending QR transfer atomically", async () => {
  order = {
    id: 24,
    paymentMethod: "QR_TRANSFER",
    paymentStatus: "PENDING",
    status: "PENDING",
    paidAt: null
  };
  calls.length = 0;

  const result = await orderModel.confirmManualPayment(24);

  assert.equal(result.paymentStatus, "PAID");
  assert.ok(result.paidAt instanceof Date);
  assert.deepEqual(calls[1].where, {
    id: 24,
    paymentMethod: "QR_TRANSFER",
    paymentStatus: "PENDING",
    status: "PENDING"
  });
});

test("does not mark a non-QR order as manually paid", async () => {
  order = {
    id: 25,
    paymentMethod: "COD",
    paymentStatus: "NOT_REQUIRED",
    status: "PENDING"
  };
  calls.length = 0;

  await assert.rejects(orderModel.confirmManualPayment(25), {
    message: "Đơn hàng này không dùng thanh toán chuyển khoản QR",
    statusCode: 409
  });
  assert.equal(calls.some((call) => call.method === "updateMany"), false);
});

test("does not confirm a cancelled QR order", async () => {
  order = {
    id: 26,
    paymentMethod: "QR_TRANSFER",
    paymentStatus: "PENDING",
    status: "CANCELLED"
  };
  calls.length = 0;

  await assert.rejects(orderModel.confirmManualPayment(26), {
    message: "Không thể xác nhận thanh toán cho đơn hàng này",
    statusCode: 409
  });
  assert.equal(calls.some((call) => call.method === "updateMany"), false);
});
