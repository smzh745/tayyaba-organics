"""
Database initialization for Tayyaba Organics (Pakistan).
Focused strictly on the 3 core products: Hair Oil, Hair Shampoo, and Hair Mask.
All data is stored permanently in SQLite (store.db).
"""

import sqlite3
import os
import hashlib
import json

DB_PATH = os.path.join(os.path.dirname(__file__), "store.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def init_db(force_reseed=False):
    conn = get_db()
    cursor = conn.cursor()

    if force_reseed:
        cursor.execute("DROP TABLE IF EXISTS products")
        cursor.execute("DROP TABLE IF EXISTS orders")
        cursor.execute("DROP TABLE IF EXISTS reviews")
        cursor.execute("DROP TABLE IF EXISTS inquiries")
        cursor.execute("DROP TABLE IF EXISTS admins")

    # Products Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        original_price REAL,
        description TEXT,
        ingredients TEXT,
        benefits TEXT,
        how_to_use TEXT,
        image TEXT,
        stock INTEGER DEFAULT 50,
        rating REAL DEFAULT 4.9,
        reviews_count INTEGER DEFAULT 0,
        is_featured INTEGER DEFAULT 1,
        badge TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Orders Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        shipping_address TEXT NOT NULL,
        city TEXT NOT NULL,
        postal_code TEXT,
        order_notes TEXT,
        payment_method TEXT DEFAULT 'Cash on Delivery (COD)',
        subtotal REAL NOT NULL,
        delivery_fee REAL DEFAULT 0.0,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'Pending',
        items_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Reviews Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        customer_name TEXT NOT NULL,
        rating INTEGER NOT NULL,
        title TEXT,
        comment TEXT NOT NULL,
        verified INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id)
    )
    """)

    # Inquiries (Contact messages)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        subject TEXT,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'New',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Admins Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Default admin credentials: admin / admin123
    admin_exists = cursor.execute("SELECT id FROM admins WHERE username = 'admin'").fetchone()
    if not admin_exists:
        cursor.execute(
            "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
            ("admin", hash_password("admin123"))
        )

    # Seed products if empty or forced
    product_count = cursor.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    if product_count == 0 or force_reseed:
        seed_tayyaba_organics_data(cursor)

    conn.commit()
    conn.close()
    print("Tayyaba Organics database updated at", DB_PATH)

def seed_tayyaba_organics_data(cursor):
    # Strictly the products from @organicstayyaba (Hair Cleanser, Nourishing Oil, Hair Mask)
    sample_products = [
        (
            "Tayyaba Organic Nourishing Hair Oil",
            "Hair Oil",
            1450.00,
            None,
            "100% Organic, handmade nourishing hair oil. Pure by nature, sulfate-free & cruelty-free. Nourishes scalp roots and restores natural hair vitality.",
            "100% Pure Botanical Extracts, Nourishing Herbal Oils.",
            "Nourishes hair roots, eliminates scalp dryness, and restores natural hair strength.",
            "Apply 4-6 drops to scalp roots, massage gently, leave for 2 hours or overnight before cleansing.",
            "https://images.unsplash.com/photo-1608248597359-009139265f24?auto=format&fit=crop&w=800&q=80",
            50,
            5.0,
            0,
            1,
            "Handmade • 100% Organic"
        ),
        (
            "Tayyaba Organic Hair Cleanser",
            "Hair Cleanser",
            1199.00,
            None,
            "Handmade 100% Sulfate-Free & Cruelty-Free botanical hair cleanser. Cleanses hair gently without stripping natural moisture.",
            "Hydrolyzed Botanical Extracts, Gentle Plant-Derived Cleansers.",
            "Gentle scalp cleanse, controls frizz, zero sulfates, preserves natural hair oils.",
            "Lather onto wet hair, massage scalp for 2 minutes, rinse with cool water.",
            "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80",
            50,
            5.0,
            0,
            1,
            "Sulfate-Free • Handmade"
        ),
        (
            "Tayyaba Organic Hair Mask",
            "Hair Mask",
            1599.00,
            None,
            "Handmade intensive herbal hair mask for deep conditioning, damage repair, and silky softness. Pure by nature.",
            "Pure Herbal Extracts, Botanical Conditioning Oils.",
            "Deep conditioning, repairs dryness and damage, leaves hair soft and manageable.",
            "Apply after hair cleansing from roots to ends, leave for 15-20 minutes, then rinse cleanly.",
            "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80",
            50,
            5.0,
            0,
            1,
            "Cruelty-Free • Deep Repair"
        )
    ]

    cursor.executemany("""
    INSERT INTO products (
        name, category, price, original_price, description, ingredients, benefits, how_to_use, image, stock, rating, reviews_count, is_featured, badge
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sample_products)

if __name__ == "__main__":
    init_db(force_reseed=True)
