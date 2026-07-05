# Veluntra API

Platform-agnostic REST API for the Veluntra storefront, seller console, and admin console — built with Node.js, Express, PostgreSQL, and Prisma. Consumed today by the React web frontend; designed from the ground up to be consumed by a future React Native app too (stateless JWT auth, no cookies, uniform response envelope).

## Stack

- **Runtime:** Node.js + Express
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT access + refresh tokens (bearer, returned in the response body — works identically for web `fetch`/axios and React Native)
- **Validation:** Zod, on every request body/query/params
- **Docs:** OpenAPI 3 (Swagger UI at `/api/docs`)
- **Uploads:** Local disk (multer) — swap the storage adapter for S3/Cloudinary later if needed
- **Email:** SMTP via nodemailer, fully configured from the admin Settings dashboard (no code change needed)
- **Scheduler:** lightweight in-process interval job for offer/coupon/low-stock notifications

## Getting started

### 1. Get PostgreSQL running

**Option A — Docker (recommended, zero local install):**

```bash
docker compose up -d db
```

**Option B — Native PostgreSQL on Windows:** install from [postgresql.org](https://www.postgresql.org/download/windows/), then create a database:

```sql
CREATE DATABASE Veluntra;
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` to match wherever Postgres is running, and generate real JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Install, migrate, seed

```bash
npm install
npm run prisma:migrate    # creates all tables
npm run seed               # creates demo admin/seller/customer + catalogue
```

Seeded logins:

| Role     | Email                     | Password      |
|----------|----------------------------|---------------|
| Admin    | admin@Veluntra.example      | Admin123!     |
| Seller   | seller@Veluntra.example     | Seller123!    |
| Customer | customer@Veluntra.example   | Customer123!  |

### 4. Run

```bash
npm run dev        # nodemon, auto-restart
# or
npm start           # plain node
```

API: `http://localhost:4000/api/v1` · Docs: `http://localhost:4000/api/docs` · Health: `http://localhost:4000/health`

## Full stack via Docker Compose

```bash
docker compose up --build
```

This runs Postgres + the API together, applies migrations, and seeds automatically on first boot.

## What's admin-configurable (no code changes required)

Everything below lives in the `Settings` table, editable via `PATCH /api/v1/settings/admin`:

- Store name, logo, banner
- Currency + symbol, tax %, platform fee %, default shipping cost
- Contact email/phone/address, return policy, privacy policy, terms of service
- SMTP credentials (for password reset / verification emails)
- Payment gateway keys (placeholder fields — wire up a real gateway's SDK using these)
- Cloudinary keys (placeholder fields — swap the local-disk upload adapter for Cloudinary using these)
- Notification toggles

Secrets (SMTP/payment/Cloudinary) are masked on read (`••••••••`) and only overwritten when you submit a real, non-masked value.

## Things that need real third-party credentials to actually function

These are fully wired up (routes, schema, config surface) but need you to supply real credentials before they do anything beyond logging to the console:

- **Email delivery** (password reset, email verification) — fill in SMTP settings via `/settings/admin`; until then, emails are logged to the server console instead of sent.
- **Payment capture** — `paymentMethod` is recorded on every order, but no gateway is charged. Wire a real gateway (Stripe, etc.) using the `paymentGatewayConfig` settings field.
- **Cloud image hosting** — uploads currently land on local disk under `/uploads`. Swap `src/middleware/upload.js`'s storage engine for Cloudinary using the `cloudinaryConfig` settings field if you need CDN-backed images.
- **Shipping carrier labels** — `trackingNumber`/`trackingCarrier`/`trackingUrl` on an order are manually set by admin/seller today. Real label purchase needs a carrier API (Shippo, EasyPost, etc.).

## Architecture

```
prisma/
  schema.prisma      # every table (see below)
  seed.js
src/
  config/            # env loader, Prisma client singleton
  middleware/         # auth guard, validation, error handler, upload, rate limiting
  utils/              # ApiError, response envelope, JWT, password hashing, pricing engine, invoice PDF, mailer
  jobs/scheduler.js    # offer/coupon/low-stock notification sweep
  docs/                # OpenAPI document + swagger-jsdoc wiring
  modules/
    auth/               # register/login/refresh/logout/me, password reset, email verification
    categories/ brands/  # catalogue taxonomy (unlimited nesting via Category.parentId)
    products/            # CRUD, variants, SEO fields, bulk CSV import/export
    reviews/              # submit/list + moderation (approve/reject/feature/reply/report)
    cart/                 # guest (session id) or authenticated, promotion + coupon aware
    coupons/ promotions/   # discount engine — coupons (code-based) and promotions (automatic, date-boxed)
    orders/               # checkout, one order per store, inventory automation, invoices
    addresses/ wishlist/ notifications/
    uploads/               # image upload endpoint
    settings/               # single-row store configuration
    admin/                  # platform-wide console
    seller/                  # store-scoped console
  app.js / server.js
```

### Data model highlights

- **Multi-seller ready:** every `Product` belongs to a `Store`; a single checkout automatically splits into one `Order` per store if the cart spans sellers, with shared costs (discount/shipping) apportioned by each store's share of the subtotal.
- **Promotions vs. coupons:** `Promotion` rows are automatic and time-boxed (flash sale, deal of the day, BOGO, category/brand/product/first-order discounts) — status is always computed live from `startsAt`/`endsAt`, never a stored flag. `Coupon` rows are code-based, with scope, per-user limits, max discount caps, and auto-apply support.
- **Pricing is centralized:** `src/utils/pricing.js` is the only place subtotal → discount → tax → platform fee → total math happens. Nothing is hardcoded — tax %, platform fee %, and shipping defaults all come from the `Settings` row.
- **Inventory automation:** stock decrements on order creation, restocks automatically on cancel/return, and triggers low-stock/out-of-stock notifications to the store owner.
- **Audit trail:** `ActivityLog` records actor, action, scope, and (where relevant) before/after values for settings and status changes.

## API reference

Full interactive docs at `/api/docs` once the server is running (or fetch the raw spec at `/api/docs.json`).
