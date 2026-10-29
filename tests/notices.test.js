import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectRuntimeImports, parseNotices, checkNotices, versionMatches, upstreamUrl, checkRepositoryNotices } from "../scripts/check-notices.mjs";

const NOTICES = `| Package | License | Upstream license |
| --- | --- | --- |
| \`viem@2\` | MIT | [wevm/viem](https://github.com/wevm/viem/blob/main/LICENSE) |
| \`@ipld/car@5\` | Apache-2.0 OR MIT | [ipld/js-car](https://github.com/ipld/js-car) |
`;

test("collects esm.sh imports with versions and file names", () => {
    const imports = collectRuntimeImports({
        "js/a.js": 'import { x } from "https://esm.sh/viem@2?bundle";\nimport y from "https://esm.sh/@ipld/car@5.4.7";',
        "js/b.js": 'import { z } from "https://esm.sh/viem@2/ens?bundle";'
    });
    assert.deepEqual([...imports.keys()], ["viem", "@ipld/car"]);
    assert.deepEqual([...imports.get("viem").versions], ["2"]);
    assert.deepEqual([...imports.get("viem").files], ["js/a.js", "js/b.js"]);
});

test("parses the notices table into package entries", () => {
    const notices = parseNotices(NOTICES);
    assert.equal(notices.size, 2);
    assert.deepEqual(notices.get("viem"), {
        spec: "viem@2",
        version: "2",
        license: "MIT",
        upstream: "[wevm/viem](https://github.com/wevm/viem/blob/main/LICENSE)"
    });
    assert.equal(notices.get("@ipld/car").version, "5");
});

test("matches exact and major-range versions but not unrelated ones", () => {
    assert.equal(versionMatches("2", "2.57.11"), true);
    assert.equal(versionMatches("2.57.11", "2.57.11"), true);
    assert.equal(versionMatches("2", "3.0.0"), false);
    assert.equal(versionMatches("", "3.0.0"), true);
});

test("extracts upstream URLs from markdown links and bare URLs", () => {
    assert.equal(upstreamUrl("[x](https://example.com/license)"), "https://example.com/license");
    assert.equal(upstreamUrl("https://example.com/license"), "https://example.com/license");
    assert.equal(upstreamUrl("example.com"), null);
    assert.equal(upstreamUrl(""), null);
});

test("reports missing, stale and unlinked notices", () => {
    const sources = {
        "js/a.js": 'import { x } from "https://esm.sh/viem@2?bundle";\nimport { y } from "https://esm.sh/multiformats@13/cid?bundle";',
        "js/b.js": 'import { z } from "https://esm.sh/@ipld/dag-pb@4";'
    };
    const errors = checkNotices({
        sources,
        notices: parseNotices(NOTICES),
        packageVersions: new Map([["viem", "2.57.11"], ["multiformats", "13.4.2"], ["@ipld/dag-pb", "4.2.0"]])
    });
    assert.equal(errors.length, 3);
    assert.match(errors[0], /missing `multiformats`.*js\/a\.js/);
    assert.match(errors[1], /missing `@ipld\/dag-pb`/);
    assert.match(errors[2], /lists `@ipld\/car`, which no runtime import uses/);
});

test("flags versions that disagree with package.json and imports", () => {
    const sources = { "js/a.js": 'import { x } from "https://esm.sh/viem@2?bundle";\nimport { y } from "https://esm.sh/@ipld/car@5.4.7";' };
    const errors = checkNotices({
        sources,
        notices: parseNotices(NOTICES),
        packageVersions: new Map([["viem", "3.0.0"], ["@ipld/car", "6.0.0"]])
    });
    assert.equal(errors.length, 2);
    assert.match(errors[0], /package.json pins `viem@3\.0\.0`/);
    assert.match(errors[1], /package.json pins `@ipld\/car@6\.0\.0`/);
});

test("flags notices entries no longer imported", () => {
    const errors = checkNotices({
        sources: { "js/a.js": 'import { x } from "https://esm.sh/viem@2?bundle";' },
        notices: parseNotices(NOTICES),
        packageVersions: new Map([["viem", "2.57.11"]])
    });
    assert.deepEqual(errors, ["THIRD-PARTY-NOTICES.md lists `@ipld/car`, which no runtime import uses any more."]);
});

test("the repository notices stay in sync with its runtime imports", async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const errors = await checkRepositoryNotices(root);
    assert.deepEqual(errors, []);
});