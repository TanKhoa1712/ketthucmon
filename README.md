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
cp .env.example .env
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Docker Compose

```bash
docker compose up --build -d
```

## API

- Backend: http://localhost:5000
- Swagger: http://localhost:5000/api-docs
- Frontend: http://localhost:3000

## Lưu ý bảo mật

- Không commit file `.env` chứa secret.
- Giữ JWT_SECRET riêng và khác nhau giữa môi trường local và production.
- Mật khẩu phải được hash trước khi lưu.
