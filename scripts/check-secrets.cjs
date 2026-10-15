"use strict";
const fs = require("fs");
const { execFileSync } = require("child_process");
const paths = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
];
const findings = [];
const patterns = [
  [
    "API Key / cloud token",
    /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{18,}|qk_[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g,
  ],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ["JWT", /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g],
  [
    "hard-coded credential",
    /(?:api[_-]?key|app[_-]?secret|access[_-]?key|secret[_-]?key|password|bearer)\s*["']?\s*[:=]\s*["']([A-Za-z0-9_./+=-]{18,})["']/gi,
  ],
];
for (const name of paths) {
  if (!fs.existsSync(name) || !fs.statSync(name).isFile()) continue;
  if (
    /(?:^|\/)(?:config|logs|userData|userdata|\.claude)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|ai-config\.json|qiling-model-requests\.json|qiling-remove-tasks\.json)$|\.(?:pfx|p12|pem|key|keystore|mobileprovision)$/i.test(
      name,
    )
  )
    findings.push(`${name}: sensitive local file`);
  const buffer = fs.readFileSync(name);
  if (buffer.includes(0)) continue;
  const text = buffer.toString("utf8");
  for (const [rule, regex] of patterns) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex))
      findings.push(
        `${name}:${text.slice(0, match.index).split("\n").length}: ${rule}`,
      );
  }
}
if (findings.length) {
  console.error(
    "Secret scan blocked (values are never printed):\n" + findings.join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    `PASS: ${paths.length} candidate files checked; no matching API keys, private keys, tokens or sensitive local config files.`,
  );
