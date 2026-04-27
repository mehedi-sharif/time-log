# Time Log

A small Astro app for logging time. It can save entries to MongoDB through Astro API routes, and it falls back to browser `localStorage` when MongoDB is not configured.

## MongoDB Setup

Create a `.env` file from `.env.example`:

```sh
cp .env.example .env
```

Then set:

```sh
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=time_log
```

Never put `MONGODB_URI` in browser JavaScript. It is read only by the server API routes.

When deploying to Vercel, add the same variables under the project environment variables:

- `MONGODB_URI`
- `MONGODB_DB`

## Run Locally

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

The static output will be generated in `dist/`.
