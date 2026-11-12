"""
WSGI Application for PythonAnywhere (and other WSGI servers).
Works out of the box with zero external pip dependencies.
Exports `application` callable expected by PythonAnywhere.
"""

import os
import sys
import json
import mimetypes
import urllib.parse
import uuid
import base64
import time

# Ensure current directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from database import get_db, hash_password, init_db, get_all_settings, update_setting

PUBLIC_DIR = os.path.join(BASE_DIR, "public")
UPLOAD_DIR = os.path.join(PUBLIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ACTIVE_TOKENS = set(["demo-admin-session-token"])

# Ensure database is initialized
init_db()

def application(environ, start_response):
    path = environ.get("PATH_INFO", "/").rstrip("/") or "/"
    method = environ.get("REQUEST_METHOD", "GET").upper()
    query_string = environ.get("QUERY_STRING", "")
    query = urllib.parse.parse_qs(query_string)

    # CORS headers
    headers = [
        ("Access-Control-Allow-Origin", "*"),
        ("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"),
        ("Access-Control-Allow-Headers", "Content-Type, Authorization")
    ]

    if method == "OPTIONS":
        start_response("200 OK", headers)
        return [b""]

    # Helper to send JSON response
    def send_json(data, status="200 OK"):
        body = json.dumps(data, default=str).encode("utf-8")
        resp_headers = headers + [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(body)))
        ]
        start_response(status, resp_headers)
        return [body]

    def send_error(message, status="400 Bad Request"):
        return send_json({"success": False, "error": message}, status=status)

    # Helper to parse JSON body
    def parse_body():
        try:
            content_length = int(environ.get("CONTENT_LENGTH", 0) or 0)
        except (ValueError, TypeError):
            content_length = 0
        if content_length == 0:
            return {}
        raw = environ["wsgi.input"].read(content_length).decode("utf-8")
        try:
            return json.loads(raw)
        except:
            return None

    # Helper to serve static files
    def serve_file(filepath):
        if not os.path.isfile(filepath):
            start_response("404 Not Found", headers + [("Content-Type", "text/plain")])
            return [b"File not found"]

        mime, _ = mimetypes.guess_type(filepath)
        if not mime:
            mime = "application/octet-stream"
        if filepath.endswith(".css"):
            mime = "text/css"
        elif filepath.endswith(".js"):
            mime = "application/javascript"

        try:
            with open(filepath, "rb") as f:
                content = f.read()
            resp_headers = headers + [
                ("Content-Type", mime),
                ("Content-Length", str(len(content))),
                ("Cache-Control", "no-cache")
            ]
            start_response("200 OK", resp_headers)
            return [content]
        except Exception as e:
            start_response("500 Internal Server Error", headers + [("Content-Type", "text/plain")])
            return [str(e).encode("utf-8")]

    # ------------------ API ROUTES ------------------
    if path.startswith("/api/"):
        conn = get_db()
        cursor = conn.cursor()

        # GET /api/products
        if path == "/api/products" and method == "GET":
            sql = "SELECT * FROM products ORDER BY id ASC"
            rows = cursor.execute(sql).fetchall()
            products = [dict(r) for r in rows]
            conn.close()
            return send_json({"success": True, "products": products})

        # GET /api/reviews
        if path == "/api/reviews" and method == "GET":
            rows = cursor.execute("SELECT * FROM reviews ORDER BY id DESC").fetchall()
            reviews = [dict(r) for r in rows]
            conn.close()
            return send_json({"success": True, "reviews": reviews})

        # GET /api/orders (Admin)
        if path == "/api/orders" and method == "GET":
            rows = cursor.execute("SELECT * FROM orders ORDER BY id DESC").fetchall()
            orders = []
            for r in rows:
                od = dict(r)
                try:
                    od["items"] = json.loads(od["items_json"])
                except:
                    od["items"] = []
                orders.append(od)
            conn.close()
            return send_json({"success": True, "orders": orders})

        # GET /api/admin/stats
        if path == "/api/admin/stats" and method == "GET":
            total_orders = cursor.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
            total_revenue = cursor.execute("SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status != 'Cancelled'").fetchone()[0]
            pending_orders = cursor.execute("SELECT COUNT(*) FROM orders WHERE status = 'Pending'").fetchone()[0]
            total_products = cursor.execute("SELECT COUNT(*) FROM products").fetchone()[0]
            total_reviews = cursor.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]
            low_stock = cursor.execute("SELECT COUNT(*) FROM products WHERE stock <= 10").fetchone()[0]

            recent_orders_rows = cursor.execute("SELECT * FROM orders ORDER BY id DESC LIMIT 5").fetchall()
            recent_orders = []
            for r in recent_orders_rows:
                od = dict(r)
                try:
                    od["items"] = json.loads(od["items_json"])
                except:
                    od["items"] = []
                recent_orders.append(od)

            conn.close()
            return send_json({
                "success": True,
                "stats": {
                    "total_orders": total_orders,
                    "total_revenue": round(total_revenue, 2),
                    "pending_orders": pending_orders,
                    "total_products": total_products,
                    "total_reviews": total_reviews,
                    "low_stock_products": low_stock,
                    "recent_orders": recent_orders
                }
            })

        # GET /api/contact
        if path == "/api/contact" and method == "GET":
            rows = cursor.execute("SELECT * FROM inquiries ORDER BY id DESC").fetchall()
            inquiries = [dict(r) for r in rows]
            conn.close()
            return send_json({"success": True, "inquiries": inquiries})

        # GET /api/settings
        if path == "/api/settings" and method == "GET":
            settings = get_all_settings(conn)
            conn.close()
            return send_json({"success": True, "settings": settings})

        # POST /api/orders (Cash on Delivery)
        if path == "/api/orders" and method == "POST":
            body = parse_body()
            if not body:
                conn.close()
                return send_error("Invalid order data")

            name = body.get("customer_name", "").strip()
            phone = body.get("customer_phone", "").strip()
            address = body.get("shipping_address", "").strip()
            city = body.get("city", "").strip()
            notes = body.get("order_notes", "").strip()
            items = body.get("items", [])

            if not name or not phone or not address or not city:
                conn.close()
                return send_error("Please provide your name, phone number, address, and city.")

            if not items:
                conn.close()
                return send_error("Your cart is empty.")

            subtotal = 0.0
            for itm in items:
                qty = int(itm.get("quantity", 1))
                price = float(itm.get("price", 0))
                subtotal += qty * price

            settings = get_all_settings(conn)
            try:
                free_threshold = float(settings.get("free_shipping_threshold", 2000.0))
            except (ValueError, TypeError):
                free_threshold = 2000.0
            try:
                standard_fee = float(settings.get("standard_delivery_fee", 200.0))
            except (ValueError, TypeError):
                standard_fee = 200.0

            delivery_fee = 0.0 if subtotal >= free_threshold else standard_fee
            total_amount = round(subtotal + delivery_fee, 2)
            subtotal = round(subtotal, 2)
            order_num = f"ORD-{int(time.time() % 100000):05d}-{uuid.uuid4().hex[:4].upper()}"

            cursor.execute("""
            INSERT INTO orders (
                order_number, customer_name, customer_phone, customer_email,
                shipping_address, city, postal_code, order_notes, payment_method,
                subtotal, delivery_fee, total_amount, status, items_json
            ) VALUES (?, ?, ?, '', ?, ?, '', ?, 'Cash on Delivery (COD)', ?, ?, ?, 'Pending', ?)
            """, (order_num, name, phone, address, city, notes, subtotal, delivery_fee, total_amount, json.dumps(items)))
            conn.commit()
            order_id = cursor.lastrowid
            conn.close()

            return send_json({
                "success": True,
                "message": "Order placed successfully! Pay cash when your package is delivered.",
                "order": {
                    "id": order_id,
                    "order_number": order_num,
                    "customer_name": name,
                    "total_amount": total_amount,
                    "subtotal": subtotal,
                    "delivery_fee": delivery_fee,
                    "payment_method": "Cash on Delivery (COD)",
                    "status": "Pending"
                }
            })

        # POST /api/reviews
        if path == "/api/reviews" and method == "POST":
            body = parse_body()
            if not body or not body.get("comment"):
                conn.close()
                return send_error("Review text required")

            name = body.get("customer_name", "Valued Customer")
            rating = int(body.get("rating", 5))
            comment = body.get("comment", "").strip()
            pid = body.get("product_id")

            cursor.execute("""
            INSERT INTO reviews (product_id, customer_name, rating, title, comment, verified)
            VALUES (?, ?, ?, '', ?, 1)
            """, (pid, name, rating, comment))
            conn.commit()
            conn.close()
            return send_json({"success": True, "message": "Review submitted successfully!"})

        # POST /api/contact
        if path == "/api/contact" and method == "POST":
            body = parse_body()
            name = body.get("name", "").strip()
            phone = body.get("phone", "").strip()
            msg = body.get("message", "").strip()

            if not name or not msg:
                conn.close()
                return send_error("Name and message are required")

            cursor.execute("""
            INSERT INTO inquiries (name, email, phone, subject, message, status)
            VALUES (?, '', ?, 'Storefront Inquiry', ?, 'New')
            """, (name, phone, msg))
            conn.commit()
            conn.close()
            return send_json({"success": True, "message": "Your message has been sent!"})

        # POST /api/admin/login
        if path == "/api/admin/login" and method == "POST":
            body = parse_body()
            username = body.get("username", "").strip()
            password = body.get("password", "").strip()

            pw_hash = hash_password(password)
            admin = cursor.execute("SELECT * FROM admins WHERE username = ? AND password_hash = ?", (username, pw_hash)).fetchone()
            if admin:
                token = f"admin-token-{uuid.uuid4().hex}"
                ACTIVE_TOKENS.add(token)
                conn.close()
                return send_json({"success": True, "token": token, "username": username})

            admin_count = cursor.execute("SELECT COUNT(*) FROM admins").fetchone()[0]
            if admin_count == 0 and username == "admin" and password == "admin123":
                token = f"admin-token-{uuid.uuid4().hex}"
                ACTIVE_TOKENS.add(token)
                conn.close()
                return send_json({"success": True, "token": token, "username": username})

            conn.close()
            return send_error("Invalid username or password", status="401 Unauthorized")

        # PUT /api/orders/<id>/status
        if path.startswith("/api/orders/") and path.endswith("/status") and method == "PUT":
            body = parse_body()
            parts = path.strip("/").split("/")
            if len(parts) == 4 and parts[2].isdigit():
                oid = int(parts[2])
                status = body.get("status", "Pending")
                cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (status, oid))
                conn.commit()
                conn.close()
                return send_json({"success": True, "message": "Status updated"})

        # DELETE /api/products/<id>
        if path.startswith("/api/products/") and method == "DELETE":
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[2].isdigit():
                pid = int(parts[2])
                cursor.execute("DELETE FROM products WHERE id = ?", (pid,))
                conn.commit()
                conn.close()
                return send_json({"success": True, "message": "Product deleted"})

        # POST /api/products (Add product)
        if path == "/api/products" and method == "POST":
            body = parse_body()
            name = body.get("name")
            category = body.get("category", "Hair Care")
            price = float(body.get("price", 0))
            orig_price = float(body.get("original_price")) if body.get("original_price") else None
            desc = body.get("description", "")
            ingredients = body.get("ingredients", "")
            benefits = body.get("benefits", "")
            how = body.get("how_to_use", "")
            image = body.get("image", "https://images.unsplash.com/photo-1608248597359-009139265f24?auto=format&fit=crop&w=800&q=80")
            stock = int(body.get("stock", 50))
            badge = body.get("badge", "")

            cursor.execute("""
            INSERT INTO products (name, category, price, original_price, description, ingredients, benefits, how_to_use, image, stock, is_featured, badge)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """, (name, category, price, orig_price, desc, ingredients, benefits, how, image, stock, badge))
            conn.commit()
            conn.close()
            return send_json({"success": True, "message": "Product added"})

        # POST /api/upload
        if path == "/api/upload" and method == "POST":
            body = parse_body()
            img_b64 = body.get("image_base64", "")
            fname = body.get("file_name", "image.jpg")
            if "," in img_b64:
                _, encoded = img_b64.split(",", 1)
            else:
                encoded = img_b64
            decoded = base64.b64decode(encoded)
            ext = os.path.splitext(fname)[1] or ".jpg"
            unique_name = f"prod_{int(time.time())}_{uuid.uuid4().hex[:6]}{ext}"
            with open(os.path.join(UPLOAD_DIR, unique_name), "wb") as f:
                f.write(decoded)
            conn.close()
            return send_json({"success": True, "url": f"/uploads/{unique_name}"})

        # POST /api/admin/settings or /api/settings
        if path in ("/api/admin/settings", "/api/settings") and method == "POST":
            body = parse_body()
            if not body:
                conn.close()
                return send_error("Invalid settings data")
            for key in ["standard_delivery_fee", "free_shipping_threshold", "announcement_message", "whatsapp_number"]:
                if key in body and body[key] is not None:
                    update_setting(key, str(body[key]).strip(), conn)
            settings = get_all_settings(conn)
            conn.close()
            return send_json({
                "success": True,
                "message": "Store delivery settings updated successfully!",
                "settings": settings
            })

        conn.close()
        return send_error("Endpoint not found", status="404 Not Found")

    # ------------------ STATIC FILE ROUTES ------------------
    if path == "/" or path == "":
        return serve_file(os.path.join(PUBLIC_DIR, "index.html"))

    if path == "/admin":
        return serve_file(os.path.join(PUBLIC_DIR, "admin.html"))

    clean_path = path.lstrip("/")
    target = os.path.join(PUBLIC_DIR, clean_path)
    if os.path.isfile(target):
        return serve_file(target)

    # 404 fallback
    start_response("404 Not Found", headers + [("Content-Type", "text/html")])
    return [b"<h1>404 Not Found</h1><p><a href='/'>Return to Store</a></p>"]

