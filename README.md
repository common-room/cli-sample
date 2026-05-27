# `cr-agent`

[![license: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

An LLM agent that drives the [Common Room CLI](https://www.npmjs.com/package/@commonroomio/cli)
(`cr`) to produce meeting briefs and prospecting shortlists. Built on the
[Vercel AI SDK](https://sdk.vercel.ai) — works with Claude or GPT.

## Install

Requires Node ≥ 22.18

```bash
npm install
npm install -g @commonroomio/cli   # so `cr` is on $PATH
npm run compile
cr auth login                       # opens browser, one-time
```

## Run

```bash
# With Claude (claude-opus-4-7):
ANTHROPIC_API_KEY=... npm start -- call-prep "Acme; attendees: alice@acme.com"

# With GPT (gpt-5):
OPENAI_API_KEY=... npm start -- prospect "Series A SaaS in NYC, 5 VP-level contacts"
```

After `npm run compile`, you can also run the build directly:
`node dist/index.js call-prep "<request>"`.

Tool calls stream to stderr; the final brief is printed to stdout.

## Environment

- Set `ANTHROPIC_API_KEY` to run on Claude Opus, or `OPENAI_API_KEY` to
  run on GPT-5.
- To change models, edit the two model ids in `src/index.ts`.

## License

[Apache-2.0](./LICENSE).
