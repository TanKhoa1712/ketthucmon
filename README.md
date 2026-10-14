# Web Bán Hàng

Dự án website bán hàng theo kiến trúc Frontend – Backend tách biệt, có JWT, Swagger và Docker Compose.

## Công nghệ

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- ORM: Prisma
- Auth: JWT + bcryptjs
- API docs: Swagger UI
- Docker: Docker Compose

## Chức năng

- Đăng ký/đăng nhập JWT; mật khẩu được hash bằng bcrypt.
- Danh sách sản phẩm, tìm kiếm theo tên, lọc danh mục và xem tồn kho.
- Giỏ hàng, đặt hàng COD và lịch sử đơn hàng.
- Trang quản trị cho role `ADMIN`: quản lý sản phẩm, danh mục và tiến độ đơn hàng; các API quản trị đều xác thực role ở Backend.
- Prisma đồng bộ schema và tạo dữ liệu danh mục/sản phẩm mẫu khi backend chạy trong Docker.

## Cấu trúc dự án

```text
web-ban-hang/
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── README.md
└── .gitignore
```

## Chạy local

### 1. Backend

```bash
cd backend
Copy-Item .env.example .env
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

`DATABASE_URL` trong file `.env` local cần trỏ đến PostgreSQL đang chạy trên máy.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Docker Compose

```bash
docker compose up --build -d
docker compose ps
```

Compose waits for PostgreSQL to become healthy before starting the backend, then waits for the backend health check before starting the frontend. If a service does not start, inspect its logs with `docker compose logs backend`.

## API

- Backend: http://localhost:5000
- Swagger: http://localhost:5000/api-docs
- Frontend: http://localhost:3000
- API sản phẩm: `GET /api/products?search=ao&categoryId=1&page=1&limit=12`
- API đơn hàng: `POST /api/orders`, `GET /api/orders/my-orders` (JWT)
- Đăng nhập bằng tài khoản `ADMIN` để mở mục **Quản trị** trên giao diện.

Khi phát triển frontend bên ngoài Docker (`npm run dev`), Vite chạy tại http://localhost:5173 và backend đã bật CORS cho cả hai địa chỉ frontend.

Các route tạo/cập nhật sản phẩm, danh mục và cập nhật trạng thái đơn hàng yêu cầu JWT của tài khoản có role `ADMIN`. Trong môi trường đồ án local, có thể đăng ký tài khoản trước rồi nâng role bằng lệnh:

```powershell
'UPDATE "User" SET role = ''ADMIN'' WHERE email = ''you@example.test'';' | docker compose exec -T postgres psql -U webbanhang -d webbanhang
```

## Lưu ý bảo mật

- Không commit file `.env` chứa secret.
- Giữ JWT_SECRET riêng và khác nhau giữa môi trường local và production.
- Không dùng JWT secret mặc định hoặc thông tin PostgreSQL trong Compose cho production.
