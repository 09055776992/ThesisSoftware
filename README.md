
  # User request clarification

  This is a code bundle for User request clarification. The original project is available at https://www.figma.com/design/J6wC3jy7lgfRAlhTXte4tV/User-request-clarification.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Matching and Database Setup

- Scholarship ranking now uses TOPSIS and stable pairing uses Gale-Shapley in `src/app/lib/matching-algorithms.ts`.
- The scholarships page consumes this logic to produce dynamic match scores.

### MongoDB (Atlas) backend

This app includes a minimal Node API in `server/` so Mongo credentials stay on the server side.

1. Install API dependencies:
   - `cd server`
   - `npm install`
2. Copy `.env.example` to `.env`
3. Put your Atlas connection string in `MONGODB_URI`
4. Start API with `npm run dev`
5. In frontend root, create `.env` with:
   - `VITE_API_BASE_URL=http://localhost:4000`

Never place your MongoDB URI directly in frontend files.
  