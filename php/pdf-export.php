<?php
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: authorization, content-type, x-supabase-key, x-supabase-url');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

final class ApiException extends RuntimeException
{
    public int $status;

    public function __construct(string $message, int $status = 400)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

const SUPABASE_PAGE_SIZE = 1000;

function env_value(string $name): string
{
    $value = getenv($name);
    if ($value === false) {
        $value = $_SERVER[$name] ?? '';
    }
    return trim((string) $value);
}

function request_header(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string) ($_SERVER[$key] ?? ''));
}

function url_origin(string $url): ?string
{
    $parts = parse_url($url);
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
        return null;
    }

    $scheme = strtolower((string) $parts['scheme']);
    $host = strtolower((string) $parts['host']);
    $port = isset($parts['port']) ? ':' . (int) $parts['port'] : '';
    return $scheme . '://' . $host . $port;
}

function normalize_supabase_url(string $value, bool $allowConfiguredHost): string
{
    $url = rtrim(trim($value), '/');
    $parts = parse_url($url);
    $host = strtolower((string) (is_array($parts) ? ($parts['host'] ?? '') : ''));
    $scheme = strtolower((string) (is_array($parts) ? ($parts['scheme'] ?? '') : ''));
    $loopback = in_array($host, ['localhost', '127.0.0.1', '::1'], true);
    $hostedSupabase = (bool) preg_match('/^[a-z0-9][a-z0-9-]*\.supabase\.co$/i', $host);

    if ($url === '' || !is_array($parts) || !isset($parts['scheme'], $parts['host']) ||
        !in_array($scheme, ['http', 'https'], true) || isset($parts['user'], $parts['pass'], $parts['query'], $parts['fragment']) ||
        ($scheme !== 'https' && !$loopback) || (!$allowConfiguredHost && !$hostedSupabase)) {
        throw new ApiException('The PHP PDF adapter has an invalid Supabase URL configuration.', 500);
    }

    return $url;
}

function token_claim(string $token, string $claim): ?string
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    $payload = strtr($parts[1], '-_', '+/');
    $padding = strlen($payload) % 4;
    if ($padding > 0) $payload .= str_repeat('=', 4 - $padding);
    $decoded = base64_decode($payload, true);
    if ($decoded === false) return null;
    $claims = json_decode($decoded, true);
    return is_array($claims) && is_string($claims[$claim] ?? null) ? $claims[$claim] : null;
}

function json_response(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

function request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        throw new ApiException('The export request was invalid.', 400);
    }
    return $body;
}

function supabase_request(string $baseUrl, string $publicKey, string $accessToken, string $path, array $query = [], ?array &$responseHeaders = null): array
{
    if (!function_exists('curl_init')) {
        throw new ApiException('PHP cURL is required for the PDF adapter.', 500);
    }

    $url = rtrim($baseUrl, '/') . $path;
    if ($query !== []) {
        $url .= '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }

    $curl = curl_init($url);
    $requestHeaders = [
        'Accept: application/json',
        'apikey: ' . $publicKey,
        'Authorization: Bearer ' . $accessToken,
    ];
    if ($responseHeaders !== null) {
        $requestHeaders[] = 'Prefer: count=exact';
        $responseHeaders = [];
        curl_setopt($curl, CURLOPT_HEADERFUNCTION, static function ($curl, string $header) use (&$responseHeaders): int {
            $length = strlen($header);
            $line = trim($header);
            if ($line !== '' && str_contains($line, ':')) {
                [$name, $value] = explode(':', $line, 2);
                $responseHeaders[strtolower(trim($name))] = trim($value);
            }
            return $length;
        });
    }
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => $requestHeaders,
    ]);
    $response = curl_exec($curl);
    $curlError = curl_error($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if ($response === false || $curlError !== '') {
        throw new ApiException('The Supabase data service could not be reached.', 502);
    }

    $decoded = json_decode($response, true);
    if ($status >= 400) {
        throw new ApiException('The requested payroll data could not be loaded.', $status === 401 ? 401 : 502);
    }
    return is_array($decoded) ? $decoded : [];
}

