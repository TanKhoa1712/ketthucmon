const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const modelPath = require.resolve("../src/models/order.model");
const emailPath = require.resolve("../src/services/email.service");
const servicePath = require.resolve("../src/services/vnpay.service");
const originalModel = require.cache[modelPath];
const originalEmail = require.cache[emailPath];
const previousEnvironment = {
  VNPAY_TMN_CODE: process.env.VNPAY_TMN_CODE,
  VNPAY_HASH_SECRET: process.env.VNPAY_HASH_SECRET,
  VNPAY_URL: process.env.VNPAY_URL,
  VNPAY_RETURN_URL: process.env.VNPAY_RETURN_URL,
  VNPAY_IPN_URL: process.env.VNPAY_IPN_URL
};
const secret = "test-hmac-secret";
const calls = [];
let paymentOrder = {
  id: 42,
  total: "250000.00",
  paymentMethod: "VNPAY",
  paymentStatus: "PENDING"
};
let applyResult;

process.env.VNPAY_TMN_CODE = "TEST1234";
process.env.VNPAY_HASH_SECRET = secret;
process.env.VNPAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
process.env.VNPAY_RETURN_URL = "https://shop.example.test/api/payments/vnpay/return";
process.env.VNPAY_IPN_URL = "https://api.example.test/api/payments/vnpay/ipn";

require.cache[modelPath] = {
  id: modelPath,
  filename: modelPath,
  loaded: true,
  exports: {
    findPaymentOrder: async (paymentRef) => {
      calls.push({ method: "findPaymentOrder", paymentRef });
      return paymentOrder;
    },
    applyVnpayResult: async (paymentRef, succeeded, transactionNo) => {
      calls.push({ method: "applyVnpayResult", paymentRef, succeeded, transactionNo });
      return applyResult || {
        orderId: paymentOrder.id,
        paymentStatus: succeeded ? "PAID" : "FAILED"
      };
    }
  }
};

require.cache[emailPath] = {
  id: emailPath,
  filename: emailPath,
  loaded: true,
  exports: {
    sendPaymentResult: async (...args) => calls.push({ method: "sendPaymentResult", args })
  }
};

const vnpayService = require(servicePath);

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
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function callbackParameters(overrides = {}) {
  const params = {
    vnp_TmnCode: "TEST1234",
    vnp_TxnRef: "VNPAY-42-1760000000000",
    vnp_Amount: "25000000",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "987654321",
    vnp_SecureHashType: "HMAC-SHA512",
    ...overrides
  };
  params.vnp_SecureHash = vnpayService.signature(params, secret);
  return params;
}

test("creates a signed VNPay sandbox URL with VND amount and return data", () => {
  const url = new URL(vnpayService.createPaymentUrl({
    id: 42,
    total: "1234.56",
    paymentRef: "VNPAY-42-1760000000000"
  }, "::1"));
  const params = Object.fromEntries(url.searchParams.entries());

  assert.equal(url.origin, "https://sandbox.vnpayment.vn");
  assert.equal(params.vnp_Amount, "123500");
  assert.equal(params.vnp_IpAddr, "127.0.0.1");
  assert.equal(params.vnp_ReturnUrl, "https://shop.example.test/api/payments/vnpay/return");
  assert.equal(params.vnp_SecureHash.length, 128);
  assert.equal(vnpayService.verifySignature(params, secret), true);
});

test("requires merchant credentials before enabling VNPay", () => {
  delete process.env.VNPAY_TMN_CODE;
  assert.throws(vnpayService.assertConfigured, {
    message: "VNPay chưa được cấu hình trên máy chủ",
    statusCode: 503,
    expose: true
  });
  process.env.VNPAY_TMN_CODE = "TEST1234";
});

test("accepts a correctly signed successful callback and ignores signature metadata", async () => {
  calls.length = 0;
  const result = await vnpayService.processCallback(callbackParameters());

  assert.deepEqual(result, {
    code: "00",
    message: "Confirm success",
    orderId: 42,
    paymentStatus: "PAID",
    succeeded: true
  });
  assert.equal(calls[1].succeeded, true);
  assert.equal(calls[2].method, "sendPaymentResult");
});

test("rejects altered callback parameters before looking up an order", async () => {
  calls.length = 0;
  const params = callbackParameters();
  params.vnp_Amount = "1";

  const result = await vnpayService.processCallback(params);

  assert.equal(result.code, "97");
  assert.equal(calls.length, 0);
});

test("rejects duplicate query values instead of accepting ambiguous signatures", async () => {
  calls.length = 0;
  const params = callbackParameters();
  params.vnp_Amount = ["25000000", "1"];

  const result = await vnpayService.processCallback(params);

  assert.equal(result.code, "97");
  assert.equal(calls.length, 0);
});

test("rejects a signed callback when the amount differs from the order total", async () => {
  calls.length = 0;
  const result = await vnpayService.processCallback(callbackParameters({ vnp_Amount: "24999900" }));

  assert.equal(result.code, "04");
  assert.equal(result.orderId, 42);
  assert.equal(calls.some((call) => call.method === "applyVnpayResult"), false);
});

test("records signed unsuccessful transactions as failed payments", async () => {
  calls.length = 0;
  const result = await vnpayService.processCallback(callbackParameters({
    vnp_ResponseCode: "24",
    vnp_TransactionStatus: "02"
  }));

  assert.equal(result.code, "00");
  assert.equal(result.succeeded, false);
  assert.equal(calls[1].succeeded, false);
});

test("does not send duplicate payment notifications for retried callbacks", async () => {
  calls.length = 0;
  applyResult = { orderId: 42, paymentStatus: "PAID", duplicate: true };

  const result = await vnpayService.processCallback(callbackParameters());

  assert.equal(result.code, "00");
  assert.equal(calls.some((call) => call.method === "sendPaymentResult"), false);
  applyResult = undefined;
});
