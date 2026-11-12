#!/usr/bin/env python3
"""
Secure Admin Password Management for Tayyaba Organic.
This script can only be run locally by the server owner with terminal access.
"""

import sqlite3
import hashlib
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "store.db")

def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def main():
    print("🔒 Tayyaba Organic — Private Admin Password Tool")
    print(f"Database: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("❌ Error: store.db not found!")
        sys.exit(1)

    new_pw = input("Enter new admin password: ").strip()
    if len(new_pw) < 4:
        print("❌ Error: Password must be at least 4 characters long.")
        sys.exit(1)

    confirm_pw = input("Confirm new admin password: ").strip()
    if new_pw != confirm_pw:
        print("❌ Error: Passwords do not match!")
        sys.exit(1)

    pw_hash = hash_pw(new_pw)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if admin row exists
    admin_row = cursor.execute("SELECT id FROM admins WHERE username = 'admin'").fetchone()
    if admin_row:
        cursor.execute("UPDATE admins SET password_hash = ? WHERE username = 'admin'", (pw_hash,))
    else:
        cursor.execute("INSERT INTO admins (username, password_hash) VALUES ('admin', ?)", (pw_hash,))

    conn.commit()
    conn.close()

    print("\n✅ Success! Admin password has been securely updated.")
    print("Username: admin")
    print("New password is active immediately for /admin login.")

if __name__ == "__main__":
    main()
