const crypto = require("node:crypto");
const querystring = require("node:querystring");
const orderModel = require("../models/order.model");

function configuration() {
  const tmnCode = process.env.VNPAY_TMN_CODE;
  const hashSecret = process.env.VNPAY_HASH_SECRET;
  if (!tmnCode || !hashSecret) {
    const error = new Error("VNPay chưa được cấu hình trên máy chủ");
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }

  const backendUrl = process.env.BACKEND_PUBLIC_URL || "http://localhost:5000";
  const returnUrl = process.env.VNPAY_RETURN_URL ||
    `${backendUrl.replace(/\/$/, "")}/api/payments/vnpay/return`;
  const config = {
    tmnCode,
    hashSecret,
    paymentUrl: process.env.VNPAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    returnUrl
  };
  for (const value of [config.paymentUrl, config.returnUrl]) {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) ||
        (process.env.NODE_ENV === "production" && url.protocol !== "https:")) {
      const error = new Error("URL VNPay phải dùng HTTP hoặc HTTPS (HTTPS trong production)");
      error.statusCode = 500;
      throw error;
    }
  }
  return config;
}

function sortedParameters(params) {
  return Object.keys(params)
    .filter((key) =>
      key.startsWith("vnp_") &&
      key !== "vnp_SecureHash" &&
      key !== "vnp_SecureHashType" &&
      params[key] !== undefined &&
      params[key] !== "")
    .sort()
    .reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {});
}

function signature(params, secret) {
  const data = querystring.stringify(sortedParameters(params));
  return crypto.createHmac("sha512", secret).update(data, "utf8").digest("hex");
}

function verifySignature(params, secret) {
  const provided = params.vnp_SecureHash;
  if (typeof provided !== "string" || !/^[a-f\d]{128}$/i.test(provided)) return false;
  if (!Object.entries(params).every(([key, value]) =>
    !key.startsWith("vnp_") || typeof value === "string")) return false;
  const expected = Buffer.from(signature(params, secret), "hex");
  const actual = Buffer.from(provided, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function vnpayTimestamp(date = new Date()) {
  const fields = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${fields.year}${fields.month}${fields.day}${fields.hour}${fields.minute}${fields.second}`;
}

function amountInDong(total) {
  const amount = Math.round(Number(total));
  if (!Number.isSafeInteger(amount) || amount < 1) {
    const error = new Error("Tổng tiền đơn hàng không hợp lệ để thanh toán VNPay");
    error.statusCode = 400;
    throw error;
  }
  return amount;
}

function assertConfigured() {
  configuration();
}

function createPaymentUrl(order, ipAddress) {
  const config = configuration();
  const amount = amountInDong(order.total);
  const address = typeof ipAddress === "string" ? ipAddress : "";
  const normalizedAddress = address === "::1"
    ? "127.0.0.1"
    : address.replace(/^::ffff:/, "").slice(0, 45);
  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: order.paymentRef,
    vnp_OrderInfo: `Thanh toan don hang ${order.id}`,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: normalizedAddress || "127.0.0.1",
    vnp_CreateDate: vnpayTimestamp()
  };
  const sorted = sortedParameters(params);
  const secureHash = signature(sorted, config.hashSecret);
  const url = new URL(config.paymentUrl);
  url.search = `${querystring.stringify(sorted)}&vnp_SecureHash=${secureHash}`;
  return url.toString();
}

async function processCallback(params) {
  const config = configuration();
  if (!verifySignature(params, config.hashSecret) || params.vnp_TmnCode !== config.tmnCode) {
    return { code: "97", message: "Invalid signature" };
  }

  const paymentRef = params.vnp_TxnRef;
  if (typeof paymentRef !== "string" || !/^VNPAY-\d+-\d+$/.test(paymentRef)) {
    return { code: "01", message: "Order not found" };
  }

  const order = await orderModel.findPaymentOrder(paymentRef);
  if (!order || order.paymentMethod !== "VNPAY") {
    return { code: "01", message: "Order not found" };
  }
  const expectedAmount = amountInDong(order.total) * 100;
  if (!/^\d+$/.test(params.vnp_Amount || "") || Number(params.vnp_Amount) !== expectedAmount) {
    return { code: "04", message: "Invalid amount", orderId: order.id };
  }

  const succeeded = params.vnp_ResponseCode === "00" &&
    params.vnp_TransactionStatus === "00";
  const result = await orderModel.applyVnpayResult(
    paymentRef,
    succeeded,
    params.vnp_TransactionNo
  );
  if (!result) return { code: "01", message: "Order not found" };
  if (result.conflict) {
    return { code: "02", message: "Order status conflict", orderId: result.orderId };
  }
  if (!result.duplicate) {
    await require("./email.service").sendPaymentResult(order, succeeded);
  }
  return {
    code: "00",
    message: "Confirm success",
    orderId: result.orderId,
    paymentStatus: result.paymentStatus,
    succeeded
  };
}

module.exports = {
  assertConfigured,
  createPaymentUrl,
  processCallback,
  signature,
  verifySignature,
  vnpayTimestamp,
  amountInDong
};
