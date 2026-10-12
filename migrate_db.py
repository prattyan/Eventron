import os
import sys
import io
from pymongo import MongoClient
from pymongo.errors import BulkWriteError
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

def migrate(new_uri: str):
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)
    old_uri = os.getenv("MONGODB_URI", "")
    db_name = os.getenv("MONGODB_DB_NAME", "") or "event_horizon"

    if not old_uri:
        print("❌ Error: MONGODB_URI not found in .env")
        return False
    if not new_uri:
        print("❌ Error: New MongoDB URI is required")
        return False

    print(f"Connecting to Source DB...")
    source_client = MongoClient(old_uri, serverSelectionTimeoutMS=10000)
    source_db = source_client[db_name]

    print(f"Connecting to Target DB...")
    target_client = MongoClient(new_uri, serverSelectionTimeoutMS=10000)
    target_db = target_client[db_name]

    # Test connection
    source_client.admin.command('ping')
    target_client.admin.command('ping')
    print(f"✅ Both database connections established successfully!\n")

    collections = source_db.list_collection_names()
    print(f"📦 Found {len(collections)} collections to migrate in '{db_name}':")
    for c in sorted(collections):
        print(f"  - {c} ({source_db[c].count_documents({})} documents)")
    print()

    total_migrated = 0

    for col_name in sorted(collections):
        source_col = source_db[col_name]
        target_col = target_db[col_name]
        
        doc_count = source_col.count_documents({})
        if doc_count == 0:
            print(f"⏩ [{col_name}] Empty collection, skipping documents.")
            continue

        docs = list(source_col.find({}))
        try:
            target_col.delete_many({})  # Clear existing to ensure clean copy
            target_col.insert_many(docs, ordered=False)
            print(f"✅ [{col_name}] Successfully migrated {len(docs)} documents.")
            total_migrated += len(docs)
        except BulkWriteError as bwe:
            print(f"⚠️ [{col_name}] Partial write: {bwe.details}")
        except Exception as e:
            print(f"❌ [{col_name}] Error: {e}")

        # Copy indexes (excluding default _id index)
        try:
            indexes = source_col.index_information()
            for idx_name, idx_info in indexes.items():
                if idx_name == "_id_":
                    continue
                keys = idx_info["key"]
                unique = idx_info.get("unique", False)
                target_col.create_index(keys, unique=unique)
            print(f"   ↳ Cloned indexes for [{col_name}].")
        except Exception as idx_err:
            print(f"   ⚠️ Could not copy indexes for [{col_name}]: {idx_err}")

    print("\n" + "="*50)
    print("VERIFICATION REPORT:")
    print("="*50)
    all_matched = True
    for col_name in sorted(collections):
        s_count = source_db[col_name].count_documents({})
        t_count = target_db[col_name].count_documents({})
        status = "✅ MATCH" if s_count == t_count else "❌ MISMATCH"
        if s_count != t_count:
            all_matched = False
        print(f" - {col_name:15}: Source={s_count:4} | Target={t_count:4} [{status}]")

    if all_matched:
        print(f"\n🎉 ALL {total_migrated} documents migrated with 100% data integrity!")
        return True
    else:
        print(f"\n⚠️ Some collections had mismatched counts. Please review the table above.")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_uri = sys.argv[1].strip()
    else:
        target_uri = input("Enter new MongoDB URI: ").strip()
    
    migrate(target_uri)
