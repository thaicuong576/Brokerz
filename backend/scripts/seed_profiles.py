import os
from uuid import UUID
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv()

# Database URL from .env
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_profiles():
    db = SessionLocal()
    try:
        # 1. Broker Profile
        broker_id = "00000000-0000-0000-0000-000000000001"
        investor_id = "00000000-0000-0000-0000-000000000002"

        print(f"Seeding mock profiles to {DATABASE_URL[:20]}...")

        db.execute(text("""
            INSERT INTO profiles (id, full_name, role, soul_key)
            VALUES (:id, :name, :role, :key)
            ON CONFLICT (id) DO UPDATE SET 
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role;
        """), {
            "id": broker_id,
            "name": "Master Broker Eddie",
            "role": "BROKER",
            "key": "SOUL-BKZ-8888"
        })

        db.execute(text("""
            INSERT INTO profiles (id, full_name, role)
            VALUES (:id, :name, :role)
            ON CONFLICT (id) DO UPDATE SET 
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role;
        """), {
            "id": investor_id,
            "name": "Elite Investor User",
            "role": "INVESTOR"
        })

        db.commit()
        print("✅ Mock profiles seeded successfully!")
    except Exception as e:
        print(f"❌ Error seeding profiles: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_profiles()
