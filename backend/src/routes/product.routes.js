const express = require("express");
const router = express.Router();

/**
 * @openapi
 * /api/products:
 *   get:
 *     summary: Lấy danh sách sản phẩm
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm
 */
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      {
        id: 1,
        name: "Áo thun nam",
        price: 250000,
        category: "Thời trang",
        image: "https://via.placeholder.com/300"
      },
      {
        id: 2,
        name: "Giày sneaker",
        price: 550000,
        category: "Giày dép",
        image: "https://via.placeholder.com/300"
      }
    ]
  });
});

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     summary: Lấy chi tiết sản phẩm
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chi tiết sản phẩm
 */
router.get("/:id", (req, res) => {
  const { id } = req.params;

  res.status(200).json({
    success: true,
    data: {
      id: Number(id),
      name: "Áo thun nam",
      price: 250000,
      category: "Thời trang",
      description: "Sản phẩm mẫu",
      stock: 25
    }
  });
});

module.exports = router;
