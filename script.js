// Mini Expense Tracker
// Open index.html in a browser. Transactions are saved in localStorage.

const STORAGE_KEY = "mini-expense-tracker.transactions";
const THEME_KEY = "mini-expense-tracker.theme";

// Change this to another ISO currency code, such as "EUR" or "LKR".
const CURRENCY = "USD";

const CATEGORIES = {
  income: ["Salary", "Freelance", "Investments", "Gifts", "Other"],
  expense: ["Food", "Transport", "Housing", "Bills", "Shopping", "Health", "Entertainment", "Other"]
};

const BAR_COLORS = ["#8b5cf6", "#c084fc", "#f0abfc", "#fb7185", "#34d399", "#67e8f9", "#fbbf24", "#a78bfa"];

const MAX_AMOUNT = 9999999.99;
const MIN_YEAR = 2000;

let transactions = [];
let activeFilter = "all";
let pendingDeleteId = null;
let statusTimer = null;
let droppedSavedRows = false;

const form = document.querySelector("#transaction-form");
const descriptionInput = document.querySelector("#description");
const amountInput = document.querySelector("#amount");
const categorySelect = document.querySelector("#category");
const dateInput = document.querySelector("#date");
const formErrors = document.querySelector("#form-errors");
const status = document.querySelector("#status");
const totalIncome = document.querySelector("#total-income");
const totalExpenses = document.querySelector("#total-expenses");
const balance = document.querySelector("#balance");
const balanceCard = document.querySelector("#balance-card");
const balanceNote = document.querySelector("#balance-note");
const breakdown = document.querySelector("#breakdown");
const transactionList = document.querySelector("#transaction-list");
const transactionCount = document.querySelector("#transaction-count");
const themeToggle = document.querySelector("#theme-toggle");

applyTheme(savedTheme());
document.addEventListener("DOMContentLoaded", init);

function init() {
  const today = todayISO();
  const maxYear = new Date().getFullYear() + 1;
  dateInput.min = `${MIN_YEAR}-01-01`;
  dateInput.max = `${maxYear}-12-31`;
  dateInput.value = today;

  transactions = loadTransactions();
  if (droppedSavedRows) {
    setStatus("Some saved transactions were skipped because they were incomplete.");
    saveTransactions();
  }
  fillCategories(selectedType());
  applyTheme(savedTheme());
  render();

  themeToggle.addEventListener("click", onThemeToggle);
  form.addEventListener("submit", onSubmit);
  form.addEventListener("change", onFormChange);
  form.addEventListener("input", clearErrors);
  transactionList.addEventListener("click", onListClick);
  document.querySelector(".filters").addEventListener("click", onFilterClick);
}

function savedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  const light = next === "light";
  document.documentElement.dataset.theme = next;
  themeToggle.setAttribute("aria-pressed", light ? "true" : "false");
  themeToggle.textContent = light ? "Dark theme" : "Light theme";
  themeToggle.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
}

function onThemeToggle() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    setStatus("Could not save the theme. Browser storage may be blocked.");
  }
}

function selectedType() {
  const checked = form.querySelector('input[name="type"]:checked');
  return checked ? checked.value : "expense";
}

function fillCategories(type) {
  const previous = categorySelect.value;
  categorySelect.replaceChildren();

  CATEGORIES[type].forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.append(option);
  });

  if (CATEGORIES[type].includes(previous)) {
    categorySelect.value = previous;
  }
}

function onFormChange(event) {
  if (event.target.name === "type") {
    fillCategories(selectedType());
  }
}

function onSubmit(event) {
  event.preventDefault();
  const result = readForm();

  if (result.errors.length > 0) {
    showErrors(result.errors);
    return;
  }

  transactions.push(result.transaction);
  pendingDeleteId = null;
  saveTransactions();
  form.reset();
  dateInput.value = todayISO();
  document.querySelector("#type-expense").checked = true;
  fillCategories("expense");
  clearErrors();
  render();
  setStatus(`${result.transaction.type === "income" ? "Income" : "Expense"} added.`);
  descriptionInput.focus();
}

function readForm() {
  const type = selectedType();
  const description = descriptionInput.value.trim();
  const category = categorySelect.value;
  const date = dateInput.value;
  const amount = roundMoney(amountInput.value);
  const errors = [];

  if (type !== "income" && type !== "expense") {
    errors.push("Choose income or expense.");
  }

  if (description.length < 2) {
    errors.push("Enter a description of at least 2 characters.");
  } else if (description.length > 60) {
    errors.push("Keep the description to 60 characters or fewer.");
  }

  if (amountInput.value.trim() === "" || !Number.isFinite(amount)) {
    errors.push("Enter an amount.");
  } else if (amount < 0.01) {
    errors.push("Enter an amount of at least 0.01.");
  } else if (amount > MAX_AMOUNT) {
    errors.push("Enter an amount of 9,999,999.99 or less.");
  }

  if (!CATEGORIES[type] || !CATEGORIES[type].includes(category)) {
    errors.push("Choose a category for this transaction type.");
  }

  if (!isRealDate(date)) {
    errors.push("Choose a valid date.");
  } else if (!isDateInRange(date)) {
    const maxYear = new Date().getFullYear() + 1;
    errors.push(`Choose a date between ${MIN_YEAR} and ${maxYear}.`);
  }

  return {
    errors,
    transaction: {
      id: createId(),
      type,
      description,
      amount,
      category,
      date,
      createdAt: Date.now()
    }
  };
}

