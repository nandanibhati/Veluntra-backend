const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const swaggerUi = require("swagger-ui-express");

const env = require("./config/env");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimit");
const openapiSpec = require("./docs");

const authRoutes = require("./modules/auth/auth.routes");
const categoriesRoutes = require("./modules/categories/categories.routes");
const brandsRoutes = require("./modules/brands/brands.routes");
const productsRoutes = require("./modules/products/products.routes");
const cartRoutes = require("./modules/cart/cart.routes");
const couponsRoutes = require("./modules/coupons/coupons.routes");
const shippingRoutes = require("./modules/shipping/shipping.routes");
const ordersRoutes = require("./modules/orders/orders.routes");
const addressesRoutes = require("./modules/addresses/addresses.routes");
const wishlistRoutes = require("./modules/wishlist/wishlist.routes");
const notificationsRoutes = require("./modules/notifications/notifications.routes");
const uploadsRoutes = require("./modules/uploads/uploads.routes");
const adminRoutes = require("./modules/admin/admin.routes");
const sellerRoutes = require("./modules/seller/seller.routes");
const settingsRoutes = require("./modules/settings/settings.routes");
const promotionsRoutes = require("./modules/promotions/promotions.routes");
const statsRoutes = require("./modules/stats/stats.routes");
const featuredReviewsRoutes = require("./modules/reviews/reviews.featured.routes");
const permissionsRoutes = require("./modules/permissions/permissions.routes");
const homepageRoutes = require("./modules/homepage/homepage.routes");

const app = express();

// Trust the first proxy hop (needed for correct req.ip behind a load balancer/reverse proxy in production).
app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, callback) {
      // Native mobile apps send no Origin header at all — always allow those.
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
app.use("/api/v1", apiLimiter);

// Publicly served uploaded files (product images, avatars).
app.use("/uploads", express.static(path.resolve(__dirname, "../", env.uploadDir)));

// API docs
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get("/api/docs.json", (req, res) => res.json(openapiSpec));

app.get("/health", (req, res) => res.json({ success: true, data: { status: "ok", uptime: process.uptime() } }));

const v1 = express.Router();
v1.use("/auth", authRoutes);
v1.use("/categories", categoriesRoutes);
v1.use("/brands", brandsRoutes);
v1.use("/products", productsRoutes);
v1.use("/cart", cartRoutes);
v1.use("/coupons", couponsRoutes);
v1.use("/shipping-methods", shippingRoutes);
v1.use("/orders", ordersRoutes);
v1.use("/addresses", addressesRoutes);
v1.use("/wishlist", wishlistRoutes);
v1.use("/notifications", notificationsRoutes);
v1.use("/uploads", uploadsRoutes);
v1.use("/admin", adminRoutes);
v1.use("/seller", sellerRoutes);
v1.use("/settings", settingsRoutes);
v1.use("/promotions", promotionsRoutes);
v1.use("/stats", statsRoutes);
v1.use("/reviews", featuredReviewsRoutes);
v1.use("/permissions", permissionsRoutes);
v1.use("/homepage", homepageRoutes);

app.use("/api/v1", v1);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
