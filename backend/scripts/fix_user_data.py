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

def cleanup_and_sync():
    db = SessionLocal()
    try:
        # 1. Chuyển tài khoản phungthaicuong.hurea@gmail.com về INVESTOR
        user_id = "78c5e225-acd8-4d25-af79-35d9e64b8bce"
        db.execute(text("UPDATE profiles SET role = 'INVESTOR' WHERE id = :uid"), {"uid": user_id})
        
        # 2. Đồng bộ các Thread đang gán cho Broker ID cũ (5d444...) sang Broker Eddie (BKZ-KB59-2H1Z)
        # Broker Eddie có ID thực tế là bao nhiêu? Chúng ta cần tìm ID của người có soul_key = 'BKZ-KB59-2H1Z'
        broker = db.execute(text("SELECT id FROM profiles WHERE soul_key = 'BKZ-KB59-2H1Z'")).first()
        
        if broker:
            broker_id = broker.id
            print(f"Found Eddie Broker ID: {broker_id}")
            
            # Cập nhật các thread sang cho broker này
            db.execute(text("UPDATE inquiries SET assigned_broker = :bid WHERE created_by = :uid"), 
                      {"bid": broker_id, "uid": user_id})
            
            # Đảm bảo profile của user cũng link tới broker này
            db.execute(text("UPDATE profiles SET linked_broker_id = :bid WHERE id = :uid"), 
                      {"bid": broker_id, "uid": user_id})
        
        db.commit()
        print("Database sync completed successfully.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_and_sync()
