const apiUrl = "api.php";
const sessionKey = "reliccraft-bank-token";

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

let token = sessionStorage.getItem(sessionKey) || "";
let currentAccount = null;

function money(value) {
  return `${Math.floor(Number(value) || 0)}$`;
}

function setStatus(target, message, mode = "") {
  target.textContent = message;
  target.className = `bank-status ${mode}`.trim();
}

async function request(action, data = {}) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token, ...data }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok === false) {
    throw new Error(payload?.error || "Банк сейчас недоступен.");
  }
  return payload;
}

function renderAccount(account, history = []) {
  currentAccount = account;
  authPanel.classList.add("bank-hidden");
  appPanel.classList.remove("bank-hidden");
  playerLabel.textContent = account.name;
  accountLabel.textContent = account.number;
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
    title.textContent = item.text;
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

async function refresh() {
  if (!token) {
    return;
  }
  try {
    const payload = await request("me");
    renderAccount(payload.account, payload.history);
    setStatus(statusLine, "");
  } catch (error) {
    sessionStorage.removeItem(sessionKey);
    token = "";
    appPanel.classList.add("bank-hidden");
    authPanel.classList.remove("bank-hidden");
    setStatus(authStatus, error.message, "bad");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  setStatus(authStatus, "Проверяем...", "");

  try {
    const payload = await request("login", {
      username: String(form.get("username") || "").trim(),
      password: String(form.get("password") || ""),
    });
    token = payload.token;
    sessionStorage.setItem(sessionKey, token);
    loginForm.reset();
    setStatus(authStatus, "");
    renderAccount(payload.account, payload.history);
  } catch (error) {
    setStatus(authStatus, error.message, "bad");
  }
});

document.querySelector("#bank-transfer").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const payload = await request("transfer", {
      target: String(form.get("target") || "").trim(),
      amount: Number(form.get("amount") || 0),
      comment: String(form.get("comment") || "").trim(),
    });
    event.currentTarget.reset();
    renderAccount(payload.account, payload.history);
    setStatus(statusLine, "Перевод выполнен.", "ok");
  } catch (error) {
    setStatus(statusLine, error.message, "bad");
  }
});

document.querySelector("#bank-loan").addEventListener("submit", async (event) => {
  event.preventDefault();
  const amount = Number(new FormData(event.currentTarget).get("amount") || 0);
  try {
    const payload = await request("loan", { amount });
    event.currentTarget.reset();
    renderAccount(payload.account, payload.history);
    setStatus(statusLine, "Долг выдан.", "ok");
  } catch (error) {
    setStatus(statusLine, error.message, "bad");
  }
});

document.querySelector("#bank-repay").addEventListener("click", async () => {
  try {
    const payload = await request("repay");
    renderAccount(payload.account, payload.history);
    setStatus(statusLine, "Долг погашен.", "ok");
  } catch (error) {
    setStatus(statusLine, error.message, "bad");
  }
});

document.querySelector("#bank-copy").addEventListener("click", async () => {
  if (!currentAccount) {
    return;
  }
  await navigator.clipboard.writeText(currentAccount.number);
  setStatus(statusLine, "Номер счёта скопирован.", "ok");
});

document.querySelector("#bank-refresh").addEventListener("click", refresh);

document.querySelector("#bank-logout").addEventListener("click", () => {
  sessionStorage.removeItem(sessionKey);
  token = "";
  currentAccount = null;
  appPanel.classList.add("bank-hidden");
  authPanel.classList.remove("bank-hidden");
  setStatus(statusLine, "");
});

if (token) {
  refresh();
}
