import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "event-manage")

def check_admins():
    if not MONGO_URI:
        print("MONGODB_URI not set")
        return
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    admins = list(db["admins"].find({}, {"password": 0}))
    users = list(db["users"].find({}, {"password": 0}))
    
    print(f"--- Admins ({len(admins)}) ---")
    for a in admins:
        print(f"- {a.get('email')} (Role: {a.get('role')}, ID: {a.get('id')})")
        
    print(f"\n--- Users ({len(users)}) ---")
    for u in users:
        print(f"- {u.get('email')} (Role: {u.get('role')}, ID: {u.get('id')})")

if __name__ == "__main__":
    check_admins()
