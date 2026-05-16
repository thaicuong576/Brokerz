import os
import uuid
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_threads(email):
    db = SessionLocal()
    try:
        # 1. Tìm profile theo email (nếu email được lưu trong metadata/full_name hoặc tìm theo full_name)
        # Giả sử chúng ta tìm theo full_name hoặc kiểm tra tất cả profiles
        print(f"Checking threads in database...")
        
        # Lấy thông tin user phungthaicuong
        user = db.execute(text("SELECT id, full_name, role, linked_broker_id FROM profiles WHERE full_name LIKE '%Phùng Thái%' OR full_name LIKE '%phungthaicuong%'")).first()
        
        if not user:
            print("User not found in profiles table.")
            return

        # Print without special characters to avoid encoding issues
        print(f"User found: ID={user.id}, Role={user.role}")
        
        # 2. Kiểm tra các thread do user này tạo
        threads = db.execute(text("SELECT id, created_by, assigned_broker, is_private FROM inquiries WHERE created_by = :uid"), {"uid": user.id}).all()
        
        print(f"\nThreads created by this user ({len(threads)}):")
        for t in threads:
            print(f"- ID: {t.id} | Private: {t.is_private}")
            
        # 3. Kiểm tra các thread mà user này CÓ THỂ thấy theo logic backend
        visible_query = text("""
            SELECT id, created_by, assigned_broker, is_private 
            FROM inquiries 
            WHERE created_by = :uid 
            OR (assigned_broker = :bid AND is_private = False)
        """)
        
        visible_threads = db.execute(visible_query, {"uid": user.id, "bid": user.linked_broker_id}).all()
        print(f"\nThreads visible to this user by logic ({len(visible_threads)}):")
        for t in visible_threads:
            print(f"- ID: {t.id} | Private: {t.is_private}")

    finally:
        db.close()

if __name__ == "__main__":
    check_threads("phungthaicuong.hurea@gmail.com")
