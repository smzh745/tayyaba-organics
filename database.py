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
    # Strictly the 3 core products: Hair Oil, Hair Shampoo, Hair Mask
    sample_products = [
        (
            "Tayyaba Organics Herbal Hair Growth Oil",
            "Hair Oil",
            1450.00,
            1950.00,
            "100% pure cold-pressed botanical hair oil formulated with pure Rosemary extracts, Kalonji (Black Seed), and Castor seed oil. Stops hair fall, revitalizes weak roots, and stimulates new hair growth.",
            "Pure Rosemary Extract, Cold-Pressed Kalonji (Black Seed) Oil, Castor Oil, Biotin, Sweet Almond Oil, Vitamin E.",
            "Visibly stops hair shedding within 3 weeks, awakens dormant scalp follicles, eliminates dryness and dandruff.",
            "Apply 4-6 drops directly onto scalp roots using the dropper. Massage gently for 5 minutes. Leave on for 2 hours or overnight before washing.",
            "https://images.unsplash.com/photo-1608248597359-009139265f24?auto=format&fit=crop&w=800&q=80",
            60,
            4.9,
            156,
            1,
            "Best Seller"
        ),
        (
            "Tayyaba Organics Keratin Herbal Hair Shampoo",
            "Shampoo",
            1199.00,
            1550.00,
            "100% Sulfate-free (SLS/SLES free) and Paraben-free botanical shampoo. Gently cleanses the scalp without stripping natural moisture, leaving hair silky, soft, and completely frizz-free.",
            "Hydrolyzed Botanical Keratin, Aloe Vera Gel, Coconut Glucosides, Amla, Reetha & Shikakai Extracts, Provitamin B5.",
            "Controls humidity frizz, salon-grade silky softness, prevents breakage, safe for chemically treated or colored hair.",
            "Lather onto thoroughly wet hair and gently massage roots for 2 minutes to let botanicals absorb. Rinse cleanly with cool water.",
            "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80",
            75,
            4.9,
            118,
            1,
            "Sulfate Free"
        ),
        (
            "Tayyaba Organics Restorative Herbal Hair Mask",
            "Hair Mask",
            1599.00,
            2100.00,
            "Intensive weekly rejuvenation therapy. Fermented rice water proteins and hibiscus flower extracts deeply rebuild broken bonds, repair dryness from hard water, and restore brilliant mirror shine.",
            "Fermented Rice Water Filtrate, Hibiscus Rosa Flower Extract, Raw Shea Butter, Wheat Protein, Argan Oil.",
            "Deep root-to-tip hydration, repairs heat and chemical damage, transforms coarse hair into velvety soft strands.",
            "After shampooing, apply generously to clean, damp hair from roots to ends. Leave for 15-20 minutes, then rinse thoroughly.",
            "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=800&q=80",
            50,
            4.8,
            94,
            1,
            "Deep Repair"
        )
    ]

    cursor.executemany("""
    INSERT INTO products (
        name, category, price, original_price, description, ingredients, benefits, how_to_use, image, stock, rating, reviews_count, is_featured, badge
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sample_products)

    sample_reviews = [
        (
            1,
            "Fatima Zahra (Lahore)",
            5,
            "Hair fall completely stopped in 3 weeks!",
            "I was experiencing massive hair shedding. Tried expensive commercial brands but Tayyaba Organics Hair Oil actually worked! Within 3 weeks my hair fall reduced significantly and baby hairs started sprouting. Cash on Delivery was super fast in Lahore!",
            1
        ),
        (
            2,
            "Ayesha Siddiqui (Karachi)",
            5,
            "Best sulfate-free shampoo in Pakistan",
            "Most sulfate-free shampoos in Pakistan make hair super dry, but Tayyaba Organics Keratin shampoo leaves hair so soft and silky even in Karachi's humid weather.",
            1
        ),
        (
            3,
            "Maryam Tariq (Islamabad)",
            5,
            "Hair Mask made my hair feel like silk",
            "My hair was dry and brittle due to hard water. Used the hair mask twice and the texture completely changed. Soft, bouncy, and shiny!",
            1
        )
    ]

    cursor.executemany("""
    INSERT INTO reviews (product_id, customer_name, rating, title, comment, verified)
    VALUES (?, ?, ?, ?, ?, ?)
    """, sample_reviews)

    sample_orders = [
        (
            "ORD-78401",
            "Sadia Mansoor",
            "+92 301 2345678",
            "sadia.m@gmail.com",
            "House 18-C, Street 4, Phase 6, DHA",
            "Lahore",
            "54000",
            "Please deliver before 5 PM",
            "Cash on Delivery (COD)",
            2649.00,
            0.0,
            2649.00,
            "Confirmed",
            json.dumps([
                {"id": 1, "name": "Tayyaba Organics Herbal Hair Growth Oil", "price": 1450.00, "quantity": 1, "image": "https://images.unsplash.com/photo-1608248597359-009139265f24?auto=format&fit=crop&w=800&q=80"},
                {"id": 2, "name": "Tayyaba Organics Keratin Herbal Hair Shampoo", "price": 1199.00, "quantity": 1, "image": "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80"}
            ])
        )
    ]

    cursor.executemany("""
    INSERT INTO orders (
        order_number, customer_name, customer_phone, customer_email, shipping_address,
        city, postal_code, order_notes, payment_method, subtotal, delivery_fee, total_amount, status, items_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sample_orders)

if __name__ == "__main__":
    init_db(force_reseed=True)
