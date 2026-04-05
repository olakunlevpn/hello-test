const fs = require("fs");
const path = require("path");

function loadEnv() {
  const vars = {};
  const cwd = __dirname;
  for (const f of [".env", ".env.local"]) {
    const fp = path.join(cwd, f);
    if (fs.existsSync(fp)) {
      for (const line of fs.readFileSync(fp, "utf-8").split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) vars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
      }
    }
  }
  return vars;
}

const env = loadEnv();

module.exports = {
  apps: [
    {
      name: "forg365-web",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      env: { NODE_ENV: "production", ...env },
      autorestart: true,
      max_memory_restart: "1G",
    },
    {
      name: "forg365-token-worker",
      script: "node_modules/.bin/tsx",
      args: "src/workers/token-refresh.worker.ts",
      cwd: __dirname,
      interpreter: "none",
      env: { NODE_ENV: "production", ...env },
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "forg365-webhook-worker",
      script: "node_modules/.bin/tsx",
      args: "src/workers/webhook.worker.ts",
      cwd: __dirname,
      interpreter: "none",
      env: { NODE_ENV: "production", ...env },
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};
