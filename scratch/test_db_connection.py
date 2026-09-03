
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv("MONGODB_URI")
print(f"URI: {uri[:20]}...")

try:
    print("Attempting to connect...")
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    print("Ping...ing")
    client.admin.command("ping")
    print("✅ Successfully connected to MongoDB")
except Exception as e:
    print(f"❌ Failed to connect: {e}")
    import traceback
    traceback.print_exc()
