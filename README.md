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

## Architecture

This app is deployed as a **static frontend**. The browser talks directly to the database, and database access is controlled by RLS policies.

- Vercel hosts only the generated frontend (`dist/client`).
- There is no Vercel runtime backend required.
- Movie search calls TMDB from the browser, so the TMDB read token is exposed in the frontend bundle.

## Local development

### 1) Configure local env

Create a local env file:

```sh
cp .env.example .env
```

Set the only required frontend env var locally:

- `VITE_TMDB_READ_TOKEN`

### 2) Start locally

```sh
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
