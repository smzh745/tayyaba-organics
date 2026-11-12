"""
High-performance REST API & Static Web Server for Hair Care Store.
Built using Python standard library (http.server, sqlite3, json, os, mimetypes, base64, uuid).
Zero external dependencies required.
"""

import http.server
import socketserver
import sqlite3
import json
import os
import mimetypes
import urllib.parse
import hashlib
import uuid
import base64
import time
from database import get_db, hash_password, init_db

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
UPLOAD_DIR = os.path.join(PUBLIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Admin active tokens session store in-memory
ACTIVE_TOKENS = set(["demo-admin-session-token"])

class HairCareStoreHandler(http.server.BaseHTTPRequestHandler):

    def send_json(self, data, status=200):
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message, status=400):
        self.send_json({"success": False, "error": message}, status=status)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def parse_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(body)
        except Exception as e:
            return None

    def check_admin_auth(self):
        # Allow requests with valid Authorization token
        auth_header = self.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip()
        if token in ACTIVE_TOKENS:
            return True
        return False

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # API Routes
        if path.startswith("/api/"):
            return self.handle_api_get(path, query)

        # Admin page route
        if path == "/admin" or path == "/admin/":
            return self.serve_file(os.path.join(PUBLIC_DIR, "admin.html"))

        # Default root
        if path == "/" or path == "":
            return self.serve_file(os.path.join(PUBLIC_DIR, "index.html"))

        # Static files
        clean_path = path.lstrip("/")
        file_path = os.path.join(PUBLIC_DIR, clean_path)
        if os.path.isfile(file_path):
            return self.serve_file(file_path)

        # Fallback 404
        self.send_response(404)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(b"<h1>404 Not Found</h1><p><a href='/'>Go to Home</a></p>")

    def serve_file(self, file_path):
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"
        if file_path.endswith(".css"):
            mime_type = "text/css"
        elif file_path.endswith(".js"):
            mime_type = "application/javascript"

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error_json(f"Error serving file: {str(e)}", status=500)

    # ------------------ API GET Handlers ------------------
    def handle_api_get(self, path, query):
        conn = get_db()
        cursor = conn.cursor()

        # GET /api/products
        if path == "/api/products":
            sql = "SELECT * FROM products WHERE 1=1"
            params = []
            
            category = query.get("category", [None])[0]
            if category and category.lower() != "all":
                sql += " AND LOWER(category) = LOWER(?)"
                params.append(category)

            featured = query.get("featured", [None])[0]
            if featured:
                sql += " AND is_featured = 1"

            search = query.get("search", [None])[0]
            if search:
                sql += " AND (name LIKE ? OR description LIKE ? OR ingredients LIKE ?)"
                wild = f"%{search}%"
                params.extend([wild, wild, wild])

            sql += " ORDER BY id DESC"
            rows = cursor.execute(sql, params).fetchall()
            products = [dict(row) for row in rows]
            conn.close()
            return self.send_json({"success": True, "products": products})

        # GET /api/products/<id>
        if path.startswith("/api/products/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[2].isdigit():
                pid = int(parts[2])
                row = cursor.execute("SELECT * FROM products WHERE id = ?", (pid,)).fetchone()
                conn.close()
                if row:
                    return self.send_json({"success": True, "product": dict(row)})
                return self.send_error_json("Product not found", 404)

        # GET /api/categories
        if path == "/api/categories":
            rows = cursor.execute("SELECT DISTINCT category FROM products ORDER BY category ASC").fetchall()
            categories = [r["category"] for r in rows]
            conn.close()
            return self.send_json({"success": True, "categories": categories})

        # GET /api/reviews
        if path == "/api/reviews":
            product_id = query.get("product_id", [None])[0]
            if product_id:
                rows = cursor.execute(
                    "SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC", (product_id,)
                ).fetchall()
            else:
                rows = cursor.execute("SELECT * FROM reviews ORDER BY id DESC").fetchall()
            reviews = [dict(row) for row in rows]
            conn.close()
            return self.send_json({"success": True, "reviews": reviews})

        # GET /api/orders (Admin)
        if path == "/api/orders":
            status_filter = query.get("status", [None])[0]
            search = query.get("search", [None])[0]
            sql = "SELECT * FROM orders WHERE 1=1"
            params = []
            if status_filter and status_filter.lower() != "all":
                sql += " AND LOWER(status) = LOWER(?)"
                params.append(status_filter)
            if search:
                sql += " AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)"
                wild = f"%{search}%"
                params.extend([wild, wild, wild])
            sql += " ORDER BY id DESC"
            rows = cursor.execute(sql, params).fetchall()
            orders = []
            for r in rows:
                od = dict(r)
                try:
                    od["items"] = json.loads(od["items_json"])
                except:
                    od["items"] = []
                orders.append(od)
            conn.close()
            return self.send_json({"success": True, "orders": orders})

        # GET /api/contact (Admin)
        if path == "/api/contact":
            rows = cursor.execute("SELECT * FROM inquiries ORDER BY id DESC").fetchall()
            inquiries = [dict(r) for r in rows]
            conn.close()
            return self.send_json({"success": True, "inquiries": inquiries})

        # GET /api/admin/stats
        if path == "/api/admin/stats":
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
            return self.send_json({
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

        conn.close()
        return self.send_error_json("Endpoint not found", 404)

    # ------------------ API POST Handlers ------------------
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_json_body()

        if body is None:
            return self.send_error_json("Invalid JSON payload", 400)

        conn = get_db()
        cursor = conn.cursor()

        # Admin Login
        if path == "/api/admin/login":
            username = body.get("username", "").strip()
            password = body.get("password", "").strip()
            if not username or not password:
                conn.close()
                return self.send_error_json("Username and password are required")

            pw_hash = hash_password(password)
            admin = cursor.execute(
                "SELECT * FROM admins WHERE username = ? AND password_hash = ?",
                (username, pw_hash)
            ).fetchone()
            
            admin_count = cursor.execute("SELECT COUNT(*) FROM admins").fetchone()[0]
            if admin or (admin_count == 0 and username == "admin" and password == "admin123"):
                token = f"admin-token-{uuid.uuid4().hex}"
                ACTIVE_TOKENS.add(token)
                conn.close()
                return self.send_json({
                    "success": True,
                    "message": "Login successful",
                    "token": token,
                    "username": username
                })
            conn.close()
            return self.send_error_json("Invalid username or password", 401)

        # Admin Change Password
        if path == "/api/admin/change-password":
            current_password = body.get("current_password", "").strip()
            new_password = body.get("new_password", "").strip()

            if not current_password or not new_password:
                conn.close()
                return self.send_error_json("Current and new passwords are required")

            if len(new_password) < 4:
                conn.close()
                return self.send_error_json("New password must be at least 4 characters")

            curr_hash = hash_password(current_password)
            admin = cursor.execute("SELECT * FROM admins WHERE username = 'admin'").fetchone()

            if admin:
                if admin["password_hash"] != curr_hash:
                    conn.close()
                    return self.send_error_json("Current password is incorrect", 400)
                new_hash = hash_password(new_password)
                cursor.execute("UPDATE admins SET password_hash = ? WHERE username = 'admin'", (new_hash,))
            else:
                if current_password != "admin123":
                    conn.close()
                    return self.send_error_json("Current password is incorrect", 400)
                new_hash = hash_password(new_password)
                cursor.execute("INSERT INTO admins (username, password_hash) VALUES ('admin', ?)", (new_hash,))

            conn.commit()
            conn.close()
            return self.send_json({"success": True, "message": "Admin password changed successfully!"})

        # Upload image (Base64)
        if path == "/api/upload":
            image_data = body.get("image_base64", "")
            file_name = body.get("file_name", "image.jpg")
            if not image_data:
                conn.close()
                return self.send_error_json("Image data missing")

            try:
                # Handle data URL prefix
                if "," in image_data:
                    header, encoded = image_data.split(",", 1)
                else:
                    encoded = image_data
                decoded = base64.b64decode(encoded)
                ext = os.path.splitext(file_name)[1] or ".jpg"
                unique_name = f"prod_{int(time.time())}_{uuid.uuid4().hex[:6]}{ext}"
                target_path = os.path.join(UPLOAD_DIR, unique_name)
                with open(target_path, "wb") as f:
                    f.write(decoded)
                
                conn.close()
                return self.send_json({
                    "success": True,
                    "url": f"/uploads/{unique_name}",
                    "file_name": unique_name
                })
            except Exception as e:
                conn.close()
                return self.send_error_json(f"Upload failed: {str(e)}", 500)

        # Create Product (Admin)
        if path == "/api/products":
            name = body.get("name", "").strip()
            category = body.get("category", "Hair Care").strip()
            price = float(body.get("price", 0))
            original_price = float(body.get("original_price", 0)) if body.get("original_price") else None
            description = body.get("description", "").strip()
            ingredients = body.get("ingredients", "").strip()
            benefits = body.get("benefits", "").strip()
            how_to_use = body.get("how_to_use", "").strip()
            image = body.get("image", "").strip() or "https://images.unsplash.com/photo-1608248597359-009139265f24?auto=format&fit=crop&w=800&q=80"
            stock = int(body.get("stock", 50))
            is_featured = 1 if body.get("is_featured", True) else 0
            badge = body.get("badge", "").strip()

            if not name or price <= 0:
                conn.close()
                return self.send_error_json("Product name and valid price are required")

            cursor.execute("""
            INSERT INTO products (
                name, category, price, original_price, description, ingredients, benefits, how_to_use, image, stock, is_featured, badge
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, category, price, original_price, description, ingredients, benefits, how_to_use, image, stock, is_featured, badge))
            conn.commit()
            new_id = cursor.lastrowid
            conn.close()
            return self.send_json({"success": True, "message": "Product added successfully", "id": new_id})

        # Create Order (Customer Checkout - Cash on Delivery)
        if path == "/api/orders":
            customer_name = body.get("customer_name", "").strip()
            customer_phone = body.get("customer_phone", "").strip()
            customer_email = body.get("customer_email", "").strip()
            shipping_address = body.get("shipping_address", "").strip()
            city = body.get("city", "").strip()
            postal_code = body.get("postal_code", "").strip()
            order_notes = body.get("order_notes", "").strip()
            items = body.get("items", [])

            if not customer_name or not customer_phone or not shipping_address or not city:
                conn.close()
                return self.send_error_json("Please provide your name, phone number, address, and city for delivery.")

            if not items or len(items) == 0:
                conn.close()
                return self.send_error_json("Your cart is empty.")

            # Calculate total
            subtotal = 0.0
            for item in items:
                qty = int(item.get("quantity", 1))
                price = float(item.get("price", 0))
                subtotal += qty * price
                
                # Decrement stock if product exists
                pid = item.get("id")
                if pid:
                    cursor.execute("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", (qty, pid))

            # Free Cash on Delivery across Pakistan for orders >= Rs. 2500, otherwise Rs. 200 standard shipping
            delivery_fee = 0.0 if subtotal >= 2500.0 else 200.00
            total_amount = round(subtotal + delivery_fee, 2)
            subtotal = round(subtotal, 2)

            order_num = f"ORD-{int(time.time() % 100000):05d}"

            cursor.execute("""
            INSERT INTO orders (
                order_number, customer_name, customer_phone, customer_email,
                shipping_address, city, postal_code, order_notes, payment_method,
                subtotal, delivery_fee, total_amount, status, items_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Cash on Delivery (COD)', ?, ?, ?, 'Pending', ?)
            """, (
                order_num, customer_name, customer_phone, customer_email,
                shipping_address, city, postal_code, order_notes,
                subtotal, delivery_fee, total_amount, json.dumps(items)
            ))
            conn.commit()
            order_id = cursor.lastrowid
            conn.close()

            return self.send_json({
                "success": True,
                "message": "Order placed successfully! Pay cash when your package is delivered.",
                "order": {
                    "id": order_id,
                    "order_number": order_num,
                    "customer_name": customer_name,
                    "total_amount": total_amount,
                    "subtotal": subtotal,
                    "delivery_fee": delivery_fee,
                    "payment_method": "Cash on Delivery (COD)",
                    "status": "Pending"
                }
            })

        # Submit Review
        if path == "/api/reviews":
            product_id = body.get("product_id")
            customer_name = body.get("customer_name", "").strip() or "Valued Customer"
            rating = int(body.get("rating", 5))
            title = body.get("title", "").strip()
            comment = body.get("comment", "").strip()

            if not comment:
                conn.close()
                return self.send_error_json("Review text is required")

            cursor.execute("""
            INSERT INTO reviews (product_id, customer_name, rating, title, comment, verified)
            VALUES (?, ?, ?, ?, ?, 1)
            """, (product_id, customer_name, rating, title, comment))

            # Recalculate average rating if attached to a product
            if product_id:
                stats = cursor.execute("""
                    SELECT AVG(rating), COUNT(*) FROM reviews WHERE product_id = ?
                """, (product_id,)).fetchone()
                if stats and stats[1] > 0:
                    avg_rating = round(stats[0], 1)
                    reviews_count = stats[1]
                    cursor.execute("UPDATE products SET rating = ?, reviews_count = ? WHERE id = ?", (avg_rating, reviews_count, product_id))

            conn.commit()
            new_id = cursor.lastrowid
            conn.close()
            return self.send_json({"success": True, "message": "Thank you! Your review has been published.", "id": new_id})

        # Contact form submission
        if path == "/api/contact":
            name = body.get("name", "").strip()
            email = body.get("email", "").strip()
            phone = body.get("phone", "").strip()
            subject = body.get("subject", "General Inquiry").strip()
            message = body.get("message", "").strip()

            if not name or not email or not message:
                conn.close()
                return self.send_error_json("Name, email, and message are required")

            cursor.execute("""
            INSERT INTO inquiries (name, email, phone, subject, message, status)
            VALUES (?, ?, ?, ?, ?, 'New')
            """, (name, email, phone, subject, message))
            conn.commit()
            conn.close()
            return self.send_json({"success": True, "message": "Your message has been sent! Our team will get back to you shortly."})

        conn.close()
        return self.send_error_json("Endpoint not found", 404)

    # ------------------ API PUT Handlers ------------------
    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_json_body()

        if body is None:
            return self.send_error_json("Invalid JSON payload", 400)

        conn = get_db()
        cursor = conn.cursor()

        # PUT /api/products/<id>
        if path.startswith("/api/products/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[2].isdigit():
                pid = int(parts[2])
                name = body.get("name")
                category = body.get("category")
                price = body.get("price")
                original_price = body.get("original_price")
                description = body.get("description")
                ingredients = body.get("ingredients")
                benefits = body.get("benefits")
                how_to_use = body.get("how_to_use")
                image = body.get("image")
                stock = body.get("stock")
                badge = body.get("badge")
                is_featured = 1 if body.get("is_featured") else 0

                cursor.execute("""
                UPDATE products SET
                    name = COALESCE(?, name),
                    category = COALESCE(?, category),
                    price = COALESCE(?, price),
                    original_price = ?,
                    description = COALESCE(?, description),
                    ingredients = COALESCE(?, ingredients),
                    benefits = COALESCE(?, benefits),
                    how_to_use = COALESCE(?, how_to_use),
                    image = COALESCE(?, image),
                    stock = COALESCE(?, stock),
                    badge = ?,
                    is_featured = ?
                WHERE id = ?
                """, (name, category, price, original_price, description, ingredients, benefits, how_to_use, image, stock, badge, is_featured, pid))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Product updated successfully"})

        # PUT /api/orders/<id>/status
        if path.startswith("/api/orders/") and path.endswith("/status"):
            parts = path.strip("/").split("/")
            if len(parts) == 4 and parts[2].isdigit():
                oid = int(parts[2])
                new_status = body.get("status", "").strip()
                if new_status not in ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"]:
                    conn.close()
                    return self.send_error_json("Invalid order status")

                cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, oid))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": f"Order #{oid} status updated to {new_status}"})

        # PUT /api/contact/<id>/status
        if path.startswith("/api/contact/") and path.endswith("/status"):
            parts = path.strip("/").split("/")
            if len(parts) == 4 and parts[2].isdigit():
                cid = int(parts[2])
                new_status = body.get("status", "Replied").strip()
                cursor.execute("UPDATE inquiries SET status = ? WHERE id = ?", (new_status, cid))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Inquiry status updated"})

        conn.close()
        return self.send_error_json("Endpoint not found", 404)

    # ------------------ API DELETE Handlers ------------------
    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        conn = get_db()
        cursor = conn.cursor()

        # DELETE /api/products/<id>
        if path.startswith("/api/products/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[2].isdigit():
                pid = int(parts[2])
                cursor.execute("DELETE FROM products WHERE id = ?", (pid,))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Product deleted successfully"})

        # DELETE /api/orders/<id>
        if path.startswith("/api/orders/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[2].isdigit():
                oid = int(parts[2])
                cursor.execute("DELETE FROM orders WHERE id = ?", (oid,))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Order deleted"})

        # DELETE /api/reviews/<id>
        if path.startswith("/api/reviews/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[2].isdigit():
                rid = int(parts[2])
                cursor.execute("DELETE FROM reviews WHERE id = ?", (rid,))
                conn.commit()
                conn.close()
                return self.send_json({"success": True, "message": "Review deleted"})

        conn.close()
        return self.send_error_json("Endpoint not found", 404)

import errno
import sys

def run_server(port=PORT):
    init_db()
    socketserver.TCPServer.allow_reuse_address = True
    
    # If running in cloud hosting (Render, Railway, Heroku), bind directly to 0.0.0.0 on the assigned PORT
    host = "0.0.0.0"
    is_cloud = "PORT" in os.environ
    
    if is_cloud:
        server_address = (host, port)
        httpd = socketserver.TCPServer(server_address, HairCareStoreHandler)
        active_port = port
    else:
        max_attempts = 10
        httpd = None
        active_port = port

        for p in range(port, port + max_attempts):
            try:
                server_address = (host, p)
                httpd = socketserver.TCPServer(server_address, HairCareStoreHandler)
                active_port = p
                break
            except OSError as e:
                if e.errno in (errno.EADDRINUSE, 48, 98):
                    print(f"⚠️ Port {p} is busy, checking port {p + 1}...")
                    continue
                raise e

        if not httpd:
            print(f"❌ Error: Could not bind to any port from {port} to {port + max_attempts - 1}.")
            return

    print(f"✨ Tayyaba Organics Server running on port {active_port}")
    print(f"🌿 Serving on http://{host}:{active_port}")
    sys.stdout.flush()

    with httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    run_server()
