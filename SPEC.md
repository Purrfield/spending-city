# Spending City — Spec (v0.1)

## What it is
Turn your monthly bills into a 3D city you can walk through. Upload bill screenshots, and Spending City builds a little city — each building is a spending category, and the taller the building, the more you spent.

## First task for the Devin Bot
Build the Spending City MVP scaffold. Stack: React + Vite + Three.js. Create a 3D city that renders from a hardcoded sample November ledger in src/data/sampleLedger.ts — Food 850, Subscriptions 540, Shopping 410, Transport 320, Entertainment 180 (CNY). Each category is one building (a box), height proportional to its spend, tallest = highest spend. Color-code each category: Food orange, Subscriptions purple, Shopping green, Transport blue, Entertainment red. Add OrbitControls so I can drag to rotate and scroll to zoom. Add a legend overlay showing category, color, and amount.

## Acceptance criteria
- npm install && npm run dev starts with zero errors
- Opening localhost shows the city with 5 buildings
- Building heights match the sample amounts (Food tallest)
- Orbit controls work
- No console errors
- Open a PR with the code and a README explaining how to run it

## Verification gate (before merging)
1. npm run dev starts clean, zero errors
2. Visual check: 5 buildings, heights in the right order
3. Orbit controls actually work
4. I read the PR diff myself — if it's stubs, placeholders, or fake Three.js calls, it doesn't merge
5. Zero console errors
6. If any of those fail, the PR gets sent back

## Tech stack
- Frontend: React + Vite, Three.js
- Backend: Node.js
- Database: Postgres
- OCR: cloud vision API
- Deployment: Vercel (frontend), Railway (backend), Neon (Postgres)

## Privacy
Receipt images are deleted the moment OCR pulls the text out. Only merchant, amount, date, category are stored. Everything over HTTPS, database encrypted at rest. The 3D city renders in the browser from your own monthly totals.