function showErrors(errors) {
  const list = document.createElement("ul");
  errors.forEach((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    list.append(item);
  });
  formErrors.replaceChildren(list);
  formErrors.hidden = false;
  status.textContent = "";
}

function clearErrors() {
  formErrors.replaceChildren();
  formErrors.hidden = true;
}

function setStatus(message) {
  status.textContent = message;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    status.textContent = "";
  }, 2800);
}

function onFilterClick(event) {
  const button = event.target.closest("[data-filter]");
  if (!button) return;

  activeFilter = button.dataset.filter;
  pendingDeleteId = null;
  document.querySelectorAll("[data-filter]").forEach((chip) => {
    const selected = chip === button;
    chip.classList.toggle("is-active", selected);
    chip.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  render();
}

function onListClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.action === "cancel-delete") {
    pendingDeleteId = null;
    render();
    return;
  }

  if (button.dataset.action !== "delete") return;

  const id = button.dataset.id;
  if (pendingDeleteId !== id) {
    pendingDeleteId = id;
    render();
    return;
  }

  const removed = transactions.find((item) => item.id === id);
  transactions = transactions.filter((item) => item.id !== id);
  pendingDeleteId = null;
  saveTransactions();
  render();
  setStatus(removed ? `Deleted “${removed.description}”.` : "Transaction deleted.");
}

function render() {
  const income = sumByType("income");
  const expenses = sumByType("expense");
  const currentBalance = (toCents(income) - toCents(expenses)) / 100;

  totalIncome.textContent = formatMoney(income);
  totalExpenses.textContent = formatMoney(expenses);
  balance.textContent = formatMoney(currentBalance);
  balanceCard.classList.toggle("is-negative", currentBalance < 0);
  balanceCard.classList.toggle("is-positive", currentBalance > 0);
  balanceNote.textContent = balanceMessage(currentBalance);

  renderBreakdown();
  renderTransactions();
}

function balanceMessage(currentBalance) {
  if (transactions.length === 0) return "Add a transaction to get started.";
  if (currentBalance > 0) return "Income is ahead of expenses.";
  if (currentBalance < 0) return "Expenses are higher than income.";
  return "Income and expenses are equal.";
}

function renderBreakdown() {
  breakdown.replaceChildren();
  const incomeRows = totalsByCategory("income");
  const expenseRows = totalsByCategory("expense");

  if (incomeRows.length === 0 && expenseRows.length === 0) {
    breakdown.append(emptyState(
      "No categories yet",
      "Add income or an expense and the bars will show each category’s share."
    ));
    return;
  }

  breakdown.append(breakdownBlock("Expenses", expenseRows, "No expenses yet."));
  breakdown.append(breakdownBlock("Income", incomeRows, "No income yet."));
}

function breakdownBlock(title, rows, emptyCopy) {
  const section = document.createElement("section");
  section.className = "breakdown-block";

  const heading = document.createElement("h3");
  heading.className = "breakdown-title";
  const label = document.createElement("strong");
  label.textContent = title;
  const total = document.createElement("span");
  const cents = rows.reduce((sum, row) => sum + toCents(row.amount), 0);
  total.textContent = formatMoney(cents / 100);
  heading.append(label, total);
  section.append(heading);

  if (rows.length === 0) {
    const note = document.createElement("p");
    note.className = "summary-note";
    note.textContent = emptyCopy;
    section.append(note);
    return section;
  }

  rows.forEach((row, index) => {
    const percent = (row.amount / (cents / 100)) * 100;
    section.append(barRow(row, percent, BAR_COLORS[index % BAR_COLORS.length]));
  });

  return section;
}

function barRow(row, percent, color) {
  const wrapper = document.createElement("div");
  wrapper.className = "bar-row";

  const name = document.createElement("span");
  name.className = "bar-label";
  name.textContent = row.category;

  const track = document.createElement("div");
  track.className = "bar-track";
  track.setAttribute("role", "meter");
  track.setAttribute("aria-label", `${row.category} ${Math.round(percent)} percent`);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(Math.round(percent)));

  const fill = document.createElement("div");
  fill.className = "bar-fill";
  fill.style.setProperty("--bar-color", color);
  track.append(fill);

  const meta = document.createElement("span");
  meta.className = "bar-meta";
  meta.textContent = `${formatMoney(row.amount)} · ${Math.round(percent)}%`;

  wrapper.append(name, track, meta);

  // Set the width after the element is in the document so the CSS transition can run.
  window.requestAnimationFrame(() => {
    fill.style.width = `${percent}%`;
  });

  return wrapper;
}

