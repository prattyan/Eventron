import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "event-manage")

def cleanup_admin_dupes():
    if not MONGO_URI:
        print("MONGODB_URI not set")
        return
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    admins = list(db["admins"].find({}, {"email": 1}))
    admin_emails = [a["email"] for a in admins]
    
    print(f"Cleaning up {len(admin_emails)} admins from users collection...")
    result = db["users"].delete_many({"email": {"$in": admin_emails}})
    print(f"Removed {result.deleted_count} duplicate user records.")

if __name__ == "__main__":
    cleanup_admin_dupes()
