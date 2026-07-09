const storageKey = "reliccraft-bank-static-v2";
const sessionKey = "reliccraft-bank-user-v2";

const $ = (id) => document.getElementById(id);

const ui = {
  loginBox: $("loginBox"),
  bankPanel: $("bankPanel"),
  loginForm: $("loginForm"),
  transferForm: $("transferForm"),
  loanForm: $("loanForm"),
  username: $("username"),
  password: $("password"),
  loginStatus: $("loginStatus"),
  status: $("status"),
  playerName: $("playerName"),
  accountNumber: $("accountNumber"),
  balance: $("balance"),
  debt: $("debt"),
  toAccount: $("toAccount"),
  transferAmount: $("transferAmount"),
  comment: $("comment"),
  loanAmount: $("loanAmount"),
  repayBtn: $("repayBtn"),
  copyBtn: $("copyBtn"),
  bonusBtn: $("bonusBtn"),
  logoutBtn: $("logoutBtn"),
  history: $("history"),
};

let currentKey = sessionStorage.getItem(sessionKey) || "";

function money(value) {
  return `${Math.floor(Number(value) || 0).toLocaleString("ru-RU")}$`;
}

function now() {
  return new Date().toLocaleString("ru-RU");
}

function setStatus(text, bad = false) {
  ui.status.textContent = text || "";
  ui.status.className = `bank-status ${bad ? "bad" : "ok"}`;
}

function setLoginStatus(text, bad = false) {
  ui.loginStatus.textContent = text || "";
  ui.loginStatus.className = `bank-status ${bad ? "bad" : "ok"}`;
}

async function hash(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readBank() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object") data = { users: {} };

  if (!data.users.testbank) {
    data.users.testbank = {
      username: "TESTBANK",
      account: "1488-TK",
      password: "plain:TestoviyBank19pgb83g1313",
      balance: 1000000,
      debt: 0,
      history: [{ amount: 1000000, title: "Тестовый банковский счёт", at: now() }],
    };
    writeBank(data);
  }

  return data;
}

function writeBank(data) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function accountNumber(username) {
  if (username.toUpperCase() === "TESTBANK") return "1488-TK";
  let sum = 0;
  for (let i = 0; i < username.length; i += 1) sum += username.charCodeAt(i) * (i + 31);
  const digits = 10000 + (sum % 90000);
  return `${digits}-${username[0].toUpperCase()}${username.at(-1).toUpperCase()}`;
}

function findByAccount(data, account) {
  const needle = String(account || "").trim().toLowerCase();
  return Object.values(data.users).find((user) => user.account.toLowerCase() === needle);
}

function addHistory(user, amount, title) {
  user.history = user.history || [];
  user.history.unshift({ amount, title, at: now() });
  user.history = user.history.slice(0, 40);
}

function render(user) {
  ui.loginBox.classList.add("hidden");
  ui.bankPanel.classList.remove("hidden");
  ui.playerName.textContent = user.username;
  ui.accountNumber.textContent = user.account;
  ui.balance.textContent = money(user.balance);
  ui.debt.textContent = money(user.debt);

  ui.history.innerHTML = "";
  if (!user.history?.length) {
    ui.history.innerHTML = `<p class="bank-note">Операций пока нет.</p>`;
    return;
  }

  user.history.forEach((item) => {
    const row = document.createElement("div");
    const positive = Number(item.amount) >= 0;
    row.className = "bank-row";
    row.innerHTML = `
      <div><b>${item.title}</b><span>${item.at}</span></div>
      <strong class="${positive ? "plus" : "minus"}">${positive ? "+" : ""}${money(item.amount)}</strong>
    `;
    ui.history.appendChild(row);
  });
}

function refresh() {
  const data = readBank();
  const user = data.users[currentKey];
  if (!user) {
    currentKey = "";
    sessionStorage.removeItem(sessionKey);
    ui.loginBox.classList.remove("hidden");
    ui.bankPanel.classList.add("hidden");
    return;
  }
  render(user);
}

ui.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = ui.username.value.trim();
  const password = ui.password.value;
  const key = username.toLowerCase();

  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
    setLoginStatus("Ник: 3-16 символов, буквы/цифры/_.", true);
    return;
  }

  const data = readBank();
  let user = data.users[key];

  if (!user) {
    user = {
      username,
      account: accountNumber(username),
      password: await hash(password),
      balance: 250,
      debt: 0,
      history: [],
    };
    addHistory(user, 250, "Стартовый баланс");
    data.users[key] = user;
    writeBank(data);
  } else {
    const ok = user.password.startsWith("plain:")
      ? password === user.password.slice(6)
      : user.password === await hash(password);
    if (!ok) {
      setLoginStatus("Неверный ник или пароль.", true);
      return;
    }
  }

  currentKey = key;
  sessionStorage.setItem(sessionKey, key);
  ui.loginForm.reset();
  setLoginStatus("");
  render(user);
});

ui.transferForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = readBank();
  const sender = data.users[currentKey];
  const receiver = findByAccount(data, ui.toAccount.value);
  const amount = Math.floor(Number(ui.transferAmount.value));
  const comment = ui.comment.value.trim();

  if (!receiver) return setStatus("Счёт получателя не найден.", true);
  if (sender.account === receiver.account) return setStatus("Нельзя переводить самому себе.", true);
  if (amount <= 0 || sender.balance < amount) return setStatus("Недостаточно денег.", true);

  sender.balance -= amount;
  receiver.balance += amount;
  addHistory(sender, -amount, `Перевод игроку ${receiver.username}${comment ? `: ${comment}` : ""}`);
  addHistory(receiver, amount, `Перевод от ${sender.username}${comment ? `: ${comment}` : ""}`);
  writeBank(data);
  ui.transferForm.reset();
  render(sender);
  setStatus("Перевод выполнен.");
});

ui.loanForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = readBank();
  const user = data.users[currentKey];
  const amount = Math.floor(Number(ui.loanAmount.value));
  if (amount <= 0 || amount > 50000) return setStatus("Можно взять от 1$ до 50000$.", true);
  user.balance += amount;
  user.debt += amount;
  addHistory(user, amount, "Деньги в долг");
  writeBank(data);
  ui.loanForm.reset();
  render(user);
  setStatus("Долг выдан.");
});

ui.repayBtn.addEventListener("click", () => {
  const data = readBank();
  const user = data.users[currentKey];
  const payment = Math.min(user.balance, user.debt);
  if (payment <= 0) return setStatus("Погашать нечего.", true);
  user.balance -= payment;
  user.debt -= payment;
  addHistory(user, -payment, "Погашение долга");
  writeBank(data);
  render(user);
  setStatus("Долг погашен.");
});

ui.copyBtn.addEventListener("click", async () => {
  const user = readBank().users[currentKey];
  await navigator.clipboard.writeText(user.account);
  setStatus("Номер счёта скопирован.");
});

ui.bonusBtn.addEventListener("click", () => {
  const data = readBank();
  const user = data.users[currentKey];
  user.balance += 500;
  addHistory(user, 500, "Тестовое пополнение");
  writeBank(data);
  render(user);
  setStatus("Добавлено 500$.");
});

ui.logoutBtn.addEventListener("click", () => {
  currentKey = "";
  sessionStorage.removeItem(sessionKey);
  ui.loginBox.classList.remove("hidden");
  ui.bankPanel.classList.add("hidden");
});

readBank();
refresh();

