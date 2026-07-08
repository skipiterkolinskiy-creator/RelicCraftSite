<?php
declare(strict_types=1);

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/config.php';

function out(array $payload): never
{
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $code = 400): never
{
    http_response_code($code);
    out(['ok' => false, 'error' => $message]);
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASSWORD,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
        return $pdo;
    } catch (Throwable $e) {
        fail('Банк сейчас недоступен: ошибка подключения к базе.', 500);
    }
}

function ensureSchema(): void
{
    $pdo = db();
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS bank_accounts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(32) NOT NULL UNIQUE,
            account_number VARCHAR(32) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            balance BIGINT NOT NULL DEFAULT 250,
            debt BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS bank_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            from_account VARCHAR(32) NULL,
            to_account VARCHAR(32) NULL,
            amount BIGINT NOT NULL,
            comment VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    $password = 'TestoviyBank19pgb83g1313';
    $stmt = $pdo->prepare("SELECT id, password_hash FROM bank_accounts WHERE username = 'TESTBANK' LIMIT 1");
    $stmt->execute();
    $test = $stmt->fetch();

    if (!$test) {
        $stmt = $pdo->prepare("
            INSERT INTO bank_accounts (username, account_number, password_hash, balance, debt)
            VALUES ('TESTBANK', '1488-TK', ?, 1000000, 0)
        ");
        $stmt->execute([password_hash($password, PASSWORD_DEFAULT)]);
        return;
    }

    if (!password_verify($password, (string) $test['password_hash'])) {
        $stmt = $pdo->prepare("UPDATE bank_accounts SET password_hash = ? WHERE id = ?");
        $stmt->execute([password_hash($password, PASSWORD_DEFAULT), (int) $test['id']]);
    }
}

function body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '[]', true);
    return is_array($data) ? $data : [];
}

function cleanName(string $name): string
{
    $name = trim($name);
    if (!preg_match('/^[A-Za-z0-9_]{3,16}$/', $name)) {
        fail('Ник должен быть 3-16 символов: буквы, цифры или _.');
    }
    return $name;
}

function cleanAmount($value): int
{
    if (!is_numeric($value)) {
        fail('Сумма должна быть числом.');
    }
    $amount = (int) floor((float) $value);
    if ($amount <= 0) {
        fail('Сумма должна быть больше 0.');
    }
    if ($amount > 100000000) {
        fail('Слишком большая сумма.');
    }
    return $amount;
}

function makeAccountNumber(string $username): string
{
    $first = strtoupper(substr($username, 0, 1));
    $last = strtoupper(substr($username, -1));
    for ($i = 0; $i < 30; $i++) {
        $number = random_int(10000, 99999) . '-' . $first . $last;
        $stmt = db()->prepare('SELECT id FROM bank_accounts WHERE account_number = ? LIMIT 1');
        $stmt->execute([$number]);
        if (!$stmt->fetch()) {
            return $number;
        }
    }
    fail('Не получилось создать номер счёта, попробуй ещё раз.', 500);
}

function currentAccount(): array
{
    if (empty($_SESSION['bank_account_id'])) {
        fail('Нужно войти в банк.', 401);
    }

    $stmt = db()->prepare('SELECT * FROM bank_accounts WHERE id = ? LIMIT 1');
    $stmt->execute([(int) $_SESSION['bank_account_id']]);
    $account = $stmt->fetch();
    if (!$account) {
        unset($_SESSION['bank_account_id']);
        fail('Сессия устарела, войди заново.', 401);
    }
    return $account;
}

function publicAccount(array $account): array
{
    return [
        'username' => $account['username'],
        'accountNumber' => $account['account_number'],
        'balance' => (int) $account['balance'],
        'debt' => (int) $account['debt'],
    ];
}

