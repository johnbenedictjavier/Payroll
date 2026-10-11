# LCC Payroll Management System

Modern full-stack payroll management application for the Administrator and Employee portals.

## Applications

- `app/` contains the React, Vite, TypeScript, Tailwind, and PWA frontend.
- `supabase/` contains PostgreSQL migrations, policies, and Edge Functions.
- `scripts/` contains migration and validation utilities.
- The original PHP/MySQL application remains in the repository as a legacy reference until production cutover.

## Local development

1. Copy `app/.env.example` to `app/.env.local` or copy the root `.env.example` values into the Vite environment.
2. Set the Supabase URL and publishable key.
3. Install dependencies with `npm install` inside `app/`.
4. Start the frontend with `npm run dev`.

The browser must only receive the Supabase publishable key. Service-role credentials are for trusted migration scripts and Supabase Edge Functions only.

To export the live legacy database without exporting passwords, run `C:\xampp\php\php.exe scripts\migration\export_live.php`. The trusted Supabase importer requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and should only be run after reviewing `migration-output/live-source.json`.

## Database

Apply the migrations in `supabase/migrations/` using the Supabase CLI or the Supabase SQL editor. Review the statutory schedule seed data before activating it for production payroll.

## Deployment

The frontend is configured for Vercel from the `app/` project root. When importing this repository into Vercel:

1. Set **Root Directory** to `app`.
2. Use `npm run build` as the build command and `dist` as the output directory, or let `app/vercel.json` provide those values.
3. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as Vercel environment variables.
4. Configure Supabase Auth redirect URLs for the deployed domain.

Do not add `SUPABASE_SERVICE_ROLE_KEY` to frontend or Vercel browser environment variables.
