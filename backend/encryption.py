
import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from config import FINAL_ENCRYPTION_KEY


def _derive_key() -> bytes:
    
    raw = FINAL_ENCRYPTION_KEY.ljust(32, "0")[:32]
    return raw.encode("utf-8")


def encrypt_data(data: dict | list) -> dict:

    import json

    try:
        key = _derive_key()
        iv = os.urandom(16) 

        aesgcm = AESGCM(key)
        plaintext = json.dumps(data).encode("utf-8")

        
        ct_with_tag = aesgcm.encrypt(iv, plaintext, None)
        ciphertext = ct_with_tag[:-16]
        auth_tag = ct_with_tag[-16:]

        return {
            "encrypted": True,
            "iv": base64.b64encode(iv).decode(),
            "authTag": base64.b64encode(auth_tag).decode(),
            "data": base64.b64encode(ciphertext).decode(),
        }
    except Exception as e:
        print(f"Encryption failed: {e}")
        return data  
