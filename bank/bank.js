const storageKey = "reliccraft-bank-live-v1";
const sessionKey = "reliccraft-bank-session-v1";

const authPanel = document.querySelector("#bank-auth");
const appPanel = document.querySelector("#bank-app");
const loginForm = document.querySelector("#bank-login");
const authStatus = document.querySelector("#bank-auth-status");
const statusLine = document.querySelector("#bank-status");
const playerLabel = document.querySelector("#bank-player");
const accountLabel = document.querySelector("#bank-account");
const balanceLabel = document.querySelector("#bank-balance");
const debtLabel = document.querySelector("#bank-debt");
const historyList = document.querySelector("#bank-history");

let currentUser = sessionStorage.getItem(sessionKey) || "";
let currentAccount = null;

function money(value) {
  return `${Math.floor(Number(value) || 0)}$`;
}

function now() {
  return new Date().toLocaleString("ru-RU");
}

function normalizeName(value) {
  return String(value || "").trim();
}

async function digest(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setStatus(target, message, mode = "") {
  target.textContent = message;
  target.className = `bank-status ${mode}`.trim();
}

function accountFor(username) {
  const clean = normalizeName(username) || "Player";
  if (clean.toUpperCase() === "TESTBANK") {
    return "1488-TK";
  }

  let total = 0;
  for (let index = 0; index < clean.length; index += 1) {
    total += clean.charCodeAt(index) * (index + 17);
  }

  const digits = String(10000 + (total % 90000));
  const first = clean[0] || "X";
  const last = clean[clean.length - 1] || "X";
  return `${digits}-${first}${last}`;
}

function readBank() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    data = null;
  }

  if (!data || typeof data !== "object") {
    data = { users: {} };
  }

  if (!data.users.testbank) {
    data.users.testbank = {
      username: "TESTBANK",
      passwordHash: "",
      fixedPassword: "TestoviyBank19pgb83g1313",
      account: "1488-TK",
      balance: 1000000,
      debt: 0,
      history: [
        {
          amount: 1000000,
          details: "Тестовый банковский счёт",
          at: now(),
        },
      ],
    };
    writeBank(data);
  }

  return data;
}

function writeBank(data) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function findUserByAccount(data, account) {
  const needle = String(account || "").trim().toLowerCase();
  return Object.values(data.users).find((user) => String(user.account).toLowerCase() === needle);
}

function addHistory(user, amount, details) {
  user.history = user.history || [];
  user.history.unshift({ amount, details, at: now() });
  user.history = user.history.slice(0, 50);
}

function renderAccount(account, history = []) {
  currentAccount = account;
  authPanel.classList.add("bank-hidden");
  appPanel.classList.remove("bank-hidden");
  playerLabel.textContent = account.username;
  accountLabel.textContent = account.account;
  balanceLabel.textContent = money(account.balance);
  debtLabel.textContent = money(account.debt);

  historyList.innerHTML = "";
  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "bank-note";
    empty.textContent = "Операций пока нет.";
    historyList.appendChild(empty);
    return;
  }

  history.forEach((item) => {
    const row = document.createElement("div");
    row.className = "bank-row";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.details;
    const time = document.createElement("small");
    time.textContent = item.at;
    text.append(title, time);

    const amount = document.createElement("strong");
    amount.className = `bank-amount ${Number(item.amount) >= 0 ? "plus" : "minus"}`;
    amount.textContent = `${Number(item.amount) >= 0 ? "+" : ""}${money(item.amount)}`;
    row.append(text, amount);
    historyList.appendChild(row);
  });
}

