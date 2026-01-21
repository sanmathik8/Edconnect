export interface User {
    id: string | number;
    name: string | null;
    email: string | null;
    emailVerified?: Date | null;
    image: string | null;
    hashedPassword?: string | null;
    createdAt: Date;
    updatedAt: Date;
    conversationIds: string[];
    seenMessageIds: string[];
}

export interface Message {
    id: string;
    body: string | null;
    image: string | null;
    createdAt: Date;
    seenIds: string[];
    seen?: User[];
    conversationId: string;
    senderId: string;
    sender: User;
}

export interface Conversation {
    id: string;
    createdAt: Date;
    lastMessageAt: Date;
    name: string | null;
    isGroup: boolean | null;
    messagesIds: string[];
    userIds: string[];
    users?: User[];
    messages?: Message[];
}

// Shim for types typically imported from @prisma/client
