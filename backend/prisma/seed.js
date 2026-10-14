const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const categories = [
  {
    name: "Thời trang",
    slug: "thoi-trang",
    products: [
      {
        name: "Áo thun basic",
        slug: "ao-thun-basic",
        description: "Áo thun cotton mềm mại, phù hợp mặc hằng ngày.",
        price: "250000",
        stock: 30,
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85"
      },
      {
        name: "Áo khoác denim",
        slug: "ao-khoac-denim",
        description: "Áo khoác denim trẻ trung, dễ phối đồ.",
        price: "690000",
        stock: 12,
        image: "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=900&q=85"
      }
    ]
  },
  {
    name: "Giày dép",
    slug: "giay-dep",
    products: [
      {
        name: "Giày sneaker",
        slug: "giay-sneaker",
        description: "Giày sneaker năng động, êm chân khi di chuyển.",
        price: "850000",
        stock: 18,
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85"
      }
    ]
  },
  {
    name: "Phụ kiện",
    slug: "phu-kien",
    products: [
      {
        name: "Túi đeo chéo",
        slug: "tui-deo-cheo",
        description: "Túi đeo chéo gọn nhẹ cho những chuyến đi.",
        price: "420000",
        stock: 20,
        image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85"
      }
    ]
  }
];

async function main() {
  for (const categoryData of categories) {
    const { products, ...categoryFields } = categoryData;
    const category = await prisma.category.upsert({
      where: { slug: categoryFields.slug },
      update: categoryFields,
      create: categoryFields
    });

    for (const product of products) {
      await prisma.product.upsert({
        where: { slug: product.slug },
        update: { categoryId: category.id },
        create: { ...product, categoryId: category.id }
      });
    }
  }
}

main()
  .catch((error) => {
    console.error("Không thể tạo dữ liệu mẫu:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
