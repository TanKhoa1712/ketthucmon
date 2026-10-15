const orderModel = require("../models/order.model");

function validateOrder(input, userId) {
  const { items, shippingName, shippingPhone, shippingAddress } = input;
  const paymentMethod = input.paymentMethod || "COD";
  if (!["COD", "QR_TRANSFER"].includes(paymentMethod)) {
    const error = new Error("Phương thức thanh toán không hợp lệ");
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    const error = new Error("Giỏ hàng phải có từ 1 đến 50 sản phẩm");
    error.statusCode = 400;
    throw error;
  }

  const quantities = new Map();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      const error = new Error("Mỗi sản phẩm trong giỏ hàng phải có mã và số lượng hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1) {
      const error = new Error("Sản phẩm hoặc số lượng không hợp lệ");
      error.statusCode = 400;
      throw error;
    }
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }

  for (const quantity of quantities.values()) {
    if (quantity > 100) {
      const error = new Error("Số lượng mỗi sản phẩm không được vượt quá 100");
      error.statusCode = 400;
      throw error;
    }
  }

  const normalizedName = typeof shippingName === "string" ? shippingName.trim() : "";
  const normalizedPhone = typeof shippingPhone === "string" ? shippingPhone.trim() : "";
  const normalizedAddress = typeof shippingAddress === "string" ? shippingAddress.trim() : "";
  if (normalizedName.length < 2 || normalizedName.length > 80 ||
      !/^[+0-9().\-\s]{8,20}$/.test(normalizedPhone) ||
      normalizedAddress.length < 8 || normalizedAddress.length > 500) {
    const error = new Error("Thông tin nhận hàng không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  return {
    userId,
    items: [...quantities].map(([productId, quantity]) => ({ productId, quantity })),
    shippingName: normalizedName,
    shippingPhone: normalizedPhone,
    shippingAddress: normalizedAddress,
    paymentMethod
  };
}

async function create(input, userId) {
  const orderData = validateOrder(input, userId);
  const order = await orderModel.createOrder(orderData);
  await require("./email.service").sendOrderConfirmation(order, null);
  return { order, paymentUrl: null };
}

function list(user) {
  return orderModel.listOrders({
    userId: user.id,
    isAdmin: user.role === "ADMIN"
  });
}

async function updateStatus(id, status) {
  const statuses = ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"];
  if (!statuses.includes(status)) {
    const error = new Error("Trạng thái đơn hàng không hợp lệ");
    error.statusCode = 400;
    throw error;
  }
  return orderModel.updateOrderStatus(id, status);
}

function processVnpayCallback(params) {
  return require("./vnpay.service").processCallback(params);
}

function confirmManualPayment(id) {
  return orderModel.confirmManualPayment(id);
}

module.exports = { create, list, updateStatus, processVnpayCallback, confirmManualPayment };
