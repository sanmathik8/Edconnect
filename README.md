# Edconnect - AI-Driven Recommendation Platform

A full-stack web application featuring a Django backend and Next.js frontend, designed to provide intelligent recommendations and real-time chat functionality.

## 💡 About The Project

**Edconnect** is a cutting-edge social networking platform designed to deliver personalized content experiences through advanced AI recommendations. Built with a robust **Django** backend and a dynamic **Next.js** frontend, Edconnect facilitates seamless connection and interaction.

### Key Functionalities

*   **Intelligent Feed**: Leveraging **PyTorch** and **Transformers**, Recom analyzes user interests to curate a personalized feed of posts and collections.
*   **Social Connectivity**: Users can create detailed profiles, follow others, like/save posts, and organize content into "Collections" (similar to boards or albums).
*   **Real-time Communication**: A sophisticated chat system powered by **WebSockets (Django Channels & Daphne)** featuring:
    *   One-on-one and Group messaging
    *   Rich media attachments (images, videos, voice notes)
    *   Message reactions and replies
    *   Read receipts and typing indicators
    *   Privacy features like block, mute, and message requests
*   **Secure & Private**: Implements robust user authentication, end-to-end encryption concepts for messages, and comprehensive privacy controls (public/private profiles, blocking).

This project showcases a modern microservices-ready architecture suitable for scaling from a simple social app to a complex recommendation engine.

## 🚀 Features

*   **AI Recommendations**: Personalized content suggestions using PyTorch and Transformers.
*   **Real-time Chat**: WebSocket-powered messaging with Channels and Daphne.
*   **Modern UI**: Responsive and sleek interface built with Next.js 16 and Tailwind CSS.
*   **Social Connectivity**: Follow, block, and interaction features.

## 🛠 Tech Stack

### Backend
*   **Framework**: Django 5.0 + Django REST Framework
*   **Real-time**: Django Channels & Daphne
*   **Database**: PostgreSQL / SQLite (Dev)
*   **AI/ML**: PyTorch, Transformers, NumPy
*   **Authentication**: Token-based Auth

### Frontend
*   **Framework**: Next.js 16 (React 19)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS
*   **State Management**: Zustand
*   **HTTP Client**: Axios

## 📦 Installation & Setup

### Prerequisites
*   Python 3.10+
*   Node.js 18+
*   PostgreSQL (optional for dev, recommended for prod)

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start the server (Development)
python manage.py runserver

# Or with Daphne (for WebSockets)
daphne -p 8000 project.asgi:application
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## 🤝 Contributing

1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request
