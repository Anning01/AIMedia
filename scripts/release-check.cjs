"use strict";
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const { spawnSync } = require("child_process");
const yaml = require("js-yaml");
const pkg = require("../package.json");
const workflow = yaml.load(
  fs.readFileSync(
    path.join(__dirname, "../.github/workflows/desktop.yml"),
    "utf8",
  ),
);
assert.equal(pkg.build.publish.provider, "github");
assert.equal(pkg.build.publish.owner, "Anning01");
assert.equal(pkg.build.publish.repo, "AIMedia");
assert.equal(pkg.build.win.forceCodeSigning, true);
assert.equal(pkg.build.mac.sign, "./build/mac-sign.cjs");
assert.equal(pkg.build.mac.notarize, false);
assert.equal(workflow.on.push.branches, undefined);
assert.equal(workflow.on.pull_request, undefined);
assert(Object.hasOwn(workflow.on, "workflow_dispatch"));
assert(workflow.on.push.tags.includes("v*"));
assert.equal(workflow.jobs.release.permissions.contents, "write");
assert(workflow.jobs.release.needs.includes("windows"));
assert(workflow.jobs.release.needs.includes("signing"));
assert(workflow.jobs.release.if.includes("always()"));
assert(workflow.jobs.release.if.includes("needs.mac.result == 'success'"));
assert(workflow.jobs.release.if.includes("github.ref == 'refs/tags/v1.0.0'"));
assert(workflow.jobs.release.if.includes("needs.windows.result == 'skipped'"));
assert(workflow.jobs.signing.steps[0].run.includes('"$GITHUB_REF" != refs/tags/v1.0.0'));
const windowsBuild = workflow.jobs.windows.steps.find(
  (step) => step.name === "Build signed Windows x64 installer",
);
assert(windowsBuild.env.WIN_CSC_LINK.includes("secrets.WIN_CSC_LINK"));
assert(
  windowsBuild.env.WIN_CSC_KEY_PASSWORD.includes(
    "secrets.WIN_CSC_KEY_PASSWORD",
  ),
);
const fixture = path.join(
  __dirname,
  `../secret-scan-fixture-${process.pid}.txt`,
);
const dummy = "qk_" + "A".repeat(64);
try {
  fs.writeFileSync(fixture, "API_KEY=" + dummy, { flag: "wx" });
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "check-secrets.cjs")],
    { encoding: "utf8" },
  );
  assert.equal(
    result.status,
    1,
    "secret scanner must block credential-like text",
  );
  assert((result.stdout + result.stderr).includes(path.basename(fixture)));
  assert(
    !(result.stdout + result.stderr).includes(dummy),
    "scanner never prints the matching value",
  );
} finally {
  fs.rmSync(fixture, { force: true });
}
const releaseFixture = fs.mkdtempSync(path.join(require("os").tmpdir(), "aimedia-release-"));
try {
  const input = path.join(releaseFixture, "artifacts");
  for (const arch of ["arm64", "x64"]) {
    const directory = path.join(input, `mac-${arch}`);
    fs.mkdirSync(directory, { recursive: true });
    const files = ["dmg", "zip"].map((ext) => {
      const name = `AIMedia-${pkg.version}-mac-${arch}.${ext}`;
      const data = Buffer.from(name);
      fs.writeFileSync(path.join(directory, name), data);
      return { url: name, size: data.length, sha512: require("crypto").createHash("sha512").update(data).digest("base64") };
    });
    fs.writeFileSync(path.join(directory, "latest-mac.yml"), yaml.dump({ version: pkg.version, files }));
  }
  const { prepareRelease } = require("./prepare-release.cjs");
  const output = path.join(releaseFixture, "output");
  prepareRelease(input, output);
  const info = yaml.load(fs.readFileSync(path.join(output, "latest-mac.yml"), "utf8"));
  assert.equal(info.files.length, 4);
  assert.equal(fs.readFileSync(path.join(output, "SHA256SUMS.txt"), "utf8").trim().split("\n").length, 5);
  fs.appendFileSync(path.join(input, "mac-arm64", `AIMedia-${pkg.version}-mac-arm64.dmg`), "corrupt");
  assert.throws(() => prepareRelease(input, path.join(releaseFixture, "invalid")), /Invalid checksum/);
} finally {
  fs.rmSync(releaseFixture, { recursive: true, force: true });
}
console.log(
  "PASS: release workflow, signed Windows guard, Mac signing hook, and secret scan rejection/redaction.",
);
