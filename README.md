# Spending City

Turn your monthly bills into a 3D city you can walk through.

Upload your bill screenshots, and Spending City builds a little city — each building is a spending category, and the taller the building, the more you spent. Food is the restaurant district, transport is the roads, subscriptions are the apartment blocks. Walk through your month and actually SEE where your money went.

## Why

Spreadsheets are boring, nobody opens them twice. A city you can explore is something you'd check every month.

## How it works

1. Upload bill screenshots (WeChat Pay, Alipay)
2. OCR reads them, an LLM pulls merchant, amount, date
3. Rules + LLM map each transaction to a category
4. Monthly totals feed the 3D city — building height = spend per category
5. Low-confidence receipts go to a review queue instead of landing in the wrong bucket

## Privacy

Receipt images are deleted the moment OCR pulls the text out. Only merchant, amount, date, category are stored. Everything over HTTPS, database encrypted at rest. The 3D city renders in the browser from your own monthly totals.

## Tech stack

- Frontend: React + Vite, Three.js for the 3D city
- Backend: Node.js
- Database: Postgres
- OCR: cloud vision API
- Deployment: Vercel (frontend), Railway (backend), Neon (Postgres)

## Status

Built in public with Devin Bots. MVP in progress.
