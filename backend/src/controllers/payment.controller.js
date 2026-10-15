const orderService = require("../services/order.service");

function frontendUrl() {
  const base = process.env.FRONTEND_URL ||
    (process.env.CLIENT_URL || "http://localhost:3000").split(",")[0].trim();
  return new URL("/", base);
}

async function vnpayReturn(req, res) {
  const result = await orderService.processVnpayCallback(req.query);
  const redirectUrl = frontendUrl();
  redirectUrl.searchParams.set("payment", result.succeeded ? "success" : "failed");
  if (result.orderId) redirectUrl.searchParams.set("orderId", String(result.orderId));
  return res.redirect(303, redirectUrl.toString());
}

async function vnpayIpn(req, res) {
  const result = await orderService.processVnpayCallback(req.query);
  return res.status(200).json({ RspCode: result.code, Message: result.message });
}

module.exports = { vnpayReturn, vnpayIpn };
