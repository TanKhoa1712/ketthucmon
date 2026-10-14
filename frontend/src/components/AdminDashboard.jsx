import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../services/api";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const statuses = {
  PENDING: { label: "Chờ xác nhận", next: ["CONFIRMED", "CANCELLED"] },
  CONFIRMED: { label: "Đã xác nhận", next: ["SHIPPING", "CANCELLED"] },
  SHIPPING: { label: "Đang giao", next: ["DELIVERED"] },
  DELIVERED: { label: "Đã giao", next: [] },
  CANCELLED: { label: "Đã hủy", next: [] },
};

function fetchAdminData(token) {
  return Promise.all([
    apiRequest("/api/products?limit=100"),
    apiRequest("/api/categories"),
    apiRequest("/api/orders", { token }),
  ]);
}

function AdminDashboard({ token, onFeedback }) {
  const [section, setSection] = useState("products");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [productFormKey, setProductFormKey] = useState(0);
  const [categoryFormKey, setCategoryFormKey] = useState(0);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [productResult, categoryResult, orderResult] = await fetchAdminData(token);
      setProducts(productResult.data);
      setCategories(categoryResult.data);
      setOrders(orderResult.data);
    } catch (error) {
      onFeedback(error.message, true);
    } finally {
      setLoading(false);
    }
  }, [onFeedback, token]);

  useEffect(() => {
    let active = true;
    fetchAdminData(token)
      .then(([productResult, categoryResult, orderResult]) => {
        if (!active) return;
        setProducts(productResult.data);
        setCategories(categoryResult.data);
        setOrders(orderResult.data);
      })
      .catch((error) => {
        if (active) onFeedback(error.message, true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onFeedback, token]);

  async function submitProduct(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      description: form.get("description"),
      price: Number(form.get("price")),
      stock: Number(form.get("stock")),
      image: form.get("image"),
      categoryId: Number(form.get("categoryId")),
    };
    setBusy(true);
    try {
      await apiRequest(editingProduct ? `/api/products/${editingProduct.id}` : "/api/products", {
        method: editingProduct ? "PUT" : "POST",
        token,
        body: payload,
      });
      onFeedback(editingProduct ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm.");
      setEditingProduct(null);
      setProductFormKey((key) => key + 1);
      await refreshData();
    } catch (error) {
      onFeedback(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Xóa sản phẩm “${product.name}”?`)) return;
    try {
      await apiRequest(`/api/products/${product.id}`, { method: "DELETE", token });
      onFeedback("Đã xóa sản phẩm.");
      await refreshData();
    } catch (error) {
      onFeedback(error.message, true);
    }
  }

  async function submitCategory(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await apiRequest(editingCategoryId ? `/api/categories/${editingCategoryId}` : "/api/categories", {
        method: editingCategoryId ? "PUT" : "POST",
        token,
        body: { name: form.get("categoryName") },
      });
      onFeedback(editingCategoryId ? "Đã cập nhật danh mục." : "Đã thêm danh mục.");
      setEditingCategoryId(null);
      setCategoryFormKey((key) => key + 1);
      await refreshData();
    } catch (error) {
      onFeedback(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Xóa danh mục “${category.name}”?`)) return;
    try {
      await apiRequest(`/api/categories/${category.id}`, { method: "DELETE", token });
      onFeedback("Đã xóa danh mục.");
      await refreshData();
    } catch (error) {
      onFeedback(error.message, true);
    }
  }

  async function updateStatus(order, status) {
    setBusy(true);
    try {
      await apiRequest(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        token,
        body: { status },
      });
      onFeedback(`Đã cập nhật đơn hàng #${order.id}.`);
      await refreshData();
    } catch (error) {
      onFeedback(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  const pendingOrders = orders.filter((order) => order.status === "PENDING").length;

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">KSHOP · KHU VỰC QUẢN TRỊ</p>
          <h1>Quản lý cửa hàng</h1>
          <p className="admin-subtitle">Quản lý sản phẩm, danh mục và đơn hàng tại một nơi.</p>
        </div>
        <button className="filter-button" onClick={refreshData} disabled={loading}>↻ &nbsp;Làm mới dữ liệu</button>
      </div>

      <div className="admin-stats">
        <article><span>Tổng sản phẩm</span><strong>{products.length}</strong><small>Đang được bày bán</small></article>
        <article><span>Danh mục</span><strong>{categories.length}</strong><small>Nhóm sản phẩm</small></article>
        <article><span>Tổng đơn hàng</span><strong>{orders.length}</strong><small>Đơn đã tiếp nhận</small></article>
        <article><span>Chờ xử lý</span><strong>{pendingOrders}</strong><small>Cần xác nhận đơn hàng</small></article>
      </div>

      <div className="admin-workspace">
        <nav className="admin-tabs" aria-label="Các mục quản trị">
          <button className={section === "products" ? "admin-tab active" : "admin-tab"} onClick={() => setSection("products")}><span>▦</span>Sản phẩm</button>
          <button className={section === "categories" ? "admin-tab active" : "admin-tab"} onClick={() => setSection("categories")}><span>◇</span>Danh mục</button>
          <button className={section === "orders" ? "admin-tab active" : "admin-tab"} onClick={() => setSection("orders")}><span>▤</span>Đơn hàng{pendingOrders > 0 && <i>{pendingOrders}</i>}</button>
        </nav>

        {section === "products" && (
          <div className="admin-content">
            <div className="admin-section-heading">
              <div><h2>Sản phẩm</h2><p>Thêm mới, chỉnh sửa thông tin và cập nhật tồn kho.</p></div>
              <button className="primary-button" onClick={() => { setEditingProduct(null); setProductFormKey((key) => key + 1); document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>+ &nbsp;Thêm sản phẩm</button>
            </div>

            <form id="product-form" className="admin-form" key={`product-${productFormKey}`} onSubmit={submitProduct}>
              <div className="form-title-row">
                <div><span className="form-step">{editingProduct ? "CHỈNH SỬA" : "SẢN PHẨM MỚI"}</span><h3>{editingProduct ? `Cập nhật ${editingProduct.name}` : "Thông tin sản phẩm"}</h3></div>
                {editingProduct && <button type="button" className="text-button" onClick={() => { setEditingProduct(null); setProductFormKey((key) => key + 1); }}>Hủy chỉnh sửa</button>}
              </div>
              <div className="admin-form-grid">
                <label>Tên sản phẩm<input name="name" required minLength="2" maxLength="120" defaultValue={editingProduct?.name || ""} placeholder="Ví dụ: Áo thun basic" /></label>
                <label>Danh mục<select key={`${productFormKey}-${categories.map((category) => category.id).join("-")}`} name="categoryId" required defaultValue={editingProduct?.categoryId || categories[0]?.id || ""}><option value="" disabled>Chọn danh mục</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
                <label>Giá bán (₫)<input name="price" type="number" required min="0.01" step="0.01" defaultValue={editingProduct ? Number(editingProduct.price) : ""} placeholder="250000" /></label>
                <label>Số lượng tồn<input name="stock" type="number" required min="0" step="1" defaultValue={editingProduct?.stock ?? 0} /></label>
                <label className="form-span">Đường dẫn ảnh<input name="image" type="url" defaultValue={editingProduct?.image || ""} placeholder="https://..." /></label>
                <label className="form-span">Mô tả<textarea name="description" rows="3" maxLength="1000" defaultValue={editingProduct?.description || ""} placeholder="Mô tả ngắn về sản phẩm..." /></label>
              </div>
              <div className="form-actions"><button className="primary-button" disabled={busy || !categories.length}>{busy ? "Đang lưu..." : editingProduct ? "Lưu thay đổi" : "Tạo sản phẩm"}</button>{!categories.length && <span>Hãy tạo danh mục trước khi thêm sản phẩm.</span>}</div>
            </form>

            <div className="admin-list-heading"><h3>Danh sách sản phẩm</h3><span>{products.length} sản phẩm</span></div>
            {loading ? <p className="admin-loading">Đang tải sản phẩm...</p> : products.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>SẢN PHẨM</th><th>DANH MỤC</th><th>GIÁ BÁN</th><th>TỒN KHO</th><th>THAO TÁC</th></tr></thead>
                  <tbody>{products.map((product) => (
                    <tr key={product.id}>
                      <td><div className="admin-product-cell">{product.image ? <img src={product.image} alt="" /> : <span className="admin-image-placeholder">K</span>}<span><strong>{product.name}</strong><small>{product.slug}</small></span></div></td>
                      <td>{product.category?.name || "—"}</td>
                      <td className="admin-price">{money.format(Number(product.price))}</td>
                      <td><span className={product.stock < 5 ? "inventory low" : "inventory"}>{product.stock} chiếc</span></td>
                      <td><div className="row-actions"><button onClick={() => { setEditingProduct(product); setProductFormKey((key) => key + 1); document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Sửa</button><button className="danger-action" onClick={() => deleteProduct(product)}>Xóa</button></div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="admin-empty">Chưa có sản phẩm nào.</p>}
          </div>
        )}

        {section === "categories" && (
          <div className="admin-content">
            <div className="admin-section-heading"><div><h2>Danh mục</h2><p>Sắp xếp sản phẩm thành những nhóm dễ tìm.</p></div></div>
            <form className="category-create-form" key={`category-${categoryFormKey}`} onSubmit={submitCategory}>
              <label>{editingCategoryId ? "Tên danh mục mới" : "Tên danh mục"}<input name="categoryName" required minLength="2" maxLength="80" defaultValue={categories.find((category) => category.id === editingCategoryId)?.name || ""} placeholder="Ví dụ: Đồ gia dụng" /></label>
              <button className="primary-button" disabled={busy}>{busy ? "Đang lưu..." : editingCategoryId ? "Lưu thay đổi" : "Thêm danh mục"}</button>
              {editingCategoryId && <button type="button" className="filter-button" onClick={() => { setEditingCategoryId(null); setCategoryFormKey((key) => key + 1); }}>Hủy</button>}
            </form>
            {loading ? <p className="admin-loading">Đang tải danh mục...</p> : (
              <div className="category-admin-list">
                {categories.map((category) => (
                  <article className="category-admin-card" key={category.id}>
                    <span className="category-icon">◇</span>
                    <div><strong>{category.name}</strong><small>{category._count.products} sản phẩm · /{category.slug}</small></div>
                    <div className="row-actions"><button onClick={() => { setEditingCategoryId(category.id); setCategoryFormKey((key) => key + 1); }}>Sửa tên</button><button className="danger-action" onClick={() => deleteCategory(category)}>Xóa</button></div>
                  </article>
                ))}
                {!categories.length && <p className="admin-empty">Chưa có danh mục nào.</p>}
              </div>
            )}
          </div>
        )}

        {section === "orders" && (
          <div className="admin-content">
            <div className="admin-section-heading"><div><h2>Đơn hàng</h2><p>Xem đơn đặt COD và cập nhật tiến độ giao hàng.</p></div><span className="admin-order-count">{orders.length} đơn hàng</span></div>
            {loading ? <p className="admin-loading">Đang tải đơn hàng...</p> : orders.length ? (
              <div className="admin-orders-list">{orders.map((order) => (
                <article className="admin-order-card" key={order.id}>
                  <div className="admin-order-top">
                    <div><span className="order-number">ĐƠN HÀNG #{order.id}</span><span className="order-date">{new Date(order.createdAt).toLocaleString("vi-VN")}</span></div>
                    <span className={`status-pill status-${order.status.toLowerCase()}`}>{statuses[order.status]?.label || order.status}</span>
                  </div>
                  <div className="admin-order-body">
                    <div className="admin-customer"><span>NGƯỜI NHẬN</span><strong>{order.shippingName}</strong><small>{order.shippingPhone}</small><small>{order.shippingAddress}</small><small>Đặt bởi: {order.user.name} · {order.user.email}</small></div>
                    <div className="admin-order-items"><span>SẢN PHẨM</span>{order.items.map((item) => <p key={item.id}>{item.product.name} <small>× {item.quantity}</small><strong>{money.format(Number(item.price) * item.quantity)}</strong></p>)}</div>
                  </div>
                  <div className="admin-order-bottom"><div><span>Thanh toán COD</span><strong>{money.format(Number(order.total))}</strong></div>
                    {statuses[order.status]?.next.length ? (
                      <label className="status-control">Cập nhật trạng thái<select value="" disabled={busy} onChange={(event) => updateStatus(order, event.target.value)}><option value="" disabled>Chọn trạng thái</option>{statuses[order.status].next.map((status) => <option value={status} key={status}>{statuses[status].label}</option>)}</select></label>
                    ) : <span className="status-final">Đơn hàng đã hoàn tất</span>}
                  </div>
                </article>
              ))}</div>
            ) : <div className="admin-empty order-empty">Chưa có đơn hàng nào.</div>}
          </div>
        )}
      </div>
    </section>
  );
}

export default AdminDashboard;
