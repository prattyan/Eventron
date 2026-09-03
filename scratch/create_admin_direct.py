import os
import uuid
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "event_horizon")

def create_admin(email, password="admin123"):
    if not MONGO_URI:
        print("Error: MONGODB_URI not set in .env")
        return

    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        users_col = db["users"]
        admins_col = db["admins"]

        # Check if already in admins
        existing_admin = admins_col.find_one({"email": email})
        if existing_admin:
            print(f"ℹ️ User '{email}' is ALREADY in the 'admins' collection.")
            return

        # Find in users
        user = users_col.find_one({"email": email})
        if user:
            # Promote existing user
            user["role"] = "admin"
            admins_col.replace_one({"email": email}, user, upsert=True)
            users_col.delete_one({"_id": user["_id"]})
            print(f"✅ Successfully PROMOTED existing user '{email}' to 'admins' collection.")
            return

        # Create new admin directly
        new_admin = {
            "id": str(uuid.uuid4()),
            "name": "Super Admin",
            "email": email,
            "password": password,
            "role": "admin",
            "bio": "System Administrator",
            "phoneNumber": ""
        }
        admins_col.insert_one(new_admin)
        print(f"✅ Created NEW admin '{email}' directly in the 'admins' collection.")
        print(f"   Password: {password}")

    except Exception as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    create_admin("admin@gmail.com")
