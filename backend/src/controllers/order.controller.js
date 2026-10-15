const orderService = require("../services/order.service");

async function create(req, res) {
  const result = await orderService.create(req.body || {}, req.user.id);
  return res.status(201).json({
    success: true,
    data: result.order,
    paymentUrl: result.paymentUrl
  });
}

async function list(req, res) {
  const data = await orderService.list(req.user);
  return res.status(200).json({ success: true, data });
}

async function updateStatus(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Mã đơn hàng không hợp lệ" });
  }
  const order = await orderService.updateStatus(id, req.body?.status);
  return res.status(200).json({ success: true, data: order });
}

async function confirmManualPayment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Mã đơn hàng không hợp lệ" });
  }
  const order = await orderService.confirmManualPayment(id);
  return res.status(200).json({ success: true, data: order });
}

module.exports = { create, list, updateStatus, confirmManualPayment };