function supabase_request_all(string $baseUrl, string $publicKey, string $accessToken, string $path, array $query = []): array
{
    $rows = [];
    $offset = 0;

    do {
        $pageQuery = $query;
        $pageQuery['limit'] = SUPABASE_PAGE_SIZE;
        $pageQuery['offset'] = $offset;
        $responseHeaders = [];
        $page = supabase_request($baseUrl, $publicKey, $accessToken, $path, $pageQuery, $responseHeaders);
        $page = array_values($page);
        $pageCount = count($page);
        $rows = array_merge($rows, $page);
        $offset += $pageCount;
        $total = null;
        if (preg_match('#^\d+-\d+/(\d+|\*)$#', $responseHeaders['content-range'] ?? '', $matches) && $matches[1] !== '*') {
            $total = (int) $matches[1];
        }
        $hasMore = $total !== null ? $offset < $total : $pageCount === SUPABASE_PAGE_SIZE;
    } while ($pageCount > 0 && $hasMore);

    return $rows;
}

function auth_context(): array
{
    $authorization = request_header('Authorization');
    if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
        throw new ApiException('Authentication is required.', 401);
    }

    $accessToken = trim($matches[1]);
    $configuredBaseUrl = env_value('SUPABASE_URL');
    $baseUrl = normalize_supabase_url(
        $configuredBaseUrl !== '' ? $configuredBaseUrl : request_header('X-Supabase-Url'),
        $configuredBaseUrl !== '',
    );
    if ($configuredBaseUrl === '') {
        $issuer = token_claim($accessToken, 'iss');
        if ($issuer === null || url_origin($issuer) !== url_origin($baseUrl)) {
            throw new ApiException('The PHP PDF adapter could not validate the Supabase project.', 500);
        }
    }
    $publicKey = env_value('SUPABASE_PUBLISHABLE_KEY') ?: env_value('SUPABASE_ANON_KEY') ?: request_header('X-Supabase-Key');
    if ($baseUrl === '' || $publicKey === '') {
        throw new ApiException('The PHP PDF adapter is not configured for Supabase.', 500);
    }

    $user = supabase_request($baseUrl, $publicKey, $accessToken, '/auth/v1/user');
    if (!isset($user['id'])) {
        throw new ApiException('Authentication is required.', 401);
    }

    return [
        'base_url' => $baseUrl,
        'public_key' => $publicKey,
        'token' => $accessToken,
        'user' => $user,
    ];
}

function require_admin(array $context): void
{
    $roles = supabase_request(
        $context['base_url'],
        $context['public_key'],
        $context['token'],
        '/rest/v1/pms_user_roles',
        ['select' => 'role', 'user_id' => 'eq.' . $context['user']['id']]
    );
    if (!isset($roles[0]['role']) || $roles[0]['role'] !== 'admin') {
        throw new ApiException('Administrator access is required.', 403);
    }
}

function relation_value(array $row, string $key, string $field = 'name'): string
{
    $value = $row[$key] ?? null;
    if (is_array($value) && isset($value[0]) && is_array($value[0])) {
        $value = $value[0];
    }
    return is_array($value) ? trim((string) ($value[$field] ?? '')) : '';
}

function display_name(array $employee): string
{
    $last = trim((string) ($employee['last_name'] ?? ''));
    $first = trim((string) ($employee['first_name'] ?? ''));
    $middle = trim((string) ($employee['middle_name'] ?? ''));
    return trim($last . ', ' . $first . ($middle !== '' ? ' ' . $middle : ''));
}

function money(mixed $value): string
{
    return 'PHP ' . number_format((float) $value, 2);
}

function new_pdf(string $title, string $orientation = 'P'): TCPDF
{
    $pdf = new TCPDF($orientation, 'mm', 'LETTER', true);
    $pdf->SetCreator('LCC Payroll');
    $pdf->SetAuthor('LCC Payroll');
    $pdf->SetTitle($title);
    $pdf->SetHeaderData('', '', '', '');
    $pdf->setPrintHeader(false);
    $pdf->setPrintFooter(true);
    $pdf->setFooterFont(['helvetica', '', 7]);
    $pdf->setFooterMargin(8);
    $pdf->setImageScale(PDF_IMAGE_SCALE_RATIO);
    $pdf->SetMargins(12, 14, 12);
    $pdf->SetAutoPageBreak(true, 14);
    return $pdf;
}

