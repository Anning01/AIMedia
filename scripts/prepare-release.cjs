"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const assert = require("assert/strict");
const yaml = require("js-yaml");
const { version } = require("../package.json");

function prepareRelease(input, output) {
  fs.mkdirSync(output, { recursive: true });
  const files = [];
  for (const arch of ["arm64", "x64"]) {
    const directory = path.join(input, `mac-${arch}`);
    const info = yaml.load(fs.readFileSync(path.join(directory, "latest-mac.yml"), "utf8"));
    assert.equal(info.version, version, "Mac update version must match package.json");
    for (const ext of ["dmg", "zip"]) {
      const name = `AIMedia-${version}-mac-${arch}.${ext}`;
      const entry = info.files.find((item) => item.url === name);
      assert(entry, `Missing update metadata for ${name}`);
      const content = fs.readFileSync(path.join(directory, name));
      const sha512 = crypto.createHash("sha512").update(content).digest("base64");
      assert.equal(sha512, entry.sha512, `Invalid checksum: ${name}`);
      assert.equal(content.length, entry.size, `Invalid size: ${name}`);
      fs.copyFileSync(path.join(directory, name), path.join(output, name));
      files.push(entry);
    }
  }
  const zip = files.find((file) => file.url.endsWith("-x64.zip"));
  fs.writeFileSync(path.join(output, "latest-mac.yml"), yaml.dump({
    version, files, path: zip.url, sha512: zip.sha512,
    releaseDate: new Date().toISOString(),
  }));
  const windows = path.join(input, "windows-x64");
  if (fs.existsSync(windows)) {
    for (const name of fs.readdirSync(windows)) {
      assert(name === "latest.yml" || name === `AIMedia-${version}-win-x64-Setup.exe` ||
        name === `AIMedia-${version}-win-x64-Setup.exe.blockmap`, "Unexpected Windows artifact");
      fs.copyFileSync(path.join(windows, name), path.join(output, name));
    }
  }
  const sums = fs.readdirSync(output).sort().filter((name) => name !== "SHA256SUMS.txt").map((name) => {
    const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(output, name))).digest("hex");
    return `${sha}  ${name}`;
  });
  fs.writeFileSync(path.join(output, "SHA256SUMS.txt"), sums.join("\n") + "\n");
  console.log(`PASS: verified release ${version}; both Mac architectures and update metadata collected.`);
}
if (require.main === module) {
  assert(process.argv[2] && process.argv[3], "Usage: prepare-release.cjs <artifacts> <output>");
  prepareRelease(process.argv[2], process.argv[3]);
}
module.exports = { prepareRelease };
