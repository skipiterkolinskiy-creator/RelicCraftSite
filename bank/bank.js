const els = {
  loginForm: document.querySelector("#loginForm"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  statuses: document.querySelectorAll(".status"),
  panel: document.querySelector("#bankPanel"),
  loginBox: document.querySelector("#loginBox"),
  playerName: document.querySelector("#playerName"),
  accountNumber: document.querySelector("#accountNumber"),
  balance: document.querySelector("#balance"),
  debt: document.querySelector("#debt"),
  to: document.querySelector("#to"),
  amount: document.querySelector("#amount"),
  comment: document.querySelector("#comment"),
  transferBtn: document.querySelector("#transferBtn"),
  loanAmount: document.querySelector("#loanAmount"),
  loanBtn: document.querySelector("#loanBtn"),
  repayBtn: document.querySelector("#repayBtn"),
  copyBtn: document.querySelector("#copyBtn"),
  refreshBtn: document.querySelector("#refreshBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  history: document.querySelector("#history"),
};

let current = null;

function money(value) {
  return `${Number(value || 0).toLocaleString("ru-RU")}$`;
}

function setStatus(text, bad = false) {
  els.statuses.forEach((status) => {
    status.textContent = text || "";
    status.classList.toggle("bad", bad);
  });
}

async function api(action, payload = {}) {
  const res = await fetch("api.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "Сервер вернул не JSON." }));
  if (!data.ok) throw new Error(data.error || "Ошибка банка.");
  return data;
}

function render(data) {
  current = data.account;
  els.loginBox.hidden = true;
  els.panel.hidden = false;
  els.playerName.textContent = current.username;
  els.accountNumber.textContent = current.accountNumber;
  els.balance.textContent = money(current.balance);
  els.debt.textContent = money(current.debt);

  const rows = data.history || [];
  els.history.innerHTML = rows.length
    ? rows.map((row) => {
        const incoming = row.to_account === current.accountNumber;
        const title = incoming ? `Получено от ${row.from_account || "Банк"}` : `Отправлено на ${row.to_account || "Банк"}`;
        const sign = incoming ? "+" : "-";
        return `<div class="history-row">
          <div><b>${title}</b><span>${row.comment || "Без комментария"} · ${row.created_at}</span></div>
          <strong class="${incoming ? "plus" : "minus"}">${sign}${money(row.amount)}</strong>
        </div>`;
      }).join("")
    : `<p class="muted">Операций пока нет.</p>`;
}

async function refresh(silent = false) {
  try {
    const data = await api("me");
    render(data);
    if (!silent) setStatus("Обновлено.");
  } catch (err) {
    els.loginBox.hidden = false;
    els.panel.hidden = true;
    if (!silent) setStatus(err.message, true);
  }
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Входим...");
  try {
    const data = await api("login", {
      username: els.username.value,
      password: els.password.value,
    });
    render(data);
    setStatus("Готово.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.transferBtn.addEventListener("click", async () => {
  setStatus("Переводим...");
  try {
    const data = await api("transfer", {
      to: els.to.value,
      amount: els.amount.value,
      comment: els.comment.value,
    });
    els.amount.value = "";
    render(data);
    setStatus("Перевод отправлен.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.loanBtn.addEventListener("click", async () => {
  setStatus("Оформляем долг...");
  try {
    render(await api("loan", { amount: els.loanAmount.value }));
    els.loanAmount.value = "";
    setStatus("Деньги добавлены.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.repayBtn.addEventListener("click", async () => {
  setStatus("Погашаем долг...");
  try {
    render(await api("repay", { amount: els.loanAmount.value || current?.debt || 0 }));
    els.loanAmount.value = "";
    setStatus("Долг обновлён.");
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.copyBtn.addEventListener("click", async () => {
  if (!current) return;
  await navigator.clipboard.writeText(current.accountNumber);
  setStatus("Номер счёта скопирован.");
});

els.refreshBtn.addEventListener("click", () => refresh());

els.logoutBtn.addEventListener("click", async () => {
  await api("logout").catch(() => null);
  current = null;
  els.loginBox.hidden = false;
  els.panel.hidden = true;
  setStatus("Вышли из банка.");
});

refresh(true);
