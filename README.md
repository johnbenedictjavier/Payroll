# LCC Payroll Management System

Modern full-stack payroll management application for the Administrator and Employee portals.

## Applications

- The repository root contains the React, Vite, TypeScript, Tailwind, and PWA frontend.
- `supabase/` contains PostgreSQL migrations, policies, and Edge Functions.
- `scripts/` contains migration and validation utilities.
- The original PHP/MySQL application remains in the repository as a legacy reference until production cutover.

## Local development

1. Copy `.env.example` to `.env.local` and set the Vite values.
2. Set the Supabase URL and publishable key.
3. Install dependencies with `npm install` from the repository root.
4. Start the frontend with `npm run dev`.

For local XAMPP PDF generation, set the optional `VITE_PHP_PDF_URL` value to the public URL of the repository's `php/` directory. The PHP adapter uses the TCPDF source from the Employee Management System reference project and the authenticated Supabase bearer token. Leave it unset when using the Supabase Edge Function PDF generators.

The browser must only receive the Supabase publishable key. Service-role credentials are for trusted migration scripts and Supabase Edge Functions only.

Active employee loan installments are authorized payroll deductions. They are estimated during preview and posted once during finalization; marking payroll paid does not apply a second deduction.

To export the live legacy database without exporting passwords, run `C:\xampp\php\php.exe scripts\migration\export_live.php`. The trusted Supabase importer requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and should only be run after reviewing `migration-output/live-source.json`.

## Database

Apply the migrations in `supabase/migrations/` using the Supabase CLI or the Supabase SQL editor. Payroll uses built-in prototype calculation defaults and does not require policy or statutory schedules for calculation; the optional statutory reference register is informational only. Do not use these results for actual Philippine salary disbursement until applicable statutory deductions have been implemented and validated.

## Deployment

The frontend is configured for Vercel from the repository root. When importing this repository into Vercel:

1. Leave **Root Directory** at `.`.
2. Use `npm run build` as the build command and `dist` as the output directory, or let `vercel.json` provide those values.
3. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as Vercel environment variables.
4. Configure Supabase Auth redirect URLs for the deployed domain.

Do not add `SUPABASE_SERVICE_ROLE_KEY` to frontend or Vercel browser environment variables.

## GitHub Pages

The `main` branch deploys automatically through `.github/workflows/deploy-pages.yml` to `https://johnbenedictjavier.github.io/Payroll/`. Enable **Settings → Pages → Source: GitHub Actions** once in the repository, then add these repository Actions secrets before the first deployment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The GitHub Pages build uses `/Payroll/` as its asset and router base. Vercel continues to use `/`.
