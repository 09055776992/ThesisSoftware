// Temp helper: list OpenRouter models that are free AND support tool calling.
const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('.or-models.json', 'utf8'));
const models = raw.data || [];

const isFree = (m) => {
  const p = m.pricing || {};
  const vals = [p.prompt, p.completion, p.request, p.image, p.web_search].filter((v) => v !== undefined);
  return vals.every((v) => Number(v) === 0);
};

const hasTools = (m) => {
  const params = m.supported_parameters || [];
  return params.includes('tools');
};

const free = models.filter((m) => isFree(m) && hasTools(m));

free.sort((a, b) => (b.context_length || 0) - (a.context_length || 0));

console.log('total models: ' + models.length);
console.log('free + tools: ' + free.length);
console.log('');
for (const m of free.slice(0, 40)) {
  const ctx = Math.round((m.context_length || 0) / 1000);
  console.log(`${m.id}  |  ctx ${ctx}k`);
}
