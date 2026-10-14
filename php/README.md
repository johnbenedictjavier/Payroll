# TCPDF Adapter

This adapter reuses the TCPDF generation approach from:

`C:\xampp\htdocs\_WEBSITES\Employee Management System - Progress 4 (PDO)`

The vendored TCPDF files under `php/tcpdf/` are based on that project's `pdf/` directory. The legacy `test_report.php` MySQL query is not reused; this endpoint reads the current Supabase data with the authenticated user's bearer token so Supabase RLS remains in control.

For local XAMPP use, expose this directory through PHP and set `VITE_PHP_PDF_URL` to its URL, for example:

`http://localhost/Payroll/Payroll2/php`

PHP must have cURL enabled. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the PHP/Apache environment for production and for a local Supabase instance. For local XAMPP use with a hosted Supabase project, the endpoint can accept the browser's publishable key and Supabase URL only when the URL matches the bearer token issuer. No service-role key is used by this adapter.