function refresh() {
  const data = readBank();
  const user = data.users[currentUser];

  if (!user) {
    sessionStorage.removeItem(sessionKey);
    currentUser = "";
    appPanel.classList.add("bank-hidden");
    authPanel.classList.remove("bank-hidden");
    return;
  }

  renderAccount(user, user.history || []);
  setStatus(statusLine, "");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const username = normalizeName(form.get("username"));
  const password = String(form.get("password") || "");
  const key = username.toLowerCase();

  if (!username || !password) {
    setStatus(authStatus, "Введи ник и пароль.", "bad");
    return;
  }

  const data = readBank();
  let user = data.users[key];

  if (!user) {
    user = {
      username,
      passwordHash: await digest(password),
      account: accountFor(username),
      balance: 250,
      debt: 0,
      history: [],
    };
    addHistory(user, 250, "Стартовый баланс");
    data.users[key] = user;
    writeBank(data);
  } else if (user.fixedPassword) {
    if (password !== user.fixedPassword) {
      setStatus(authStatus, "Неверный ник или пароль.", "bad");
      return;
    }
  } else if (user.passwordHash !== await digest(password)) {
    setStatus(authStatus, "Неверный ник или пароль.", "bad");
    return;
  }

  currentUser = key;
  sessionStorage.setItem(sessionKey, key);
  loginForm.reset();
  setStatus(authStatus, "");
  renderAccount(user, user.history || []);
});

document.querySelector("#bank-transfer").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const targetAccount = String(form.get("target") || "").trim();
  const amount = Math.floor(Number(form.get("amount") || 0));
  const comment = String(form.get("comment") || "").trim();
  const data = readBank();
  const sender = data.users[currentUser];
  const receiver = findUserByAccount(data, targetAccount);

  if (!sender) {
    setStatus(statusLine, "Сначала войди в банк.", "bad");
    return;
  }

  if (!receiver) {
    setStatus(statusLine, "Счёт получателя не найден.", "bad");
    return;
  }

  if (receiver.account === sender.account) {
    setStatus(statusLine, "Нельзя переводить самому себе.", "bad");
    return;
  }

  if (amount <= 0 || sender.balance < amount) {
    setStatus(statusLine, "Недостаточно средств.", "bad");
    return;
  }

  sender.balance -= amount;
  receiver.balance += amount;
  addHistory(sender, -amount, `Перевод игроку ${receiver.username}${comment ? `: ${comment}` : ""}`);
  addHistory(receiver, amount, `Перевод от ${sender.username}${comment ? `: ${comment}` : ""}`);
  writeBank(data);
  event.currentTarget.reset();
  renderAccount(sender, sender.history || []);
  setStatus(statusLine, "Перевод выполнен.", "ok");
});

document.querySelector("#bank-loan").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Math.floor(Number(new FormData(event.currentTarget).get("amount") || 0));
  const data = readBank();
  const user = data.users[currentUser];

  if (!user) {
    setStatus(statusLine, "Сначала войди в банк.", "bad");
    return;
  }

  if (amount <= 0 || amount > 50000) {
    setStatus(statusLine, "Можно взять от 1$ до 50000$.", "bad");
    return;
  }

  user.balance += amount;
  user.debt += amount;
  addHistory(user, amount, "Деньги в долг");
  writeBank(data);
  event.currentTarget.reset();
  renderAccount(user, user.history || []);
  setStatus(statusLine, "Долг выдан.", "ok");
});

document.querySelector("#bank-repay").addEventListener("click", () => {
  const data = readBank();
  const user = data.users[currentUser];

  if (!user) {
    setStatus(statusLine, "Сначала войди в банк.", "bad");
    return;
  }

  const payment = Math.min(user.balance, user.debt);
  if (payment <= 0) {
    setStatus(statusLine, "Погашать нечего.", "bad");
    return;
  }

  user.balance -= payment;
  user.debt -= payment;
  addHistory(user, -payment, "Погашение долга");
  writeBank(data);
  renderAccount(user, user.history || []);
  setStatus(statusLine, "Долг погашен.", "ok");
});

document.querySelector("#bank-copy").addEventListener("click", async () => {
  if (!currentAccount) {
    return;
  }
  await navigator.clipboard.writeText(currentAccount.account);
  setStatus(statusLine, "Номер счёта скопирован.", "ok");
});

document.querySelector("#bank-refresh").addEventListener("click", refresh);

document.querySelector("#bank-logout").addEventListener("click", () => {
  sessionStorage.removeItem(sessionKey);
  currentUser = "";
  currentAccount = null;
  appPanel.classList.add("bank-hidden");
  authPanel.classList.remove("bank-hidden");
  setStatus(statusLine, "");
});

readBank();
if (currentUser) {
  refresh();
}
