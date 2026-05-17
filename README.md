# SCHOLAR — Team Setup Guide

## Requirements
- Node.js v18+
- Git

## Backend Setup
1. Open terminal → cd Backend
2. Run: npm install
3. Create a .env file (copy from .env.example)
4. Run: node index.js or npm run dev
5. Should see: "Server running on port 5000"
6. Should see: "MongoDB connected"

## Frontend Setup
1. Open new terminal → cd Frontend
2. Run: npm install
3. Create a .env file (copy from .env.example)
   Add: VITE_API_URL=http://localhost:5000
4. Run: npm run dev
5. Open: http://localhost:5173

## If you get the DOCTYPE JSON error:
- Make sure backend is running on port 5000
- Check vite.config.ts has the proxy config
- Check your .env files exist and are correct
- Never run only the frontend without the backend

## Environment Variables

### Backend (.env)
```
PORT=5000
MONGODB_URI=your_mongodb_uri_here
JWT_SECRET=your_jwt_secret_here
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000
```

## Common Issues

### DOCTYPE JSON Error
This error occurs when the frontend tries to parse HTML (like a 404 page) as JSON. It usually means:
1. Backend is not running
2. Backend is running on wrong port
3. Proxy configuration is missing

### Port Conflicts
- Backend must run on port 5000
- Frontend will run on port 5173 (or next available)
- Check if port 5000 is already in use

### MongoDB Connection
- Make sure your MongoDB URI is correct
- Check network connectivity
- Verify database user permissions

## Development Workflow
1. Always start backend first
2. Then start frontend
3. Make changes to either codebase
4. Frontend will auto-reload
5. Backend will restart with --watch flag

## Testing
- [ ] Backend runs on port 5000 without errors
- [ ] Frontend runs on port 5173
- [ ] Opening http://localhost:5173 loads the app
- [ ] Login works
- [ ] Browsing scholarships works
- [ ] Applying to a scholarship works — no DOCTYPE error
- [ ] Application appears in My Applications page
- [ ] Application appears in admin panel

---

## System Architecture


### Presentation Layer (Front-End)
- **React.js 18** with **TypeScript** for type-safe component development
- **Vite** as the build tool and development server for fast HMR and optimized builds
- **Tailwind CSS** for utility-first styling with custom theme support
- **Material-UI (MUI)** and **Radix UI** component libraries for accessible, pre-built UI components
- **React Router v7** for client-side routing and navigation management
- **React Hook Form** for efficient form handling and validation

### Application Logic Layer (Back-End)
- **Node.js** with **Express.js 5.x** as the REST API framework
- **ES Modules (ESM)** for modern JavaScript module system
- **CORS** middleware for cross-origin resource sharing
- Modular API structure with dedicated endpoints for authentication, scholarships, providers, and recommendations

### Data Layer
- **PostgreSQL** database hosted on **Supabase**
- **JSONB document storage** pattern using a collection-based filtering approach
- Connection pooling with configurable pool size and SSL/TLS support

### Hybrid Matching Algorithm
The recommendation system is implemented as a modular service within the back-end (`matching-algorithms.js`), combining:
1. **TOPSIS** - Multi-criteria decision-making for ranking scholarships based on GPA fit, financial need, field of study, location, and deadline urgency
2. **Gale-Shapley** - Stable matching algorithm for optimal student-scholarship pairing

### User Roles
The platform supports three distinct user roles, each with dedicated dashboards:
1. **Student Applicants** (`/dashboard`) - Profile management, recommendations, applications
2. **Scholarship Providers** (`/provider/dashboard`) - Scholarship creation and application review
3. **System Administrators** (`/admin`) - User management, platform oversight, and analytics
  