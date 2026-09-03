import sys
import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB_NAME", "event-manage")

def make_admin(email):
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
            # Ensure role is set just in case
            admins_col.update_one({"email": email}, {"$set": {"role": "admin"}})
            # Ensure removed from users if lingering copy exists
            users_col.delete_one({"email": email})
            return

        # Find in users
        user = users_col.find_one({"email": email})
        if not user:
            print(f"❌ User with email '{email}' not found in 'users' collection.")
            print("   Please register first.")
            return

        # Prepare for move
        user["role"] = "admin"
        
        # Insert into admins
        admins_col.replace_one({"email": email}, user, upsert=True)
        
        # Remove from users
        users_col.delete_one({"_id": user["_id"]})
        
        print(f"✅ Successfully MOVED '{email}' to 'admins' collection.")
        print("   The user ID is now separated from regular users.")

    except Exception as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python make_admin.py <email>")
    else:
        make_admin(sys.argv[1])
