
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
  