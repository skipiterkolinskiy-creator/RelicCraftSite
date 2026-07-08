CREATE TABLE IF NOT EXISTS bank_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(32) NOT NULL UNIQUE,
  account_number VARCHAR(32) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  balance BIGINT NOT NULL DEFAULT 250,
  debt BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bank_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_account VARCHAR(32) NULL,
  to_account VARCHAR(32) NULL,
  amount BIGINT NOT NULL,
  comment VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO bank_accounts
  (username, account_number, password_hash, balance, debt)
VALUES
  (
    'TESTBANK',
    '1488-TK',
    '$2y$10$5QJfM8XQx1u9fM8pQkK8Xui6nFsl2CgnVYcLNmNw.4cLuyS4Qk6Uq',
    1000000,
    0
  )
ON DUPLICATE KEY UPDATE username = username;

