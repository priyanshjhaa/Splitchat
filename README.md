# SplitChat 🧾

**Turn a messy WhatsApp trip chat into "Rahul pays Priya ₹850".**

Every trip ends with 200 messages like *"bhai maine petrol ka 2k diya"* and *"wait, the cab was 650, not 600"*, and nobody knows who owes whom. SplitChat reads the chat export, finds every expense with an open-source LLM, lets you fix anything it got wrong, and works out the fewest payments to settle up.

Built solo for the **#OpenFire hackathon** with [Alan AI](https://x.com/tryAlanAI) and open models only.

- **Live:** _add your Vercel link_
- **Demo:** _add your X post link_

## Features

- **Upload a WhatsApp export:** `.txt` (Android) or `.zip` (iOS), or tap **Try sample chat**
- **Edit people:** rename, merge duplicates (e.g. a phone number into "Rahul"), add people who never texted
- **AI expense extraction:** handles English, Hindi and Hinglish, corrections ("it was 650 not 600"), splits among only some people, and paying for one person. It ignores numbers that aren't money ("reach by 7", "room 204")
- **Review and edit:** every row is editable, low-confidence rows are highlighted, and you can see the source message for each one
- **Settle up:** per-person balances, the fewest possible transfers, and **Copy for WhatsApp**
- **Private:** no database, no accounts, no chat content logged

## How it works

AI is used for exactly one step. Everything involving money is plain code, so the numbers are always right.

```
WhatsApp export
  → parse (regex, in the browser)
  → prefilter: keep only messages that might be about money
  → chunk (~50 messages)
  → /api/extract: open LLM returns expense JSON (Zod-validated)
  → merge + de-duplicate, rupees → integer paise
  → you review and edit
  → settle: balances + greedy minimal transfers (TypeScript, unit-tested)
  → settle-up text from a template (never written by the LLM)
```

## Models

Runs on [Groq](https://console.groq.com/docs/models)'s free tier, with automatic fallback when a model is rate-limited or fails:

| Order | Model | Why |
|---|---|---|
| 1 | `qwen/qwen3.8-27b` | Strong with Hinglish and JSON |
| 2 | `openai/gpt-oss-120b` | Stable production model, good structured output |
| 3 | `openai/gpt-oss-20b` | Fastest, last resort |

Each model has its own rate limit, so falling back also adds capacity. **Try sample chat** loads a precomputed result and makes no API calls, so the demo always works.

## Local setup

```bash
npm install
cp .env.example .env.local   # add your Groq API key
npm run dev
```

Open http://localhost:3000.

## Scripts

- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm test`: unit tests (parser, settlement, merging, people editing)
- `npm run regen-sample`: regenerate `public/sample-result.json` from the sample chat
- `npm run compare-models`: run the sample chat through each model and score accuracy

## License

MIT
