
  # User request clarification

  This is a code bundle for User request clarification. The original project is available at https://www.figma.com/design/J6wC3jy7lgfRAlhTXte4tV/User-request-clarification.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Matching and Database Setup

- Scholarship ranking now uses TOPSIS and stable pairing uses Gale-Shapley in `src/app/lib/matching-algorithms.ts`.
- The scholarships page consumes this logic to produce dynamic match scores.

### Supabase Postgres backend

This app includes a minimal Node API in `Backend/` so database credentials stay on the server side.

1. Install API dependencies:
   - `cd Backend`
   - `npm install`
2. Copy `.env.example` to `.env`
3. Put your Supabase Postgres connection string in `DATABASE_URL`
4. Start API with `npm run dev`
5. In frontend root, create `.env` with:
   - `VITE_API_BASE_URL=http://localhost:4000`

Never place your database connection string directly in frontend files.

---

## System Architecture

The Design phase produced the system architecture, database schema, and user interface wireframes for the SCHOLAR platform. The system is implemented as a three-tier web application comprising:

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
  