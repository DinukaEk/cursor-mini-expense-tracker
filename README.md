# Mini Expense Tracker

A small expense tracker that runs entirely in the browser. It uses HTML, CSS, and vanilla JavaScript. There is no build step, framework, server, or database.

## Run it

Open `index.html` in a browser. Double-click the file, or use File → Open.

The page works offline. Transactions are stored in `localStorage` under the key `mini-expense-tracker.transactions`. The light or dark theme is stored under `mini-expense-tracker.theme`. Both stay on this device and in this browser. Clearing site data, or using a private window, removes them.

## What you can do

- Add an income or expense with a description, amount, category, and date.
- See total income, total expenses, and the current balance.
- Review every transaction, and filter the list to income or expenses.
- Delete a transaction. The first click asks you to confirm.
- See a CSS bar chart of how much each category contributes.
- Get validation messages when a field is missing or invalid, and an empty state before the first transaction.
- Switch between light and dark themes. The choice is remembered the next time you open the page. Dark is the default.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `style.css` | Light and dark layout, cards, and the bar chart |
| `script.js` | Form, totals, list, and storage |
| `README.md` | How to use the app |

## Change the currency

Amounts display in US dollars. To use another currency, change `CURRENCY` near the top of `script.js` to an ISO code such as `"EUR"` or `"LKR"`.

## Notes for beginners

- Amounts are rounded to cents before they are saved, so totals do not drift.
- Dates are read as calendar dates (`YYYY-MM-DD`), not as UTC timestamps, so the displayed day matches the day you picked.
- The script checks saved data when the page loads and skips any record that is incomplete.
- IDs are generated without `crypto.randomUUID()`, which some browsers hide on pages opened as local files.
