const fs = require('fs');
const path = require('path');

const requiredEnv = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
];

const loadDotEnv = () => {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, 'utf8');
  return content.split(/\r?\n/).reduce((env, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return env;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) return env;
    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    return env;
  }, {});
};

const localEnv = loadDotEnv();
const hasEnv = (name) => Boolean(process.env[name] || localEnv[name]);
const missing = requiredEnv.filter((name) => !hasEnv(name));

console.log(
  `[Loft build env] ${requiredEnv
    .map((name) => `${name}=${hasEnv(name) ? 'present' : 'missing'}`)
    .join(' ')}`
);

if (missing.length > 0) {
  throw new Error(`Missing required Loft Vite build environment variables: ${missing.join(', ')}`);
}