function historyFor(string $accountNumber): array
{
    $stmt = db()->prepare("
        SELECT from_account, to_account, amount, comment, created_at
        FROM bank_transactions
        WHERE from_account = ? OR to_account = ?
        ORDER BY id DESC
        LIMIT 20
    ");
    $stmt->execute([$accountNumber, $accountNumber]);
    return $stmt->fetchAll();
}

function responseWithAccount(array $account): never
{
    out([
        'ok' => true,
        'account' => publicAccount($account),
        'history' => historyFor((string) $account['account_number']),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Bad request', 405);
}

ensureSchema();

$data = body();
$action = (string) ($data['action'] ?? '');
$pdo = db();

if ($action === 'login') {
    $username = cleanName((string) ($data['username'] ?? ''));
    $password = (string) ($data['password'] ?? '');
    if ($password === '') {
        fail('Введи пароль.');
    }

    $stmt = $pdo->prepare('SELECT * FROM bank_accounts WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $account = $stmt->fetch();

    if (!$account) {
        $stmt = $pdo->prepare('
            INSERT INTO bank_accounts (username, account_number, password_hash, balance, debt)
            VALUES (?, ?, ?, 250, 0)
        ');
        $stmt->execute([$username, makeAccountNumber($username), password_hash($password, PASSWORD_DEFAULT)]);
        $stmt = $pdo->prepare('SELECT * FROM bank_accounts WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $account = $stmt->fetch();
    } elseif (!password_verify($password, (string) $account['password_hash'])) {
        fail('Неверный ник или пароль.', 401);
    }

    session_regenerate_id(true);
    $_SESSION['bank_account_id'] = (int) $account['id'];
    responseWithAccount($account);
}

if ($action === 'me') {
    responseWithAccount(currentAccount());
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);
}

if ($action === 'transfer') {
    $from = currentAccount();
    $toNumber = strtoupper(trim((string) ($data['to'] ?? '')));
    $amount = cleanAmount($data['amount'] ?? 0);
    $comment = trim((string) ($data['comment'] ?? ''));
    $comment = substr($comment, 0, 255);

    if ($toNumber === (string) $from['account_number']) {
        fail('Нельзя перевести самому себе.');
    }

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('SELECT * FROM bank_accounts WHERE id = ? FOR UPDATE');
        $stmt->execute([(int) $from['id']]);
        $from = $stmt->fetch();

        $stmt = $pdo->prepare('SELECT * FROM bank_accounts WHERE account_number = ? FOR UPDATE');
        $stmt->execute([$toNumber]);
        $to = $stmt->fetch();
        if (!$to) {
            throw new RuntimeException('Счёт получателя не найден.');
        }
        if ((int) $from['balance'] < $amount) {
            throw new RuntimeException('Недостаточно денег.');
        }

        $stmt = $pdo->prepare('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?');
        $stmt->execute([$amount, (int) $from['id']]);
        $stmt = $pdo->prepare('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?');
        $stmt->execute([$amount, (int) $to['id']]);
        $stmt = $pdo->prepare('INSERT INTO bank_transactions (from_account, to_account, amount, comment) VALUES (?, ?, ?, ?)');
        $stmt->execute([(string) $from['account_number'], (string) $to['account_number'], $amount, $comment]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        fail($e->getMessage());
    }

    responseWithAccount(currentAccount());
}

if ($action === 'loan') {
    $account = currentAccount();
    $amount = cleanAmount($data['amount'] ?? 0);
    if ($amount > 50000) {
        fail('За раз можно взять максимум 50000$.');
    }

    $stmt = $pdo->prepare('UPDATE bank_accounts SET balance = balance + ?, debt = debt + ? WHERE id = ?');
    $stmt->execute([$amount, $amount, (int) $account['id']]);
    $stmt = $pdo->prepare('INSERT INTO bank_transactions (from_account, to_account, amount, comment) VALUES (NULL, ?, ?, ?)');
    $stmt->execute([(string) $account['account_number'], $amount, 'Долг']);
    responseWithAccount(currentAccount());
}

if ($action === 'repay') {
    $account = currentAccount();
    $amount = cleanAmount($data['amount'] ?? 0);
    $amount = min($amount, (int) $account['debt'], (int) $account['balance']);
    if ($amount <= 0) {
        fail('Нечего погашать.');
    }

    $stmt = $pdo->prepare('UPDATE bank_accounts SET balance = balance - ?, debt = debt - ? WHERE id = ?');
    $stmt->execute([$amount, $amount, (int) $account['id']]);
    $stmt = $pdo->prepare('INSERT INTO bank_transactions (from_account, to_account, amount, comment) VALUES (?, NULL, ?, ?)');
    $stmt->execute([(string) $account['account_number'], $amount, 'Погашение долга']);
    responseWithAccount(currentAccount());
}

fail('Неизвестное действие.');
