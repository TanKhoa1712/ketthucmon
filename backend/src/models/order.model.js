const prisma = require("../config/database");

function createOrder(data) {
  return prisma.$transaction(async (transaction) => {
    let total = 0;
    const orderItems = [];

    for (const item of data.items) {
      const product = await transaction.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        const error = new Error(`Không tìm thấy sản phẩm ID ${item.productId}`);
        error.statusCode = 400;
        throw error;
      }

      if (product.stock < item.quantity) {
        const error = new Error(`Sản phẩm "${product.name}" không đủ tồn kho`);
        error.statusCode = 409;
        throw error;
      }

      const price = Number(product.price);
      total += price * item.quantity;
      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price
      });
    }

    for (const item of data.items) {
      const result = await transaction.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } }
      });
      if (result.count !== 1) {
        const error = new Error("Số lượng tồn kho vừa thay đổi, vui lòng tải lại giỏ hàng");
        error.statusCode = 409;
        throw error;
      }
    }

    const order = await transaction.order.create({
      data: {
        userId: data.userId,
        shippingName: data.shippingName,
        shippingPhone: data.shippingPhone,
        shippingAddress: data.shippingAddress,
        paymentMethod: data.paymentMethod,
        paymentStatus: ["VNPAY", "QR_TRANSFER"].includes(data.paymentMethod)
          ? "PENDING"
          : "NOT_REQUIRED",
        total: total.toFixed(2),
        items: { create: orderItems }
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, image: true } } } }
      }
    });
    if (data.paymentMethod === "VNPAY") {
      return transaction.order.update({
        where: { id: order.id },
        data: { paymentRef: `VNPAY-${order.id}-${Date.now()}` },
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { product: { select: { id: true, name: true, image: true } } } }
        }
      });
    }
    if (data.paymentMethod === "QR_TRANSFER") {
      return transaction.order.update({
        where: { id: order.id },
        data: { paymentRef: `KSHOP-${order.id}` },
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { product: { select: { id: true, name: true, image: true } } } }
        }
      });
    }
    return order;
  });
}

function listOrders({ userId, isAdmin }) {
  return prisma.order.findMany({
    where: isAdmin ? {} : { userId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, image: true } } } }
    },
    orderBy: { createdAt: "desc" }
  });
}

function updateOrderStatus(id, status) {
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!order) {
      const error = new Error("Không tìm thấy đơn hàng");
      error.statusCode = 404;
      throw error;
    }
    if (order.status === status) {
      return order;
    }
    if (order.paymentStatus === "PENDING" &&
        ["VNPAY", "QR_TRANSFER"].includes(order.paymentMethod) &&
        status !== "CANCELLED") {
      const error = new Error(order.paymentMethod === "QR_TRANSFER"
        ? "Chỉ xác nhận đơn chuyển khoản sau khi đã xác nhận nhận được tiền"
        : "Chỉ có thể cập nhật đơn VNPay sau khi cổng thanh toán phản hồi");
      error.statusCode = 409;
      throw error;
    }
    if (order.paymentStatus === "PAID" && status === "CANCELLED") {
      const error = new Error("Đơn đã thanh toán online cần được hoàn tiền trước khi hủy");
      error.statusCode = 409;
      throw error;
    }
    const allowedTransitions = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["SHIPPING", "CANCELLED"],
      SHIPPING: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: []
    };
    if (!allowedTransitions[order.status].includes(status)) {
      const error = new Error("Không thể chuyển đơn hàng sang trạng thái này");
      error.statusCode = 409;
      throw error;
    }

    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      const result = await transaction.order.updateMany({
        where: { id, status: order.status },
        data: { status: "CANCELLED" }
      });
      if (result.count !== 1) {
        const latestOrder = await transaction.order.findUnique({ where: { id } });
        if (latestOrder?.status === "CANCELLED") return latestOrder;
        const error = new Error("Trạng thái đơn hàng vừa thay đổi, vui lòng tải lại");
        error.statusCode = 409;
        throw error;
      }
      for (const item of order.items) {
        await transaction.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      }
      return transaction.order.findUnique({ where: { id } });
    }

    const result = await transaction.order.updateMany({
      where: { id, status: order.status },
      data: { status }
    });
    if (result.count !== 1) {
      const error = new Error("Trạng thái đơn hàng vừa thay đổi, vui lòng tải lại");
      error.statusCode = 409;
      throw error;
    }
    return transaction.order.findUnique({ where: { id } });
  });
}

function findPaymentOrder(paymentRef) {
  return prisma.order.findFirst({
    where: { paymentRef },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: { include: { product: { select: { id: true, name: true, image: true } } } }
    }
  });
}

function applyVnpayResult(paymentRef, succeeded, transactionNo) {
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findFirst({
      where: { paymentRef },
      include: { items: true }
    });
    if (!order) return null;

    const expectedStatus = succeeded ? "PAID" : "FAILED";
    if (order.paymentStatus === expectedStatus) {
      return { orderId: order.id, paymentStatus: expectedStatus, duplicate: true };
    }
    if (order.paymentStatus !== "PENDING" || order.status !== "PENDING") {
      return { orderId: order.id, paymentStatus: order.paymentStatus, conflict: true };
    }

    const result = await transaction.order.updateMany({
      where: { id: order.id, status: "PENDING", paymentStatus: "PENDING" },
      data: succeeded
        ? { paymentStatus: "PAID", paymentTxnNo: transactionNo || null, paidAt: new Date() }
        : { paymentStatus: "FAILED", status: "CANCELLED", paymentTxnNo: transactionNo || null }
    });
    if (result.count !== 1) {
      const latestOrder = await transaction.order.findUnique({ where: { id: order.id } });
      if (latestOrder?.paymentStatus === expectedStatus) {
        return { orderId: order.id, paymentStatus: expectedStatus, duplicate: true };
      }
      return { orderId: order.id, paymentStatus: latestOrder?.paymentStatus, conflict: true };
    }

    if (!succeeded) {
      for (const item of order.items) {
        await transaction.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      }
    }
    return { orderId: order.id, paymentStatus: expectedStatus };
  });
}

function confirmManualPayment(id) {
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({ where: { id } });
    if (!order) {
      const error = new Error("Không tìm thấy đơn hàng");
      error.statusCode = 404;
      throw error;
    }
    if (order.paymentMethod !== "QR_TRANSFER") {
      const error = new Error("Đơn hàng này không dùng thanh toán chuyển khoản QR");
      error.statusCode = 409;
      throw error;
    }
    if (order.paymentStatus === "PAID") return order;
    if (order.paymentStatus !== "PENDING" || order.status !== "PENDING") {
      const error = new Error("Không thể xác nhận thanh toán cho đơn hàng này");
      error.statusCode = 409;
      throw error;
    }

    const result = await transaction.order.updateMany({
      where: {
        id,
        paymentMethod: "QR_TRANSFER",
        paymentStatus: "PENDING",
        status: "PENDING"
      },
      data: { paymentStatus: "PAID", paidAt: new Date() }
    });
    if (result.count !== 1) {
      const latestOrder = await transaction.order.findUnique({ where: { id } });
      if (latestOrder?.paymentStatus === "PAID") return latestOrder;
      const error = new Error("Trạng thái đơn hàng vừa thay đổi, vui lòng tải lại");
      error.statusCode = 409;
      throw error;
    }
    return transaction.order.findUnique({ where: { id } });
  });
}

module.exports = {
  createOrder,
  listOrders,
  updateOrderStatus,
  findPaymentOrder,
  applyVnpayResult,
  confirmManualPayment
};
