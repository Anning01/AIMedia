"use strict";
const assert = require("assert/strict");
const path = require("path");
const { listPackage, extractFile } = require("@electron/asar");
const archive = process.argv[2];
if (!archive) throw Error("Usage: node scripts/verify-package.cjs <app.asar>");
const files = listPackage(archive).map((name) => name.replace(/\\/g, "/").replace(/^\//, ""));
const forbidden = files.filter(
  (name) =>
    !name.startsWith("node_modules/") &&
    /(?:^|\/)(?:config|logs|\.git|\.claude|src|scripts|docs)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|ai-config\.json|qiling-model-requests\.json|qiling-remove-tasks\.json)$|\.(?:pfx|p12|pem|key|keystore)$/i.test(
      name,
    ),
);
assert.deepEqual(
  forbidden,
  [],
  "Local data, source tooling or credentials must not be packaged",
);
const appFiles = files.filter(
  (name) =>
    name === "package.json" ||
    name.startsWith("dist/") ||
    name.startsWith("electron/"),
);
for (const name of appFiles) {
  if (!/\.(?:cjs|js|json|css|html|md)$/.test(name)) continue;
  let text;
  try {
    text = extractFile(archive, path.normalize(name)).toString("utf8");
  } catch {
    continue;
  }
  assert(
    !/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{18,}|qk_[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/.test(
      text,
    ),
    `Credential-like value in ${name}`,
  );
}
assert(files.includes("electron/main.cjs"));
assert(files.includes("dist/index.html"));
console.log(
  `PASS: packaged app verified (${files.length} archive entries); no local configuration or matching API keys.`,
);
