<?php
declare(strict_types=1);

// Read-only export of the live legacy database. Password values are intentionally excluded.
$host = getenv('MYSQL_HOST') ?: '127.0.0.1';
$port = getenv('MYSQL_PORT') ?: '3306';
$database = getenv('MYSQL_DATABASE') ?: 'aura_payroll';
$user = getenv('MYSQL_USER') ?: 'root';
$password = getenv('MYSQL_PASSWORD') ?: '';
$output = $argv[1] ?? dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'migration-output' . DIRECTORY_SEPARATOR . 'live-source.json';

$pdo = new PDO("mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4", $user, $password, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$tables = [
    'department', 'position', 'employee_info', 'employee_position', 'e_contact',
    'dependent', 'educ_bg', 'charac_ref', 'valid_id',
];
$export = [
    'source' => $database,
    'exported_at' => gmdate('c'),
    'tables' => [],
    'users' => [],
    'warnings' => [],
];

foreach ($tables as $table) {
    $statement = $pdo->query("SELECT * FROM `{$table}`");
    $export['tables'][$table] = $statement->fetchAll();
}

// Keep role and account mapping information, never the legacy plaintext password.
$users = $pdo->query('SELECT user_id, employee_num, full_name, role, created_at FROM `user`')->fetchAll();
$export['users'] = array_map(static function (array $row): array {
    $row['credential_status'] = 'reset_required';
    return $row;
}, $users);

$duplicateEmails = $pdo->query("SELECT email, COUNT(*) AS employee_count FROM employee_info WHERE email IS NOT NULL AND email <> '' GROUP BY email HAVING COUNT(*) > 1")->fetchAll();
if ($duplicateEmails) $export['warnings'][] = ['type' => 'duplicate_email', 'rows' => $duplicateEmails];

$suspiciousSalaries = $pdo->query('SELECT employee_num, monthly, daily, hourly FROM employee_position WHERE monthly >= 100000 OR daily >= 10000 OR hourly >= 1000')->fetchAll();
if ($suspiciousSalaries) $export['warnings'][] = ['type' => 'suspicious_salary', 'rows' => $suspiciousSalaries];

$directory = dirname($output);
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException("Unable to create {$directory}");
file_put_contents($output, json_encode($export, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), LOCK_EX);
fwrite(STDOUT, "Exported {$output}\n");