function page_heading(TCPDF $pdf, string $title, string $subtitle): void
{
    $pdf->AddPage();
    $pdf->SetFont('helvetica', 'B', 16);
    $pdf->Cell(0, 8, 'LCC PAYROLL', 0, 1, 'L');
    $pdf->SetFont('helvetica', 'B', 11);
    $pdf->Cell(0, 7, $title, 0, 1, 'L');
    $pdf->SetFont('helvetica', '', 8);
    $pdf->Cell(0, 5, $subtitle, 0, 1, 'L');
    $pdf->Ln(4);
}

function table_header(TCPDF $pdf, array $columns): void
{
    $pdf->SetFillColor(230, 230, 230);
    $pdf->SetTextColor(20, 30, 45);
    $pdf->SetFont('helvetica', 'B', 8);
    foreach ($columns as $index => $column) {
        $pdf->Cell($column[0], 9, $column[1], 1, $index === count($columns) - 1 ? 1 : 0, $column[3] ?? 'L', true);
    }
    $pdf->SetFont('helvetica', '', 8);
}

function table_row_height(TCPDF $pdf, array $columns, array $values): float
{
    $lines = 1;
    foreach ($columns as $index => $column) {
        $lines = max($lines, $pdf->getNumLines((string) ($values[$index] ?? ''), max(8, (float) $column[0] - 4)));
    }
    return max(7.5, $lines * 4.6 + 2.5);
}

function table_row(TCPDF $pdf, array $columns, array $values, bool $strong = false, bool $fill = false): void
{
    $height = table_row_height($pdf, $columns, $values);
    $startX = $pdf->GetX();
    $startY = $pdf->GetY();
    $pdf->SetFont('helvetica', $strong ? 'B' : '', 8);
    if ($fill) $pdf->SetFillColor(245, 248, 249);
    foreach ($columns as $index => $column) {
        $width = (float) $column[0];
        $align = $column[3] ?? (in_array($column[1] ?? null, ['L', 'C', 'R'], true) ? $column[1] : 'L');
        $pdf->MultiCell($width, $height, (string) ($values[$index] ?? ''), 1, $align, $fill, 0, $startX, $startY, true, 0, false, true, $height, 'M');
        $startX += $width;
    }
    $pdf->SetXY($pdf->GetMargins()['left'], $startY + $height);
    $pdf->SetFillColor(255, 255, 255);
}

function table_row_with_header(TCPDF $pdf, array $columns, array $values, array $headerColumns, bool $strong = false, bool $fill = false): void
{
    $height = table_row_height($pdf, $columns, $values);
    if ($pdf->GetY() + $height > $pdf->getPageHeight() - 18) {
        $pdf->AddPage();
        table_header($pdf, $headerColumns);
    }
    table_row($pdf, $columns, $values, $strong, $fill);
}

