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

    return transaction.order.create({
      data: {
        userId: data.userId,
        shippingName: data.shippingName,
        shippingPhone: data.shippingPhone,
        shippingAddress: data.shippingAddress,
        total: total.toFixed(2),
        items: { create: orderItems }
      },
      include: {
        items: { include: { product: { select: { id: true, name: true, image: true } } } }
      }
    });
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

module.exports = { createOrder, listOrders, updateOrderStatus };
