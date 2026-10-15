const nodemailer = require("nodemailer");

const orderStatusLabels = {
  NOT_REQUIRED: "Thanh toán khi nhận hàng (COD)",
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán thành công",
  FAILED: "Thanh toán thất bại"
};

let transporter;
let disabledWarningLogged = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function smtpConfiguration() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  const port = Number(SMTP_PORT || 587);
  if (!SMTP_HOST && !SMTP_USER && !SMTP_PASS && !MAIL_FROM) return null;
  if (!SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535 ||
      !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
    const error = new Error("Cấu hình SMTP chưa đầy đủ hoặc không hợp lệ");
    error.code = "SMTP_CONFIG_INVALID";
    throw error;
  }
  return {
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    user: SMTP_USER,
    pass: SMTP_PASS,
    from: MAIL_FROM
  };
}

function getTransporter(config) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
  }
  return transporter;
}

function amount(total) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(total));
}

function renderOrderItems(items) {
  return items.map((item) =>
    `<li>${escapeHtml(item.product.name)} × ${item.quantity} — ${amount(Number(item.price) * item.quantity)}</li>`
  ).join("");
}

function orderCreatedContent(order, paymentUrl) {
  const paymentLine = order.paymentMethod === "VNPAY" && paymentUrl
    ? `Tiếp tục thanh toán tại: ${paymentUrl}`
    : order.paymentMethod === "QR_TRANSFER"
      ? `Chuyển khoản ViettelPay theo mã QR trên website. Số tiền: ${amount(order.total)}. Nội dung: ${order.paymentRef || `KSHOP-${order.id}`}. Đơn hàng được xác nhận sau khi cửa hàng kiểm tra giao dịch.`
      : "Bạn sẽ thanh toán khi nhận hàng.";
  return {
    subject: `Xác nhận đơn hàng #${order.id} — KShop`,
    text: [
      `Xin chào ${order.shippingName},`,
      `KShop đã tiếp nhận đơn hàng #${order.id}.`,
      ...order.items.map((item) => `${item.product.name} × ${item.quantity}: ${amount(Number(item.price) * item.quantity)}`),
      `Tổng cộng: ${amount(order.total)}`,
      paymentLine
    ].join("\n"),
    html: `<p>Xin chào ${escapeHtml(order.shippingName)},</p>
      <p>KShop đã tiếp nhận đơn hàng <strong>#${order.id}</strong>.</p>
      <ul>${renderOrderItems(order.items)}</ul>
      <p>Tổng cộng: <strong>${amount(order.total)}</strong></p>
      <p>${order.paymentMethod === "VNPAY" && paymentUrl
        ? `Tiếp tục <a href="${escapeHtml(paymentUrl)}">thanh toán VNPay</a>.`
        : escapeHtml(paymentLine)}</p>`
  };
}

function paymentResultContent(order, succeeded) {
  const label = succeeded ? "đã thanh toán thành công" : "chưa hoàn tất";
  return {
    subject: `Cập nhật thanh toán đơn hàng #${order.id} — KShop`,
    text: `Xin chào ${order.shippingName}, thanh toán cho đơn hàng #${order.id} ${label}. Tổng cộng: ${amount(order.total)}.`,
    html: `<p>Xin chào ${escapeHtml(order.shippingName)},</p>
      <p>Thanh toán cho đơn hàng <strong>#${order.id}</strong> ${label}.</p>
      <p>Tổng cộng: <strong>${amount(order.total)}</strong></p>`
  };
}

async function sendOrderNotification(order, content) {
  const recipient = order.user?.email;
  if (!recipient) {
    console.error(`Cannot email order #${order.id}: customer email is unavailable`);
    return false;
  }

  let config;
  try {
    config = smtpConfiguration();
  } catch (error) {
    console.error(`Cannot email order #${order.id}: ${error.message}`);
    return false;
  }
  if (!config) {
    if (!disabledWarningLogged) {
      console.warn("SMTP is not configured; email notifications are disabled");
      disabledWarningLogged = true;
    }
    return false;
  }

  try {
    await getTransporter(config).sendMail({
      from: config.from,
      to: recipient,
      subject: content.subject,
      text: content.text,
      html: content.html
    });
    return true;
  } catch (error) {
    console.error(`Failed to email order #${order.id}:`, error);
    return false;
  }
}

function sendOrderConfirmation(order, paymentUrl) {
  return sendOrderNotification(order, orderCreatedContent(order, paymentUrl));
}

function sendPaymentResult(order, succeeded) {
  return sendOrderNotification(order, paymentResultContent(order, succeeded));
}

module.exports = {
  sendOrderConfirmation,
  sendPaymentResult,
  orderCreatedContent,
  paymentResultContent,
  escapeHtml
};
