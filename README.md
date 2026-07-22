# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Architecture (frontend + backend)

This app uses **TanStack Start server functions** as backend logic (in `src/lib/*.functions.ts`) plus Supabase.

- Frontend only on Vercel + backend on `localhost` does **not** work directly.
- Vercel cannot call `localhost`; your backend must be reachable from the public internet.

## Run backend on your machine (with Vercel frontend)

### 1) Start backend locally

Run the app server on your machine:

```sh
npm i
npm run dev
```

Set required backend env vars locally:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server/admin operations)
- `TMDB_READ_TOKEN`

You can start from:

```sh
cp .env.example .env
```

### 2) Expose local backend with HTTPS tunnel

Use a tunnel service (Cloudflare Tunnel or ngrok) to expose your local backend port.

Example with ngrok:

```sh
ngrok http 3000
```

Keep the tunnel running and note the public HTTPS URL (example: `https://my-backend.ngrok.app`).

### 3) Connect Vercel frontend to the backend URL

Configure Vercel rewrites/proxy so backend routes are forwarded to the tunnel URL.

At minimum, forward TanStack server function routes (commonly `/_server/*`) to:

- `https://my-backend.ngrok.app`

Then redeploy frontend and verify requests are reaching your tunnel.

### 4) Supabase auth configuration

If you use Supabase auth, add your frontend and tunnel domains to Supabase:

- **Authentication → URL Configuration**
  - Site URL: your Vercel frontend URL
  - Additional Redirect URLs: Vercel URL + tunnel URL

### 5) Validate end-to-end flow

Check all critical flows after each redeploy/tunnel restart:

- Login/logout
- Proposal + vote actions
- Admin actions (create/update screening, settings)
- TMDB movie search

## Production recommendation

- For production reliability, host backend on Vercel or a VPS/server.
- Keep local backend + tunnel for temporary testing only.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
