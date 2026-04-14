# Aether | Tell your stories

**Aether** is a professional, full-stack  story publishing platform built with Next.js, MongoDB, and AWS S3. It offers a seamless writing experience coupled with a beautiful, high-performance reader interface.

## ✨ Key Features

- 📊 **Feed**: View all public stories, including a curated tab with an auto-filter based on interests selected in your profile settings.
- 🔍 **Discovery**: Global search functionality and content filtering to discover stories across the community.
- 🧡 **Favorites System**: Save your favorite stories to your personal library.
- 🔐 **Authentication**: Secure login and profile management powered by **Auth0**.
- 📁 **Cloud Storage**: Image management with **AWS S3** integration for reliable media delivery.
- 🖋️ **Elite Editor**: Rich text editor with custom formatting and **Cover Image** support.
- 📖 **Reader Preview**: High-fidelity reading experience for all published stories.

## 🛠️ Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **Next.js 16** | Core Framework & App Router |
| **Tailwind CSS 4** | Minimalist Styling |
| **MongoDB / Mongoose** | NoSQL Database |
| **Auth0** | Identity Management |
| **AWS S3** | Cloud Object Storage |

## 🔌 API Reference

### Blogs & Publishing
- `GET /api/blogs` - Retrieve all published stories.
- `POST /api/blogs` - Create a new story draft.
- `GET /api/blogs/me` - Access your personal dashboard items.
- `GET /api/blogs/[id]` - Detailed view of a specific story.
- `PUT /api/blogs/[id]` - Publish or update a story.
- `DELETE /api/blogs/[id]` - Remove a story forever.

### Favorites & Interactions
- `GET /api/favorites` - Retrieve all stories favorited by the current user.
- `POST /api/favorites` - Toggle favorite status

### Media & Profile
- `POST /api/upload` - Secure AWS S3 image upload bridge.
- `GET /api/user` - Auth0 user profile data and settings.

## 📁 Project Structure

```bash
├── src/
│   ├── app/           # Next.js App Router, APIs, and globals.css
│   ├── components/    # Reusable UI components (Sidebar, Editor, etc.)
│   ├── context/       # Auth & Theme State providers
│   ├── lib/           # Database connections & Shared utilities
│   ├── models/        # Mongoose Schemas (Blog, User, Comment)
│   └── proxy.ts       # S3 Media proxy utility
├── public/            # Static branding assets
└── package.json       # Project configuration
```

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm or pnpm
- MongoDB Atlas account
- Auth0 application
- AWS S3 bucket

### 2. Installation
```bash
git clone https://github.com/Sindhuja-5/aether.git
cd aether
npm install
```

### 3. Environment Setup
Create a `.env.local` file in the root directory:
```env
# Database
MONGODB_URI=

# Auth0
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET_NAME=
```

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🚢 Deployment
Push to GitHub and connect to Vercel. Ensure all environment variables are configured in the Vercel dashboard.
