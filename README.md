# 🌿 Tayyaba Organics — 100% Pure Herbal Hair Care Pakistan

A modern, responsive e-commerce web application created for **Tayyaba Organics**, operating across **Pakistan**. It features a customer storefront, a **Cash on Delivery (COD)** checkout system across all Pakistani cities, and an **Admin Panel** to upload, manage, and edit product data.

---

## 🌟 Key Features

### 🛍️ Customer Storefront (Pakistan Operations)
1. **Fully Responsive Design**: Optimized for mobile phones, tablets, and desktops with smooth slide-out cart drawer and touch-friendly controls.
2. **Pakistani Rupee (PKR / Rs.) Pricing**:
   - Filter by categories: **Hair Oils**, **Shampoos**, **Conditioners**, **Hair Masks**, **Serums**, and **Value Bundles**.
   - Live Search bar with instant keyword matching.
   - Price sorting (Low-to-High, High-to-Low, Top Rated, Featured).
   - Dynamic badges (e.g., *Best Seller*, *Save Rs. 1500*, *Sulfate Free*).
   - **Quick View Modal** with product descriptions, key ingredients, usage instructions, and benefits.
3. **Interactive Shopping Cart**:
   - Slide-out cart drawer with real-time quantity modifiers (`+` / `-` / `remove`).
   - **Free Delivery Meter**: Automatically awards free courier shipping on orders above **Rs. 2,500** across Pakistan (otherwise standard Rs. 200 delivery fee).
4. **Cash on Delivery (COD) Checkout**:
   - No advance payment or credit card required.
   - Collects customer full name, contact WhatsApp/mobile number, complete street address, Pakistani city (with quick autocomplete for Lahore, Karachi, Islamabad, Faisalabad, Multan, Rawalpindi, Peshawar, Quetta, etc.), and delivery notes.
   - Generates instant Order Confirmation with a unique Order Number (e.g., `#ORD-78401`).
5. **Customer Reviews Section**:
   - Verified buyer badges and 5-star ratings.
   - Interactive **"Write a Review"** modal allowing Pakistani customers to submit reviews and feedback.
6. **Contact & Customer Care**:
   - Store details (Support phone, email, delivery coverage).
   - Interactive contact inquiry form connected to the database.
   - Direct **"Order or Inquire via WhatsApp"** click-to-chat button.
   - FAQ accordion answering COD, courier delivery time (2-4 business days), and hair compatibility queries.

---

### ⚙️ Admin Portal (`/admin`)
- **Secure Access**:
  - **Username**: `admin`
  - **Password**: `admin123`
- **Dashboard Analytics**:
  - Total sales in PKR from active COD orders.
  - Total orders placed across Pakistan.
  - Pending COD deliveries awaiting phone confirmation or dispatch.
  - Inventory overview (total products and low-stock alerts).
  - Recent orders quick summary table.
- **Product Management (Data Upload & CRUD)**:
  - **Upload New Product**: Add product name, category, price in Rs., discount price, stock quantity, description, ingredients, benefits, how to use, and custom badge.
  - **Image Handling**: Paste any image URL or upload image files directly from your computer.
  - **Edit & Delete**: Instant updates to prices, stock levels, or descriptions.
- **Order Management (COD Fulfillment)**:
  - View all customer orders with customer name, phone number, full street address, and city.
  - One-click **WhatsApp Chat** and **Phone Call** buttons to confirm orders directly with the customer prior to dispatch.
  - Live Status updater: `Pending` &rarr; `Confirmed` &rarr; `Shipped` &rarr; `Delivered` &rarr; `Cancelled`.
- **Reviews Management**:
  - View all customer submitted testimonials and remove inappropriate reviews.
- **Contact Inquiries**:
  - View all contact form messages sent by customers and mark them as `Replied`.

---

## 💾 Permanent Data Storage (No Data Loss)
* All products, customer orders, reviews, and inquiries are stored permanently in the local SQLite database file:
  `store.db` inside `/Users/zeejah/StudioProjects/haircare-store/store.db`.
* **Logging out, closing the browser, or restarting your computer will NEVER delete or lose your data.**

---

## 🚀 Quick Start Guide

### 1. Launch the Server
In the terminal, run:
```bash
cd /Users/zeejah/StudioProjects/haircare-store
./run.sh
```

### 2. Access the Application
* **Storefront:** [http://localhost:8080](http://localhost:8080)
* **Admin Panel:** [http://localhost:8080/admin](http://localhost:8080/admin)
  * **Username:** `admin`
  * **Password:** `admin123`
