// /src/lib/e2ee.ts

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

class E2EEChatManager {
    private keyPair: nacl.BoxKeyPair | null = null;
    private sharedSecrets: Record<string, Uint8Array> = {}; // Store per-thread encryption keys

    // === STEP 1: Key Generation (Run once on signup/first use) ===
    async generateUserKeys(): Promise<nacl.BoxKeyPair> {
        // Generate a keypair for this user
        const keyPair = nacl.box.keyPair();

        // Store ONLY public key on server (safe to share)
        const publicKeyBase64 = naclUtil.encodeBase64(keyPair.publicKey);

        // Save to server - you'll need to implement this API endpoint
        try {
            await fetch('/api/profiles/me/', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCookie('csrftoken') || ''
                },
                body: JSON.stringify({
                    public_encryption_key: publicKeyBase64
                })
            });
        } catch (error) {
            console.warn('Could not save public key to server:', error);
        }

        // Store private key ONLY in browser (IndexedDB - never send to server!)
        await this.storePrivateKeyLocally(keyPair.secretKey);

        this.keyPair = keyPair;
        console.log('✅ E2EE Keys generated and stored securely');
        return keyPair;
    }

    // === STEP 2: Secure Key Storage (IndexedDB) ===
    async storePrivateKeyLocally(secretKey: Uint8Array): Promise<void> {
        const db = await this.openSecureDB();
        const tx = db.transaction('keys', 'readwrite');
        await tx.objectStore('keys').put({
            id: 'user_private_key',
            key: naclUtil.encodeBase64(secretKey),
            created_at: Date.now()
        });
        console.log('🔐 Private key stored in IndexedDB (never leaves device)');
    }

    async loadPrivateKey(): Promise<Uint8Array> {
        const db = await this.openSecureDB();
        const tx = db.transaction('keys', 'readonly');
        const result = await tx.objectStore('keys').get('user_private_key');

        if (!result) {
            throw new Error('Private key not found. Please re-initialize encryption.');
        }

        return naclUtil.decodeBase64(result.key);
    }

    private openSecureDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SecureChatDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (e) => {
                const db = (e.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('keys')) {
                    db.createObjectStore('keys', { keyPath: 'id' });
                }
            };
        });
    }

    // === STEP 3: Derive Shared Secret (Diffie-Hellman) ===
    async getThreadSecret(threadId: string, recipientUserId: number): Promise<Uint8Array> {
        // Check if we already have a shared secret for this thread
        if (this.sharedSecrets[threadId]) {
            return this.sharedSecrets[threadId];
        }

        // Fetch recipient's PUBLIC key from server (safe to fetch)
        const response = await fetch(`/api/profiles/${recipientUserId}/`);
        const recipientData = await response.json();

        if (!recipientData.public_encryption_key) {
            throw new Error('Recipient has not enabled encryption yet');
        }

        const recipientPublicKey = naclUtil.decodeBase64(recipientData.public_encryption_key);

        // Load our private key
        const myPrivateKey = await this.loadPrivateKey();

        // Derive shared secret using Diffie-Hellman
        // This creates a unique encryption key that only you and recipient can compute
        const sharedSecret = nacl.box.before(recipientPublicKey, myPrivateKey);

        // Cache it for this session
        this.sharedSecrets[threadId] = sharedSecret;

        console.log(`🔑 Shared secret derived for thread ${threadId}`);
        return sharedSecret;
    }

    // === STEP 4: Encrypt Message (Client-Side) ===
    async encryptMessage(plaintext: string, threadId: string, recipientUserId: number): Promise<{
        ciphertext: string;
        nonce: string;
        version: string;
    }> {
        try {
            const sharedSecret = await this.getThreadSecret(threadId, recipientUserId);

            // Generate a random nonce (number used once)
            const nonce = nacl.randomBytes(nacl.box.nonceLength);

            // Convert message to bytes
            const messageBytes = naclUtil.decodeUTF8(plaintext);

            // Encrypt using shared secret
            const encrypted = nacl.box.after(messageBytes, nonce, sharedSecret);

            // Return encrypted data + nonce (both needed for decryption)
            return {
                ciphertext: naclUtil.encodeBase64(encrypted),
                nonce: naclUtil.encodeBase64(nonce),
                version: 'v1'
            };
        } catch (error) {
            console.error('❌ Encryption failed:', error);
            throw error;
        }
    }

    // === STEP 5: Decrypt Message (Client-Side) ===
    async decryptMessage(encryptedData: {
        ciphertext: string;
        nonce: string;
    }, threadId: string, senderUserId: number): Promise<string> {
        try {
            const sharedSecret = await this.getThreadSecret(threadId, senderUserId);

            // Decode from base64
            const ciphertext = naclUtil.decodeBase64(encryptedData.ciphertext);
            const nonce = naclUtil.decodeBase64(encryptedData.nonce);

            // Decrypt
            const decrypted = nacl.box.open.after(ciphertext, nonce, sharedSecret);

            if (!decrypted) {
                throw new Error('Decryption failed - message may be corrupted');
            }

            // Convert back to string
            return naclUtil.encodeUTF8(decrypted);
        } catch (error) {
            console.error('❌ Decryption failed:', error);
            return '[Decryption failed - message corrupted]';
        }
    }

    // Helper function to get cookie
    private getCookie(name: string): string | null {
        if (typeof document === 'undefined') return null;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
        return null;
    }

    // Check if user already has keys
    async hasExistingKeys(): Promise<boolean> {
        try {
            await this.loadPrivateKey();
            return true;
        } catch {
            return false;
        }
    }
}

// Convenience functions
export async function initializeEncryption(): Promise<E2EEChatManager> {
    const e2ee = new E2EEChatManager();

    try {
        // Check if keys already exist
        const hasKeys = await e2ee.hasExistingKeys();
        if (!hasKeys) {
            await e2ee.generateUserKeys();
            console.log('✅ End-to-end encryption initialized!');
        } else {
            console.log('🔑 Using existing encryption keys');
        }
    } catch (error) {
        console.error('Failed to initialize encryption:', error);
        throw error;
    }

    return e2ee;
}

export async function handleSendSecureMessage(
    plaintext: string,
    threadId: string,
    recipientUserId: number,
    e2eeManager: E2EEChatManager
): Promise<void> {
    try {
        // 1. Encrypt message client-side
        const encrypted = await e2eeManager.encryptMessage(plaintext, threadId, recipientUserId);

        // 2. Send ONLY encrypted data to server
        await fetch(`/api/chat/messages/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': e2eeManager.getCookie('csrftoken') || ''
            },
            body: JSON.stringify({
                thread: threadId,
                encrypted_content: encrypted.ciphertext,
                nonce: encrypted.nonce,
                encryption_version: encrypted.version,
                content: '[Encrypted Message]' // Placeholder only
            })
        });

        console.log('✅ Encrypted message sent');
    } catch (error) {
        console.error('❌ Failed to send encrypted message:', error);
        throw error;
    }
}

export async function displaySecureMessage(
    messageData: any,
    threadId: string,
    e2eeManager: E2EEChatManager
): Promise<string> {
    try {
        if (messageData.encrypted_content) {
            // Decrypt client-side
            const plaintext = await e2eeManager.decryptMessage({
                ciphertext: messageData.encrypted_content,
                nonce: messageData.nonce
            }, threadId, messageData.sender.user.id);

            return plaintext;
        } else {
            return messageData.content || '[No content]'; // Fallback for unencrypted messages
        }
    } catch (error) {
        console.error('Failed to decrypt message:', error);
        return '[Unable to decrypt message]';
    }
}

export { E2EEChatManager };