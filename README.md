# SplitChat

Turn a messy WhatsApp group chat into a clean trip summary and a settle-up plan.

Upload your group chat export, review the expenses an open model finds, and see
who owes whom with the fewest transfers. Nothing is stored.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in your OpenAI-compatible provider details
npm run dev
```

Open http://localhost:3000.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm test` — run the unit tests

## License

MIT