function finish_pdf(TCPDF $pdf, string $filename): never
{
    $safeFilename = preg_replace('/[^a-zA-Z0-9._-]/', '', basename($filename)) ?: 'document.pdf';
    $content = $pdf->Output($safeFilename, 'S');
    header('Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . $safeFilename . '"');
    header('Content-Length: ' . strlen($content));
    echo $content;
    exit;
}

function render_directory(array $context): never
{
    require_admin($context);
    $employees = supabase_request_all(
        $context['base_url'],
        $context['public_key'],
        $context['token'],
        '/rest/v1/pms_employees',
        [
            'select' => 'id,auth_user_id,employee_number,first_name,middle_name,last_name,email,status,department:pms_departments(name),position:pms_positions(name)',
            'order' => 'last_name.asc,first_name.asc,id.asc',
        ]
    );
    $adminRows = supabase_request_all($context['base_url'], $context['public_key'], $context['token'], '/rest/v1/pms_user_roles', ['select' => 'user_id', 'role' => 'eq.admin', 'order' => 'user_id.asc']);
    $adminIds = [];
    foreach ($adminRows as $adminRow) {
        if (isset($adminRow['user_id'])) $adminIds[(string) $adminRow['user_id']] = true;
    }
    $employees = array_values(array_filter(
        $employees,
        static fn (array $employee): bool =>
            !isset($employee['auth_user_id']) ||
            !isset($adminIds[(string) $employee['auth_user_id']])
    ));

    $pdf = new_pdf('Employee directory');
    page_heading($pdf, 'Employee directory', date('F d, Y h:i A'));
    $columns = [[42, 'L'], [72, 'L'], [48, 'L'], [30, 'C']];
    $headers = [[42, 'Employee', 0], [72, 'Assignment', 0], [48, 'Contact', 0], [30, 'Status', 1, 'C']];
    table_header($pdf, $headers);
    foreach ($employees as $employee) {
        $assignment = relation_value($employee, 'position') . ' / ' . relation_value($employee, 'department');
        table_row_with_header(
            $pdf,
            $columns,
            [
                trim((string) ($employee['employee_number'] ?? '') . ' ' . display_name($employee)),
                $assignment,
                (string) ($employee['email'] ?? 'No email'),
                (string) ($employee['status'] ?? ''),
            ],
            $headers,
        );
    }
    $pdf->SetFont('helvetica', 'I', 7);
    $pdf->Ln(4);
    $pdf->Cell(0, 5, 'Administrator accounts are excluded from this directory export.', 0, 1, 'L');
    finish_pdf($pdf, 'employee-directory.pdf');
}

function render_payroll_report(array $context, ?string $periodId): never
{
    require_admin($context);
    $periodQuery = [
        'select' => 'id,name,start_date,end_date,pay_date,status',
        'status' => 'in.(finalized,paid)',
        'order' => 'start_date.desc,id.desc',
    ];
    if ($periodId !== null && $periodId !== '') $periodQuery['id'] = 'eq.' . $periodId;
    $periods = supabase_request_all($context['base_url'], $context['public_key'], $context['token'], '/rest/v1/pms_payroll_periods', $periodQuery);
    if ($periods === []) throw new ApiException('No finalized payroll records are available for this export.', 404);
    $periodIds = implode(',', array_map(static fn (array $period): string => (string) $period['id'], $periods));
    $records = supabase_request_all(
        $context['base_url'],
        $context['public_key'],
        $context['token'],
        '/rest/v1/pms_payroll_records',
        [
            'select' => 'id,employee_id,gross_pay,total_deductions,net_pay,employee_contributions,withholding_tax,employer_contributions,payroll_period_id,employee:pms_employees(employee_number,first_name,last_name)',
            'payroll_period_id' => 'in.(' . $periodIds . ')',
            'order' => 'employee_id.asc,id.asc',
        ]
    );
    $periodById = [];
    foreach ($periods as $period) $periodById[(string) $period['id']] = $period;

    $pdf = new_pdf('Finalized payroll report', 'L');
    page_heading($pdf, 'Finalized payroll report', ($periodId !== null && $periodId !== '' ? (string) ($periods[0]['name'] ?? 'Selected period') : count($periods) . ' finalized periods') . ' · ' . date('F d, Y h:i A'));
    $columns = [[50, 'L'], [39, 'L'], [35, 'R'], [45, 'R'], [43, 'R'], [43, 'R']];
    $headers = [[50, 'Employee', 0], [39, 'Period', 0], [35, 'Gross', 0, 'R'], [45, 'Deductions', 0, 'R'], [43, 'Employer', 0, 'R'], [43, 'Net pay', 1, 'R']];
    table_header($pdf, $headers);
    $gross = 0.0;
    $deductions = 0.0;
    $employer = 0.0;
    $net = 0.0;
    foreach ($records as $record) {
        $employee = is_array($record['employee'] ?? null) ? $record['employee'] : [];
        $period = $periodById[(string) ($record['payroll_period_id'] ?? '')] ?? [];
        $gross += (float) ($record['gross_pay'] ?? 0);
        $deductions += (float) ($record['total_deductions'] ?? 0);
        $employer += (float) ($record['employer_contributions'] ?? 0);
        $net += (float) ($record['net_pay'] ?? 0);
        table_row_with_header(
            $pdf,
            $columns,
            [
                trim((string) ($employee['employee_number'] ?? '') . ' ' . (string) ($employee['last_name'] ?? '') . ', ' . (string) ($employee['first_name'] ?? '')),
                (string) ($period['name'] ?? ''),
                money($record['gross_pay'] ?? 0),
                money($record['total_deductions'] ?? 0),
                money($record['employer_contributions'] ?? 0),
                money($record['net_pay'] ?? 0),
            ],
            $headers,
        );
    }
    table_row_with_header($pdf, $columns, ['TOTAL', '', money($gross), money($deductions), money($employer), money($net)], $headers, true, true);
    $pdf->SetFont('helvetica', 'I', 7);
    $pdf->Ln(4);
    $pdf->Cell(0, 5, 'Generated from finalized payroll records. Employee deductions include statutory contributions, tax, loans, and approved deductions.', 0, 1, 'L');
    finish_pdf($pdf, 'payroll-report.pdf');
}

function render_payslip(array $context, string $payslipId): never
{
    $payslips = supabase_request($context['base_url'], $context['public_key'], $context['token'], '/rest/v1/pms_employee_payslips', [
        'select' => 'id,employee_id,payroll_record_id,published_at',
        'id' => 'eq.' . $payslipId,
    ]);
    $payslip = $payslips[0] ?? null;
    if (!is_array($payslip) || empty($payslip['published_at'])) throw new ApiException('Payslip not found or not published.', 404);
    $records = supabase_request($context['base_url'], $context['public_key'], $context['token'], '/rest/v1/pms_payroll_records', [
        'select' => '*,employee:pms_employees(employee_number,first_name,last_name),period:pms_payroll_periods(name,start_date,end_date,pay_date)',
        'id' => 'eq.' . $payslip['payroll_record_id'],
    ]);
    $record = $records[0] ?? null;
    if (!is_array($record)) throw new ApiException('Payroll record not found.', 404);
    $employee = is_array($record['employee'] ?? null) ? $record['employee'] : [];
    $period = is_array($record['period'] ?? null) ? $record['period'] : [];

    $pdf = new_pdf('Employee payslip');
    page_heading($pdf, 'Employee payslip', (string) ($period['name'] ?? 'Payroll period'));
    $pdf->SetFillColor(245, 248, 249);
    $pdf->SetFont('helvetica', 'B', 9);
    $pdf->Cell(96, 8, 'Employee: ' . trim((string) ($employee['first_name'] ?? '') . ' ' . (string) ($employee['last_name'] ?? '')), 1, 0, 'L', true);
    $pdf->Cell(96, 8, 'Employee no.: ' . (string) ($employee['employee_number'] ?? ''), 1, 1, 'L', true);
    $pdf->SetFont('helvetica', '', 8);
    $pdf->Cell(96, 8, 'Pay date: ' . (string) ($period['pay_date'] ?? 'Not set'), 1, 0, 'L', true);
    $pdf->Cell(96, 8, 'Status: Published', 1, 1, 'L', true);
    $pdf->SetFillColor(255, 255, 255);
    $pdf->Ln(5);

    $columns = [[130, 'L'], [62, 'R']];
    $headers = [[130, 'Payroll component', 0], [62, 'Amount', 1, 'R']];
    table_header($pdf, $headers);
    $snapshot = is_array($record['calculation_snapshot'] ?? null) ? $record['calculation_snapshot'] : [];
    $statutory = is_array($snapshot['statutory'] ?? null) ? $snapshot['statutory'] : [];
    $sss = is_array($statutory['sss'] ?? null) ? $statutory['sss'] : [];
    $philhealth = is_array($statutory['philhealth'] ?? null) ? $statutory['philhealth'] : [];
    $pagibig = is_array($statutory['pagibig'] ?? null) ? $statutory['pagibig'] : [];
    $contributionRows = [
        ['SSS employee contribution', -((float) ($sss['employee'] ?? 0))],
        ['PhilHealth employee contribution', -((float) ($philhealth['employee'] ?? 0))],
        ['Pag-IBIG employee contribution', -((float) ($pagibig['employee'] ?? 0))],
    ];
    if (abs(array_sum(array_column($contributionRows, 1))) < 0.005 && (float) ($record['employee_contributions'] ?? 0) > 0) {
        $contributionRows = [['Employee statutory contributions', -((float) ($record['employee_contributions'] ?? 0))]];
    }
    $rows = [
        ['Base pay', $record['base_pay'] ?? $record['basic_pay'] ?? 0],
        ['Attendance deductions', -((float) ($record['attendance_deductions'] ?? 0))],
        ['Basic pay after attendance', $record['basic_pay'] ?? 0],
        ['Overtime pay', $record['overtime_pay'] ?? 0],
        ['Other income', $record['other_income'] ?? 0],
        ['Gross pay', $record['gross_pay'] ?? 0],
        ...$contributionRows,
        ['Withholding tax', -((float) ($record['withholding_tax'] ?? 0))],
        ['Loan deductions', -((float) ($record['loan_deductions'] ?? 0))],
        ['Other deductions', -((float) ($record['other_deductions'] ?? 0))],
        ['Total deductions', -((float) ($record['total_deductions'] ?? 0))],
    ];
    foreach ($rows as [$label, $amount]) {
        table_row_with_header($pdf, $columns, [(string) $label, money($amount)], $headers, in_array($label, ['Gross pay', 'Total deductions'], true));
    }
    table_row_with_header($pdf, $columns, ['NET PAY', money($record['net_pay'] ?? 0)], $headers, true, true);
    $attendance = is_array($snapshot['attendance'] ?? null) ? $snapshot['attendance'] : [];
    $pdf->Ln(5);
    $pdf->SetFillColor(245, 248, 249);
    $pdf->SetFont('helvetica', 'B', 8);
    $pdf->Cell(48, 7, 'Employer contributions', 1, 0, 'L', true);
    $pdf->SetFont('helvetica', '', 8);
    $pdf->Cell(48, 7, money($record['employer_contributions'] ?? 0), 1, 0, 'R', true);
    $pdf->SetFont('helvetica', 'B', 8);
    $pdf->Cell(48, 7, 'Attendance', 1, 0, 'L', true);
    $pdf->SetFont('helvetica', '', 8);
    $pdf->Cell(48, 7, (string) ($attendance['days_worked'] ?? 0) . ' days / ' . (string) ($attendance['overtime_hours'] ?? 0) . ' hrs OT', 1, 1, 'R', true);
    $pdf->SetFillColor(255, 255, 255);
    $pdf->SetFont('helvetica', 'I', 7);
    $pdf->Ln(5);
    $pdf->Cell(0, 5, 'Private payroll document. Statutory and tax amounts use the approved payroll schedules.', 0, 1, 'L');
    finish_pdf($pdf, 'payslip-' . preg_replace('/[^a-zA-Z0-9_-]/', '', $payslipId) . '.pdf');
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') throw new ApiException('POST is required.', 405);
    require_once __DIR__ . '/tcpdf/config/tcpdf_config.php';
    require_once __DIR__ . '/tcpdf/tcpdf.php';
    $context = auth_context();
    $body = request_body();
    $action = (string) ($body['action'] ?? '');
    if ($action === 'directory') {
        render_directory($context);
    }
    if ($action === 'payroll-report') {
        render_payroll_report($context, isset($body['period_id']) && is_string($body['period_id']) ? $body['period_id'] : null);
    }
    if ($action === 'payslip' && isset($body['payslip_id']) && is_string($body['payslip_id'])) {
        render_payslip($context, $body['payslip_id']);
    }
    throw new ApiException('Unknown PDF export.', 400);
} catch (ApiException $error) {
    json_response(['error' => $error->getMessage()], $error->status);
} catch (Throwable $error) {
    json_response(['error' => 'The PDF could not be generated.'], 500);
}