function renderTransactions() {
  const visible = sortedTransactions().filter((item) => {
    return activeFilter === "all" || item.type === activeFilter;
  });

  const noun = visible.length === 1 ? "transaction" : "transactions";
  transactionCount.textContent = `${visible.length} ${noun} shown`;
  transactionList.replaceChildren();

  if (visible.length === 0) {
    const message = transactions.length === 0
      ? ["Nothing here yet", "Add income or an expense and it will show up in this list."]
      : ["No matches", `There are no ${activeFilter} transactions to show.`];
    const item = document.createElement("li");
    item.append(emptyState(message[0], message[1]));
    transactionList.append(item);
    return;
  }

  visible.forEach((item) => transactionList.append(transactionRow(item)));
}

function transactionRow(item) {
  const row = document.createElement("li");
  row.className = `tx ${item.type}`;

  const mark = document.createElement("span");
  mark.className = "tx-mark";
  mark.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  const title = document.createElement("p");
  title.className = "tx-title";
  title.textContent = item.description;
  const meta = document.createElement("p");
  meta.className = "tx-meta";
  const typeLabel = item.type === "income" ? "Income" : "Expense";
  meta.textContent = `${typeLabel} · ${item.category} · ${formatDate(item.date)}`;
  copy.append(title, meta);

  const side = document.createElement("div");
  side.className = "tx-side";
  const amount = document.createElement("p");
  amount.className = `amount ${item.type}`;
  const sign = item.type === "income" ? "+" : "−";
  amount.textContent = `${sign}${formatMoney(item.amount)}`;

  const actions = document.createElement("div");
  actions.className = "tx-actions";
  const armed = pendingDeleteId === item.id;

  if (armed) {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn-ghost";
    cancel.dataset.action = "cancel-delete";
    cancel.textContent = "Cancel";
    actions.append(cancel);
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = armed ? "btn-danger is-armed" : "btn-danger";
  remove.dataset.action = "delete";
  remove.dataset.id = item.id;
  remove.textContent = armed ? "Confirm" : "Delete";
  remove.setAttribute("aria-label", `${armed ? "Confirm delete" : "Delete"} ${item.description}`);
  actions.append(remove);

  side.append(amount, actions);
  row.append(mark, copy, side);
  return row;
}

function emptyState(title, copy) {
  const box = document.createElement("div");
  box.className = "empty-state";
  const heading = document.createElement("strong");
  heading.textContent = title;
  box.append(heading, document.createTextNode(copy));
  return box;
}

function totalsByCategory(type) {
  const totals = new Map();

  transactions.forEach((item) => {
    if (item.type !== type) return;
    totals.set(item.category, (totals.get(item.category) || 0) + toCents(item.amount));
  });

  return [...totals.entries()]
    .map(([category, cents]) => ({ category, amount: cents / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

function sumByType(type) {
  const cents = transactions.reduce((total, item) => {
    return item.type === type ? total + toCents(item.amount) : total;
  }, 0);
  return cents / 100;
}

function sortedTransactions() {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      droppedSavedRows = true;
      return [];
    }

    const cleaned = [];
    const seen = new Set();
    parsed.forEach((item) => {
      const transaction = normalizeTransaction(item);
      if (!transaction || seen.has(transaction.id)) return;
      seen.add(transaction.id);
      cleaned.push(transaction);
    });

    droppedSavedRows = cleaned.length !== parsed.length;
    return cleaned;
  } catch {
    setStatus("Saved transactions could not be read. Starting with an empty list.");
    return [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch {
    setStatus("Could not save. Browser storage may be full or blocked.");
  }
}

function normalizeTransaction(value) {
  if (!value || typeof value !== "object") return null;

  const type = value.type === "income" || value.type === "expense" ? value.type : null;
  if (!type || typeof value.description !== "string") return null;

  const description = value.description.trim();
  const amount = roundMoney(value.amount);
  const date = typeof value.date === "string" ? value.date : "";

  if (description.length < 2 || description.length > 60) return null;
  if (!Number.isFinite(amount) || amount < 0.01 || amount > MAX_AMOUNT) return null;
  if (!CATEGORIES[type].includes(value.category)) return null;
  if (!isRealDate(date)) return null;

  return {
    id: typeof value.id === "string" && value.id ? value.id : createId(),
    type,
    description,
    amount,
    category: value.category,
    date,
    createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Date.now()
  };
}

function roundMoney(value) {
  const number = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(number)) return Number.NaN;
  return Math.round(number * 100) / 100;
}

function toCents(amount) {
  return Math.round(amount * 100);
}

function isRealDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isDateInRange(iso) {
  const year = Number(iso.slice(0, 4));
  const maxYear = new Date().getFullYear() + 1;
  return year >= MIN_YEAR && year <= maxYear;
}

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatMoney(amount) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: CURRENCY
  }).format(amount);
}

function createId() {
  return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
