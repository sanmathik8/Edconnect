from cryptography.fernet import Fernet
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

# Cache for Fernet instances to avoid re-initializing
_fernets = {}
_current_version = 1

def _get_keys():
    """Get list of keys from settings"""
    # Prefer CHAT_MESSAGE_KEYS (comma separated list)
    keys_str = getattr(settings, 'CHAT_MESSAGE_KEYS', None)
    if keys_str:
        return [k.strip() for k in keys_str.split(',') if k.strip()]
    
    # Fallback to single key
    single_key = getattr(settings, 'CHAT_MESSAGE_ENCRYPTION_KEY', None)
    if single_key:
        return [single_key]
    
    return []

def init_encryption():
    global _current_version
    keys = _get_keys()
    if not keys:
        logger.error("No encryption keys found in settings!")
        return

    for i, key in enumerate(keys, 1):
        try:
            _fernets[i] = Fernet(key.encode())
            _current_version = i
        except Exception as e:
            logger.error(f"Failed to initialize encryption key version {i}: {e}")

# Initialize on module load
init_encryption()

def encrypt_text(plaintext: str):
    """Encrypts text using the latest key. Returns (ciphertext, version)."""
    if not plaintext:
        return None, None
    
    current_fernet = _fernets.get(_current_version)
    if not current_fernet:
        logger.error("No active encryption key available!")
        return None, None
        
    ciphertext = current_fernet.encrypt(plaintext.encode())
    return ciphertext, _current_version

def decrypt_text(ciphertext, version: int) -> str:
    """Decrypts text using the specified key version."""
    if not ciphertext or not version:
        return ""
        
    fernet = _fernets.get(version)
    if not fernet:
        logger.error(f"No encryption key found for version {version}")
        return "[Decryption Error: Missing Key]"

    try:
        # Handle binary field memoryview
        if isinstance(ciphertext, memoryview):
            ciphertext = bytes(ciphertext)
        return fernet.decrypt(ciphertext).decode()
    except Exception as e:
        logger.error(f"Decryption failed for version {version}: {e}")
        return "[Decryption Error]"

def get_current_version():
    return _current_version
