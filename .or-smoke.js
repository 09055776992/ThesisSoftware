// Temp helper: verify a free OpenRouter model emits a proper tool call.
const https = require('https');

const API_KEY = process.argv[2];
const models = process.argv.slice(3);

if (!API_KEY || models.length === 0) {
  console.error('Usage: node .or-smoke.js <api-key> <model> [model...]');
  process.exit(1);
}

const body = (model) => JSON.stringify({
  model,
  max_tokens: 200,
  tools: [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file from disk',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Relative file path' } },
          required: ['path'],
        },
      },
    },
  ],
  tool_choice: 'auto',
  messages: [
    { role: 'user', content: 'Read the file package.json. Use your tool.' },
  ],
});

const call = (model) => new Promise((resolve) => {
  const payload = body(model);
  const req = https.request(
    {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'HTTP-Referer': 'https://localhost',
        'X-Title': 'Sixth smoke test',
      },
    },
    (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }
  );
  req.on('error', (e) => resolve({ status: 0, data: e.message }));
  req.write(payload);
  req.end();
});

(async () => {
  for (const model of models) {
    const { status, data } = await call(model);
    let verdict = 'FAIL';
    let detail = '';

    try {
      const json = JSON.parse(data);
      if (status !== 200) {
        detail = `HTTP ${status}: ${json.error ? json.error.message : data.slice(0, 200)}`;
      } else {
        const msg = json.choices && json.choices[0] && json.choices[0].message;
        const calls = (msg && msg.tool_calls) || [];
        if (calls.length > 0) {
          verdict = 'TOOL CALL OK';
          detail = `${calls[0].function.name}(${calls[0].function.arguments})`;
        } else {
          detail = `prose only: ${JSON.stringify((msg && msg.content || '').slice(0, 120))}`;
        }
      }
    } catch (e) {
      detail = data.slice(0, 200);
    }

    console.log(`${verdict}  ${model}`);
    console.log(`    ${detail}`);
  }
})();
