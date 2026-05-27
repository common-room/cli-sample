#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';

const exec = promisify(execFile);
const PROMPTS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../prompts'
);

const [skill, ...rest] = process.argv.slice(2).filter((a) => a !== '--');
if ((skill !== 'call-prep' && skill !== 'prospect') || rest.length === 0) {
  process.stderr.write('Usage: cr-agent <call-prep|prospect> "<request>"\n');
  process.exit(2);
}
const request = rest.join(' ');

// Provider is chosen by which API key is set. Anthropic wins if both are set.
/* eslint-disable no-process-env */
const hasAnthropic = process.env.ANTHROPIC_API_KEY != null;
const hasOpenAI = process.env.OPENAI_API_KEY != null;
/* eslint-enable no-process-env */
if (!hasAnthropic && !hasOpenAI) {
  process.stderr.write(
    'Set ANTHROPIC_API_KEY or OPENAI_API_KEY before running cr-agent.\n'
  );
  process.exit(2);
}
const useOpenAI = !hasAnthropic && hasOpenAI;

// Make sure the `cr` CLI is installed and signed in before we start the
// agent.
try {
  await exec('cr', ['auth', 'status']);
} catch {
  process.stderr.write(
    'Cannot run the `cr` CLI. Install it with `npm install -g @commonroomio/cli`,\n' +
      'then sign in with `cr auth login`, and try again.\n'
  );
  process.exit(1);
}

// The one tool we expose: spawn the `cr` CLI with whatever args the model
// picks.
const crTool = tool({
  description:
    'Run the Common Room CLI. `args` is the argv list, e.g. ' +
    '["object","list","Contact","--col","fullName","--json"]. ',
  inputSchema: z.object({ args: z.array(z.string()) }),
  execute: async ({ args }) => {
    const { stdout, stderr } = await exec('cr', args, {
      maxBuffer: 256 * 1024,
    });
    const out = stdout.length > 0 ? stdout : '(no output)';
    return stderr.length > 0 ? `${out}\n[stderr]\n${stderr}` : out;
  },
});

// Load the skill playbook. The model discovers the CLI surface by running
// `cr agent-context` through the tool when it needs it, rather than us
// pinning that JSON into the system prompt on every step.
const promptFile = skill === 'prospect' ? 'prospecting.md' : 'call-prep.md';
const system = readFileSync(resolve(PROMPTS_DIR, promptFile), 'utf8');

const result = await generateText({
  model: useOpenAI ? openai('gpt-5') : anthropic('claude-opus-4-7'),
  system,
  prompt: request,
  tools: {
    cr: crTool,
    web_search: useOpenAI
      ? openai.tools.webSearchPreview({})
      : anthropic.tools.webSearch_20250305({ maxUses: 5 }),
  },
  stopWhen: stepCountIs(20),
  onStepFinish: (step) => {
    for (const tc of step.toolCalls) {
      process.stderr.write(`[${tc.toolName}] ${JSON.stringify(tc.input)}\n`);
    }
  },
});

process.stdout.write(`${result.text}\n`);
