# RecoM Frontend - Next.js Version

A modern, fully converted Next.js frontend for the RecoM social recommendation platform. This replaces the Django template-based UI with a TypeScript React app using Next.js 16.

## 🎨 Features

- **Beautiful Dark Theme**: Custom CSS with gradient accents (teal/cyan/blue)
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **TypeScript Support**: Full type safety across all pages
- **Tailwind CSS**: Utility-first styling with custom components
- **Real-time Features**: Chat, notifications, and feed updates
- **API Integration**: Connected to Django backend for data persistence

## 📁 Project Structure

```
frontend/src/
├── app/
│   ├── page.tsx                 # Home page
│   ├── globals.css              # Global dark theme styles
│   ├── layout.tsx               # Root layout with navbar
│   ├── feed/
│   │   └── page.tsx             # User's personalized feed
│   ├── explore/
│   │   └── page.tsx             # Browse trending posts
│   ├── discover/
│   │   └── page.tsx             # Find recommended users
│   ├── profile/
│   │   └── page.tsx             # User profile & posts
│   ├── chat/
│   │   └── page.tsx             # Real-time messaging
│   ├── notifications/
│   │   └── page.tsx             # Notification center
│   └── auth/
│       ├── login/page.tsx       # Login form
│       └── register/page.tsx    # Registration form
├── components/
│   └── Navbar.tsx               # Navigation component
└── ...
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (npm 10+)
- Django backend running on `http://localhost:8000`

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Build for Production

```bash
npm run build
npm start
```

## 🔌 API Integration

The frontend connects to the Django REST API endpoints:

### Authentication
- `POST /login/` - Login user
- `POST /register/` - Create new account
- `GET /api/me/profile/` - Get current user profile

### Posts
- `GET /api/posts/feed/` - Get personalized feed
- `GET /api/posts/explore/` - Browse public posts
- `POST /api/posts/` - Create new post
- `POST /api/posts/{id}/like/` - Toggle like on post
- `POST /api/posts/{id}/save/` - Save post

### Discovery
- `GET /api/discover/?k=12` - Get recommended users
- `GET /api/posts/user-posts/` - Get user's posts

### Chat
- `GET /api/chat/threads/` - List chat threads
- `GET /api/chat/threads/{id}/` - Get thread with messages
- `POST /api/chat/messages/` - Send message

## 🎨 Styling

### Color Scheme
- **Background**: `#0f1724` (deep navy)
- **Card**: `#0b1220` (darker navy)
- **Accent**: `#6ee7b7` (teal green)
- **Accent Bright**: `#60a5fa` (cyan blue)
- **Text**: `#e8eef5` (light blue-white)
- **Text Muted**: `#9aa4b2` (dusty blue)

### CSS Classes

Global utility classes available:
- `.btn-primary` - Green gradient button
- `.btn-secondary` - Dark border button
- `.card` - Gradient card with blur effect
- `.input-field` - Styled input with focus effects
- `.navbar` - Fixed navigation bar

## 🔄 Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## 📦 Dependencies

- **next**: React framework
- **react**: UI library
- **typescript**: Type safety
- **tailwindcss**: Styling utility
- **eslint**: Code linting

## 🐛 Troubleshooting

### API Errors
If you see 404 errors for API endpoints:
1. Ensure Django backend is running on port 8000
2. Check that API endpoints exist in `core/urls.py`
3. Verify CORS is properly configured

### Styling Issues
- Gradients may show Tailwind warnings (bg-gradient-to-r) - this is expected, they work fine
- Custom CSS in `globals.css` handles dark theme and additional styling

### Build Errors
```bash
# Clear Next.js cache and rebuild
rm -r .next
npm run dev
```

## 📝 Pages & Components

### Home (`/`)
Landing page with CTA buttons

### Feed (`/feed`)
- Display personalized posts
- Create new posts
- Like posts
- See post author info

### Explore (`/explore`)
- Browse trending/public posts
- Like and save posts
- Grid layout showcase

### Discover (`/discover`)
- Find recommended users
- View user profiles
- Send messages
- Matching score display

### Profile (`/profile`)
- Current user profile info
- User's posts gallery
- Edit profile (modal)
- Interests/bio display

### Chat (`/chat`)
- Conversation list
- Real-time messaging
- Message history
- Participant display

### Notifications (`/notifications`)
- Notification feed
- Read/unread status
- Type icons (like, follow, etc.)
- Actor information

### Auth
- **Login**: Sign in with credentials
- **Register**: Create new account with optional bio/interests

## 🔐 Security Notes

- Authentication tokens should be stored securely (consider httpOnly cookies)
- Chat messages should be encrypted in transit
- User data should be validated server-side (already done in Django)
- Consider CSRF protection for all POST requests

## 📚 Next Steps

1. **User Embeddings**: Train ML models for better recommendations
2. **WebSocket Chat**: Replace polling with real-time WebSocket connection
3. **Push Notifications**: Implement browser notifications
4. **File Uploads**: Add image upload UI for posts
5. **Dark Mode Toggle**: Allow users to switch themes
6. **Search**: Add global search functionality

## 🤝 Contributing

- Follow TypeScript conventions
- Use the existing component patterns
- Test locally before pushing
- Keep Tailwind classes organized

## 📄 License

Same as the main RecoM project
