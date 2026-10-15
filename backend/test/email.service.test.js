const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const nodemailerPath = require.resolve("nodemailer");
const servicePath = require.resolve("../src/services/email.service");
const originalNodemailer = require.cache[nodemailerPath];
const previousEnvironment = {};
const sentMessages = [];

for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"]) {
  previousEnvironment[key] = process.env[key];
}
previousEnvironment.TEST_SMTP_FAILURE = process.env.TEST_SMTP_FAILURE;

require.cache[nodemailerPath] = {
  id: nodemailerPath,
  filename: nodemailerPath,
  loaded: true,
  exports: {
    createTransport: (options) => ({
      sendMail: async (message) => {
        if (process.env.TEST_SMTP_FAILURE === "true") {
          throw new Error("SMTP test failure");
        }
        sentMessages.push({ options, message });
        return { messageId: "test-message-id" };
      }
    })
  }
};

const emailService = require(servicePath);

after(() => {
  delete require.cache[servicePath];
  if (originalNodemailer) {
    require.cache[nodemailerPath] = originalNodemailer;
  } else {
    delete require.cache[nodemailerPath];
  }
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function setSmtpConfiguration() {
  process.env.SMTP_HOST = "smtp.example.test";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = "mailer@example.test";
  process.env.SMTP_PASS = "test-password";
  process.env.MAIL_FROM = "KShop <shop@example.test>";
}

test("skips sending and warns once when SMTP is not configured", async () => {
  for (const key of Object.keys(previousEnvironment)) delete process.env[key];
  const previousWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try {
    const order = {
      id: 1,
      total: "0.00",
      shippingName: "Customer",
      paymentMethod: "COD",
      items: [],
      user: { email: "customer@example.test" }
    };
    assert.equal(await emailService.sendOrderConfirmation(order), false);
    assert.equal(await emailService.sendOrderConfirmation({ ...order, id: 2 }), false);
  } finally {
    console.warn = previousWarn;
  }
  assert.equal(warnings.length, 1);
});

test("sends an escaped order confirmation and optional payment link over SMTP", async () => {
  setSmtpConfiguration();
  const order = {
    id: 12,
    total: "250000.00",
    paymentMethod: "VNPAY",
    shippingName: "<script>alert(1)</script>",
    user: { email: "customer@example.test" },
    items: [{ product: { name: "<img src=x>" }, quantity: 1, price: "250000.00" }]
  };
  const sent = await emailService.sendOrderConfirmation(order, "https://sandbox.example.test/pay?a=1&b=2");

  assert.equal(sent, true);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].options.secure, false);
  assert.equal(sentMessages[0].message.to, "customer@example.test");
  assert.match(sentMessages[0].message.subject, /#12/);
  assert.match(sentMessages[0].message.html, /&lt;script&gt;/);
  assert.match(sentMessages[0].message.html, /&lt;img src=x&gt;/);
  assert.match(sentMessages[0].message.html, /a=1&amp;b=2/);
});

test("sends payment outcome notifications to the order customer", async () => {
  setSmtpConfiguration();
  const sent = await emailService.sendPaymentResult({
    id: 12,
    total: "250000.00",
    shippingName: "Customer",
    user: { email: "customer@example.test" }
  }, true);

  assert.equal(sent, true);
  assert.equal(sentMessages.at(-1).message.to, "customer@example.test");
  assert.match(sentMessages.at(-1).message.text, /thanh toán thành công/);
});

test("logs a delivery failure without failing the order workflow", async () => {
  setSmtpConfiguration();
  process.env.TEST_SMTP_FAILURE = "true";
  const previousError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    const sent = await emailService.sendOrderConfirmation({
      id: 13,
      user: { email: "customer@example.test" },
      items: []
    });
    assert.equal(sent, false);
  } finally {
    console.error = previousError;
    delete process.env.TEST_SMTP_FAILURE;
  }
  assert.equal(logged.length, 1);
  assert.match(logged[0][0], /Failed to email order #13/);
});
