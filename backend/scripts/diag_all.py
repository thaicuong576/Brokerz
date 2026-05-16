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

def find_all_users():
    db = SessionLocal()
    try:
        print("Listing all profiles in database:")
        users = db.execute(text("SELECT id, role, linked_broker_id FROM profiles")).all()
        for u in users:
            print(f"ID: {u.id} | Role: {u.role} | LinkedTo: {u.linked_broker_id}")
            
        print("\nListing all inquiries in database:")
        inqs = db.execute(text("SELECT id, created_by, assigned_broker FROM inquiries")).all()
        for i in inqs:
            print(f"InqID: {i.id} | CreatedBy: {i.created_by} | AssignedTo: {i.assigned_broker}")
            
    finally:
        db.close()

if __name__ == "__main__":
    find_all_users()
