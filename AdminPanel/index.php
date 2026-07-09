<?php
declare(strict_types=1);

session_set_cookie_params([
  'httponly' => true,
  'samesite' => 'Strict',
  'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

$validUser = 'PivoVarReshaet';
$passwordSalt = 'reliccraft-admin-panel-v1';
$passwordHash = '583321a6846e4c415be1b15152ce8b750227bc414ef6a596d53cf0e1fbc3fdb2';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $username = trim((string)($_POST['username'] ?? ''));
  $password = (string)($_POST['password'] ?? '');
  $submittedHash = hash_hmac('sha256', $password, $passwordSalt);

  if (hash_equals($validUser, $username) && hash_equals($passwordHash, $submittedHash)) {
    session_regenerate_id(true);
    $_SESSION['admin_authenticated'] = true;
    header('Location: ./');
    exit;
  }

  $error = 'Неверный логин или пароль.';
}

if (isset($_GET['logout'])) {
  $_SESSION = [];
  session_destroy();
  header('Location: ./');
  exit;
}

$isAuthenticated = !empty($_SESSION['admin_authenticated']);
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex,nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AdminPanel - RelicCraft</title>
  <link rel="stylesheet" href="../styles.css">
  <style>
    .admin-shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 120px 20px 60px;
    }

    .admin-box {
      width: min(460px, 100%);
      border: 1px solid rgba(243, 248, 239, .16);
      border-radius: 8px;
      background: rgba(10, 22, 14, .84);
      box-shadow: 0 24px 80px rgba(0, 0, 0, .34);
      padding: 28px;
    }

    .admin-box h1 {
      margin: 0 0 10px;
      font-size: clamp(32px, 6vw, 54px);
    }

    .admin-box p {
      color: var(--muted);
      margin: 0 0 22px;
    }

    .admin-form {
      display: grid;
      gap: 14px;
    }

    .admin-form label {
      display: grid;
      gap: 8px;
      color: var(--muted);
      font-weight: 800;
      font-size: 13px;
    }

    .admin-form input {
      width: 100%;
      border: 1px solid rgba(243, 248, 239, .18);
      border-radius: 8px;
      background: rgba(255, 255, 255, .08);
      color: var(--text);
      font: inherit;
      font-weight: 800;
      padding: 14px 16px;
      outline: none;
    }

    .admin-error {
      color: #ffc857;
      font-weight: 900;
      margin: 0;
    }

    .admin-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <div class="sky"></div>

  <main class="admin-shell">
    <section class="admin-box">
      <?php if ($isAuthenticated): ?>
        <div class="eyebrow">AdminPanel</div>
        <h1>Доступ открыт</h1>
        <p>Ты вошёл в закрытую страницу RelicCraft. Добавляй сюда будущие админ-инструменты.</p>
        <div class="admin-actions">
          <a class="btn" href="../"><span>На сайт</span></a>
          <a class="btn alt" href="?logout=1"><span>Выйти</span></a>
        </div>
      <?php else: ?>
        <div class="eyebrow">AdminPanel</div>
        <h1>Вход</h1>
        <p>Эта страница не отображается в меню сайта.</p>
        <form class="admin-form" method="post" action="./" autocomplete="off">
          <label>
            Username
            <input name="username" type="text" required autocomplete="username">
          </label>
          <label>
            Password
            <input name="password" type="password" required autocomplete="current-password">
          </label>
          <?php if ($error !== ''): ?>
            <p class="admin-error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p>
          <?php endif; ?>
          <button class="btn" type="submit"><span>Войти</span></button>
        </form>
      <?php endif; ?>
    </section>
  </main>

  <script src="../script.js"></script>
</body>
</html>
