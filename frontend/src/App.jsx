import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import AdminDashboard from "./components/AdminDashboard";
import { apiRequest } from "./services/api";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const orderStatus = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
};

function App() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeView, setActiveView] = useState("shop");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );
  const cartTotal = useMemo(
    () => cart.reduce((total, item) => total + Number(item.price) * item.quantity, 0),
    [cart],
  );

  useEffect(() => {
    let active = true;
    apiRequest("/api/categories")
      .then((result) => {
        if (active) setCategories(result.data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (categoryId) query.set("categoryId", categoryId);
    apiRequest(`/api/products?${query.toString()}`, { signal: controller.signal })
      .then((result) => {
        setProducts(result.data);
        setLoadingProducts(false);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") {
          setError(loadError.message);
          setLoadingProducts(false);
        }
      });
    return () => controller.abort();
  }, [search, categoryId]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    apiRequest("/api/auth/me", { token })
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch((authError) => {
        if (!active) return;
        if (authError.status === 401 || authError.status === 404) {
          signOut();
          setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        } else {
          setError(authError.message);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (activeView !== "orders" || !token) return;
    let active = true;
    apiRequest("/api/orders", { token })
      .then((result) => {
        if (active) setOrders(result.data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, [activeView, token]);

  function signOut() {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
    setOrders([]);
    setActiveView("shop");
    setNotice("Bạn đã đăng xuất.");
  }

  function addToCart(product) {
    const existing = cart.find((item) => item.id === product.id);
    if (existing && existing.quantity >= product.stock) {
      setError("Số lượng trong giỏ đã đạt giới hạn tồn kho.");
      return;
    }
    if (!existing && product.stock < 1) {
      setError("Sản phẩm hiện đã hết hàng.");
      return;
    }
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === product.id);
      if (existing) {
        return currentCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...currentCart, { ...product, quantity: 1 }];
    });
    setError("");
    setNotice(`Đã thêm ${product.name} vào giỏ hàng.`);
  }

  function updateQuantity(productId, quantity) {
    setCart((currentCart) =>
      currentCart
        .map((item) => (item.id === productId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      email: form.get("email"),
      password: form.get("password"),
    };
    if (authMode === "register") body.name = form.get("name");

    setBusy(true);
    setError("");
    try {
      const result = await apiRequest(`/api/auth/${authMode === "register" ? "register" : "login"}`, {
        method: "POST",
        body,
      });
      localStorage.setItem("token", result.token);
      setToken(result.token);
      setUser(result.user);
      setAuthOpen(false);
      setNotice(authMode === "register" ? "Tạo tài khoản thành công." : "Đăng nhập thành công.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitOrder(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/orders", {
        method: "POST",
        token,
        body: {
          items: cart.map(({ id, quantity }) => ({ productId: id, quantity })),
          shippingName: form.get("shippingName"),
          shippingPhone: form.get("shippingPhone"),
          shippingAddress: form.get("shippingAddress"),
        },
      });
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
      return;
    }
    setBusy(false);
    setCart([]);
    setCheckoutOpen(false);
    setNotice("Đặt hàng thành công! Đơn hàng sẽ được thanh toán khi nhận hàng.");
    try {
      const [history, refreshedProducts] = await Promise.all([
        apiRequest("/api/orders/my-orders", { token }),
        apiRequest("/api/products"),
      ]);
      setOrders(history.data);
      setProducts(refreshedProducts.data);
    } catch (refreshError) {
      setError(`Đơn hàng đã được ghi nhận nhưng không thể tải lại dữ liệu: ${refreshError.message}`);
    }
    setActiveView("orders");
  }

  function showOrders() {
    setError("");
    if (!token) {
      setAuthMode("login");
      setAuthOpen(true);
      setNotice("Đăng nhập để xem lịch sử đơn hàng.");
      return;
    }
    setActiveView("orders");
  }

  const handleAdminFeedback = useCallback((message, isError = false) => {
    setNotice(isError ? "" : message);
    setError(isError ? message : "");
  }, []);

  return (
    <div className="store">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => setActiveView("shop")}>
          <span className="brand-mark">K</span>
          <span>KShop<small>SHOP CỦA KHOA</small></span>
        </a>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <button className={activeView === "shop" ? "nav-link active" : "nav-link"} onClick={() => setActiveView("shop")}>Cửa hàng</button>
          <button className={activeView === "orders" ? "nav-link active" : "nav-link"} onClick={showOrders}>Đơn hàng</button>
          {user?.role === "ADMIN" && <button className={activeView === "admin" ? "nav-link active" : "nav-link"} onClick={() => setActiveView("admin")}>Quản trị</button>}
        </nav>
        <div className="account-actions">
          <button className="text-button mobile-orders-link" onClick={showOrders}>Đơn hàng</button>
          {user?.role === "ADMIN" && <button className="text-button mobile-admin-link" onClick={() => setActiveView("admin")}>Quản trị</button>}
          {user ? (
            <>
              <span className="welcome">Xin chào, {user.name}</span>
              <button className="text-button" onClick={signOut}>Đăng xuất</button>
            </>
          ) : (
            <button className="text-button" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>Đăng nhập</button>
          )}
          <button className="cart-trigger" onClick={() => { setActiveView("shop"); document.getElementById("cart")?.scrollIntoView({ behavior: "smooth" }); }} aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}>
            Giỏ hàng <span>{cartCount}</span>
          </button>
        </div>
      </header>

      <main>
        {activeView === "admin" && user?.role === "ADMIN" ? (
          <AdminDashboard token={token} onFeedback={handleAdminFeedback} />
        ) : activeView === "shop" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <p className="eyebrow">BỘ SƯU TẬP MỚI · 2026</p>
                <h1>Những món đồ<br />cho ngày <em>thật đẹp.</em></h1>
                <p className="hero-description">Tuyển chọn sản phẩm chất lượng, thiết kế tinh tế và đồng hành cùng bạn mỗi ngày.</p>
                <a className="primary-button hero-button" href="#products">Khám phá ngay <span>↗</span></a>
              </div>
              <div className="hero-art" role="img" aria-label="Bộ sưu tập thời trang phong cách">
                <div className="hero-note"><span>CURATED FOR YOU</span><strong>Simple things,<br />better days.</strong></div>
              </div>
              <div className="hero-index">01 <span>/</span> 03</div>
            </section>

            <section className="catalog" id="products">
              <div className="section-heading">
                <div><p className="eyebrow">CỬA HÀNG CỦA CHÚNG TÔI</p><h2>Được yêu thích</h2></div>
                <span className="product-count">{products.length} sản phẩm</span>
              </div>
              <form className="filters" onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); }}>
                <label className="search-box">
                  <span aria-hidden="true">⌕</span>
                  <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm sản phẩm..." aria-label="Tìm sản phẩm" />
                </label>
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Lọc theo danh mục">
                  <option value="">Tất cả danh mục</option>
                  {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                </select>
                <button className="filter-button" type="submit">Tìm kiếm</button>
              </form>

              {loadingProducts ? (
                <div className="empty-state"><span>· · ·</span><h3>Đang tải sản phẩm</h3><p>Chờ một chút nhé.</p></div>
              ) : products.length ? (
                <div className="product-grid">
                  {products.map((product, index) => (
                    <article className="product-card" key={product.id}>
                      <div className={`product-image image-tone-${index % 4}`}>
                        {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <span className="image-placeholder">K.</span>}
                        {product.stock > 0 && product.stock < 5 && <span className="stock-badge">Sắp hết</span>}
                        <button className="quick-add" onClick={() => addToCart(product)} disabled={product.stock < 1} aria-label={`Thêm ${product.name} vào giỏ`}>+</button>
                      </div>
                      <div className="product-meta"><span>{product.category?.name || "Sản phẩm"}</span><span>Còn {product.stock}</span></div>
                      <h3>{product.name}</h3>
                      <div className="product-bottom"><strong>{money.format(Number(product.price))}</strong><button onClick={() => addToCart(product)} disabled={product.stock < 1}>{product.stock < 1 ? "Hết hàng" : "Thêm vào giỏ"}</button></div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><span>⌕</span><h3>Chưa tìm thấy sản phẩm</h3><p>Thử đổi từ khóa hoặc danh mục bạn nhé.</p></div>
              )}
            </section>

            <section className="shopping-area" id="cart">
              <div className="cart-panel">
                <div className="section-heading compact"><div><p className="eyebrow">TÚI MUA SẮM</p><h2>Giỏ hàng <span className="inline-count">{cartCount}</span></h2></div></div>
                {cart.length ? (
                  <>
                    <div className="cart-items">
                      {cart.map((item) => (
                        <div className="cart-item" key={item.id}>
                          <img src={item.image || ""} alt="" />
                          <div className="cart-item-info"><strong>{item.name}</strong><span>{money.format(Number(item.price))}</span></div>
                          <div className="quantity-control">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label={`Giảm số lượng ${item.name}`}>−</button>
                            <span>{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, Math.min(item.stock, item.quantity + 1))} aria-label={`Tăng số lượng ${item.name}`} disabled={item.quantity >= item.stock}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="cart-total"><span>Tạm tính</span><strong>{money.format(cartTotal)}</strong></div>
                    <button className="primary-button checkout-button" onClick={() => {
                      if (!token) { setAuthMode("login"); setAuthOpen(true); setNotice("Đăng nhập để tiếp tục đặt hàng."); return; }
                      setCheckoutOpen(true);
                    }}>Tiến hành đặt hàng <span>→</span></button>
                  </>
                ) : <p className="muted-empty">Giỏ hàng đang trống. Thêm món bạn thích nhé.</p>}
              </div>

              {checkoutOpen && (
                <form className="checkout-panel" onSubmit={submitOrder}>
                  <button type="button" className="close-button" onClick={() => setCheckoutOpen(false)} aria-label="Đóng">×</button>
                  <p className="eyebrow">GIAO HÀNG COD</p>
                  <h2>Thông tin nhận hàng</h2>
                  <label>Họ và tên<input name="shippingName" defaultValue={user?.name || ""} required minLength="2" maxLength="80" /></label>
                  <label>Số điện thoại<input name="shippingPhone" type="tel" required minLength="8" maxLength="20" /></label>
                  <label>Địa chỉ nhận hàng<textarea name="shippingAddress" required minLength="8" rows="3" /></label>
                  <button className="primary-button checkout-button" disabled={busy}>{busy ? "Đang xử lý..." : "Xác nhận đặt hàng"}</button>
                </form>
              )}
            </section>
          </>
        ) : (
          <section className="orders-section">
            <div className="section-heading"><div><p className="eyebrow">THEO DÕI MUA SẮM</p><h2>Đơn hàng của bạn</h2></div><button className="filter-button" onClick={() => setActiveView("shop")}>Tiếp tục mua sắm</button></div>
            {orders.length ? <div className="orders-list">{orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-heading"><div><span className="order-number">ĐƠN HÀNG #{order.id}</span><span className="order-date">{new Date(order.createdAt).toLocaleDateString("vi-VN")}</span></div><span className={`status-pill status-${order.status.toLowerCase()}`}>{orderStatus[order.status] || order.status}</span></div>
                <div className="order-products">{order.items.map((item) => <div className="order-product" key={item.id}><span>{item.product.name} × {item.quantity}</span><strong>{money.format(Number(item.price) * item.quantity)}</strong></div>)}</div>
                <div className="order-total"><span>Thanh toán khi nhận hàng</span><strong>{money.format(Number(order.total))}</strong></div>
              </article>
            ))}</div> : <div className="empty-state"><span>♡</span><h3>Bạn chưa có đơn hàng</h3><p>Các đơn đã đặt sẽ xuất hiện tại đây.</p><button className="primary-button" onClick={() => setActiveView("shop")}>Khám phá sản phẩm</button></div>}
          </section>
        )}
      </main>

      <footer className="footer"><a className="brand footer-brand" href="#" onClick={() => setActiveView("shop")}><span className="brand-mark">K</span><span>KShop<small>SHOP CỦA KHOA</small></span></a><p>Mua sắm có chọn lọc, sống vui mỗi ngày.</p><span>© 2026 KShop</span></footer>

      {(error || notice) && (
        <div className={error ? "toast toast-error" : "toast"} role={error ? "alert" : "status"}>
          <span>{error || notice}</span>
          <button onClick={() => { setError(""); setNotice(""); }} aria-label="Đóng thông báo">×</button>
        </div>
      )}

      {authOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
          <form className="auth-modal" onSubmit={submitAuth}>
            <button type="button" className="close-button" onClick={() => setAuthOpen(false)} aria-label="Đóng">×</button>
            <span className="brand-mark modal-mark">K</span>
            <p className="eyebrow">{authMode === "register" ? "THAM GIA CÙNG CHÚNG TÔI" : "RẤT VUI ĐƯỢC GẶP LẠI"}</p>
            <h2>{authMode === "register" ? "Tạo tài khoản" : "Đăng nhập"}</h2>
            {authMode === "register" && <label>Họ và tên<input name="name" required minLength="2" maxLength="80" autoComplete="name" /></label>}
            <label>Email<input name="email" type="email" required autoComplete="email" /></label>
            <label>Mật khẩu<input name="password" type="password" required minLength="8" maxLength="72" autoComplete={authMode === "register" ? "new-password" : "current-password"} /></label>
            <button className="primary-button checkout-button" disabled={busy}>{busy ? "Đang xử lý..." : authMode === "register" ? "Tạo tài khoản" : "Đăng nhập"}</button>
            <p className="auth-switch">{authMode === "register" ? "Đã có tài khoản?" : "Chưa có tài khoản?"} <button type="button" onClick={() => setAuthMode(authMode === "register" ? "login" : "register")}>{authMode === "register" ? "Đăng nhập" : "Đăng ký ngay"}</button></p>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
