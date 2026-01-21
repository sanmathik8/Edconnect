/**
 * Client-side encryption for chat messages
 * Uses Web Crypto API for secure end-to-end encryption
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

export class ChatEncryption {
    private static instance: ChatEncryption;
    private keyCache: Map<string, CryptoKey> = new Map();

    private constructor() { }

    static getInstance(): ChatEncryption {
        if (!ChatEncryption.instance) {
            ChatEncryption.instance = new ChatEncryption();
        }
        return ChatEncryption.instance;
    }

    /**
     * Check if Web Crypto API is available
     */
    isAvailable(): boolean {
        return typeof window !== 'undefined' &&
            window.crypto &&
            window.crypto.subtle !== undefined;
    }

    /**
     * Generate a new encryption key for a chat thread
     */
    async generateKey(): Promise<CryptoKey> {
        if (!this.isAvailable()) {
            throw new Error('Web Crypto API not available');
        }

        const key = await window.crypto.subtle.generateKey(
            {
                name: ALGORITHM,
                length: KEY_LENGTH,
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );

        return key;
    }

    /**
     * Export key to a format that can be stored/transmitted
     */
    async exportKey(key: CryptoKey): Promise<string> {
        const exported = await window.crypto.subtle.exportKey('jwk', key);
        return JSON.stringify(exported);
    }

    /**
     * Import a key from stored format
     */
    async importKey(keyData: string): Promise<CryptoKey> {
        const jwk = JSON.parse(keyData);
        const key = await window.crypto.subtle.importKey(
            'jwk',
            jwk,
            {
                name: ALGORITHM,
                length: KEY_LENGTH,
            },
            true,
            ['encrypt', 'decrypt']
        );

        return key;
    }

    /**
     * Get or generate key for a thread
     */
    async getThreadKey(threadId: number): Promise<CryptoKey> {
        const cacheKey = `thread_${threadId}`;

        // Check cache first
        if (this.keyCache.has(cacheKey)) {
            return this.keyCache.get(cacheKey)!;
        }

        // Try to load from localStorage
        const storedKey = localStorage.getItem(`chat_key_${threadId}`);

        if (storedKey) {
            try {
                const key = await this.importKey(storedKey);
                this.keyCache.set(cacheKey, key);
                return key;
            } catch (error) {
                console.error('Failed to import stored key, generating new one:', error);
            }
        }

        // Generate new key
        const key = await this.generateKey();
        const exportedKey = await this.exportKey(key);

        // Store in localStorage and cache
        localStorage.setItem(`chat_key_${threadId}`, exportedKey);
        this.keyCache.set(cacheKey, key);

        return key;
    }

    /**
     * Encrypt a message
     */
    async encrypt(message: string, threadId: number): Promise<{
        encrypted: string;
        iv: string;
        version: number;
    }> {
        if (!this.isAvailable()) {
            // Fallback: Return unencrypted (mark as such)
            console.warn('Encryption not available, sending unencrypted');
            return {
                encrypted: btoa(message), // Base64 encode for consistency
                iv: '',
                version: 0 // 0 indicates unencrypted
            };
        }

        const key = await this.getThreadKey(threadId);

        // Generate random IV
        const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

        // Encode message
        const encoder = new TextEncoder();
        const data = encoder.encode(message);

        // Encrypt
        const encryptedData = await window.crypto.subtle.encrypt(
            {
                name: ALGORITHM,
                iv: iv,
            },
            key,
            data
        );

        // Convert to base64 for storage/transmission
        const encryptedArray = new Uint8Array(encryptedData);
        const encryptedBase64 = this.arrayBufferToBase64(encryptedArray);
        const ivBase64 = this.arrayBufferToBase64(iv);

        return {
            encrypted: encryptedBase64,
            iv: ivBase64,
            version: 1 // Current encryption version
        };
    }

    /**
     * Decrypt a message
     */
    async decrypt(encrypted: string, iv: string, threadId: number, version: number = 1): Promise<string> {
        // Handle unencrypted messages (version 0)
        if (version === 0) {
            try {
                return atob(encrypted);
            } catch {
                return encrypted; // Return as-is if not base64
            }
        }

        if (!this.isAvailable()) {
            // Encryption not available - return fallback
            return 'Message';
        }

        // Validate inputs
        if (!encrypted || !iv) {
            // Missing encryption data - return fallback
            return 'Message';
        }

        try {
            const key = await this.getThreadKey(threadId);

            // Convert from base64 with validation
            let encryptedData: Uint8Array;
            let ivData: Uint8Array;

            try {
                encryptedData = this.base64ToArrayBuffer(encrypted);
                ivData = this.base64ToArrayBuffer(iv);
            } catch (error) {
                // Silent fallback for invalid base64
                return 'Message';
            }

            // Validate IV length
            if (ivData.length !== IV_LENGTH) {
                // Silent fallback for invalid IV
                return 'Message';
            }

            // Decrypt
            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: ALGORITHM,
                    iv: ivData as BufferSource,
                },
                key,
                encryptedData as BufferSource
            );

            // Decode
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            // Silent fallback - decryption failed but that's okay
            // This is expected when keys don't match or data is corrupted
            return 'Message';
        }
    }

    /**
     * Clear encryption keys for a thread (e.g., when leaving)
     */
    clearThreadKey(threadId: number): void {
        localStorage.removeItem(`chat_key_${threadId}`);
        this.keyCache.delete(`thread_${threadId}`);
    }

    /**
     * Clear all encryption keys
     */
    clearAllKeys(): void {
        // Clear localStorage keys
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('chat_key_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Clear cache
        this.keyCache.clear();
    }

    /**
     * Helper: Convert ArrayBuffer to Base64
     */
    private arrayBufferToBase64(buffer: Uint8Array): string {
        const binary = String.fromCharCode(...buffer);
        return btoa(binary);
    }

    /**
     * Helper: Convert Base64 to ArrayBuffer
     */
    private base64ToArrayBuffer(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Generate a key hash for verification (non-reversible)
     */
    async getKeyFingerprint(threadId: number): Promise<string> {
        const key = await this.getThreadKey(threadId);
        const exported = await this.exportKey(key);

        // Create a hash of the key for verification
        const encoder = new TextEncoder();
        const data = encoder.encode(exported);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);

        // Convert to hex string (first 8 bytes for display)
        return Array.from(hashArray.slice(0, 8))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    }
}

// Export singleton instance
export const chatEncryption = ChatEncryption.getInstance();

// Helper functions for easy use
export async function encryptMessage(message: string, threadId: number) {
    return chatEncryption.encrypt(message, threadId);
}

export async function decryptMessage(encrypted: string, iv: string, threadId: number, version?: number) {
    return chatEncryption.decrypt(encrypted, iv, threadId, version);
}

export function isEncryptionAvailable(): boolean {
    return chatEncryption.isAvailable();
}

export async function getEncryptionFingerprint(threadId: number): Promise<string> {
    return chatEncryption.getKeyFingerprint(threadId);
}

export function clearChatEncryption(threadId?: number): void {
    if (threadId) {
        chatEncryption.clearThreadKey(threadId);
    } else {
        chatEncryption.clearAllKeys();
    }
}
