// Verifies that every runtime dependency bundled from esm.sh is listed in THIRD-PARTY-NOTICES.md.
// The release build strips legal comments (`legalComments: "none"`), so the notices file is the
// only place where bundled licenses are documented for the published site.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ESM_IMPORT_PATTERN = /https:\/\/esm\.sh\/((?:@[^/@]+\/)?[^@/?"'\s]+)@([^/?"'\s]+)/g;

// Collects `name@version` for every esm.sh import in the given sources.
export function collectRuntimeImports(sources) {
    const imports = new Map();
    for (const [file, content] of Object.entries(sources)) {
        for (const match of content.matchAll(ESM_IMPORT_PATTERN)) {
            const [, name, version] = match;
            if (!imports.has(name)) imports.set(name, { versions: new Set(), files: new Set() });
            const entry = imports.get(name);
            entry.versions.add(version);
            entry.files.add(file);
        }
    }
    return imports;
}

// Parses the three-column notice table into `name -> { spec, version, license, upstream }`.
export function parseNotices(markdown) {
    const notices = new Map();
    for (const line of markdown.split(/\r?\n/)) {
        const match = /^\|\s*`([^`]+)`\s*\|([^|]*)\|([^|]*)\|\s*$/.exec(line);
        if (!match) continue;
        const [, spec, license, upstream] = match;
        const separator = spec.lastIndexOf("@");
        const name = separator > 0 ? spec.slice(0, separator) : spec;
        const version = separator > 0 ? spec.slice(separator + 1) : "";
        notices.set(name, { spec, version, license: license.trim(), upstream: upstream.trim() });
    }
    return notices;
}

// Notices may pin a major range (`viem@2`) where the bundle uses an exact version (`2.57.11`).
export function versionMatches(declared, resolved) {
    if (!declared) return true;
    return resolved === declared || resolved.startsWith(`${declared}.`);
}

// Accepts a bare https URL or a Markdown link and returns the URL it points at.
export function upstreamUrl(upstream) {
    const markdown = /\]\((https:\/\/\S+?)\)/.exec(upstream);
    if (markdown) return markdown[1];
    return /^https:\/\/\S+$/.test(upstream) ? upstream : null;
}

export function checkNotices({ sources, notices, packageVersions }) {
    const errors = [];
    const imports = collectRuntimeImports(sources);

    for (const [name, { versions, files }] of imports) {
        const importedFrom = [...files].join(", ");
        const entry = notices.get(name);
        if (!entry) {
            errors.push(`THIRD-PARTY-NOTICES.md is missing \`${name}\`, which is imported by ${importedFrom}.`);
            continue;
        }
        if (!entry.license) errors.push(`THIRD-PARTY-NOTICES.md has no license for \`${name}\`.`);
        if (!upstreamUrl(entry.upstream)) {
            errors.push(`THIRD-PARTY-NOTICES.md needs an https upstream license link for \`${name}\`.`);
        }
        for (const version of versions) {
            if (!versionMatches(entry.version, version) && !versionMatches(version, entry.version)) {
                errors.push(`THIRD-PARTY-NOTICES.md lists \`${entry.spec}\` but ${importedFrom} imports \`${name}@${version}\`.`);
            }
        }
        const pinned = packageVersions.get(name);
        if (!pinned) {
            errors.push(`package.json does not pin \`${name}\`, so the release build cannot resolve its esm.sh import.`);
        } else if (![...versions].some((version) => versionMatches(version, pinned) || versionMatches(pinned, version))) {
            errors.push(`package.json pins \`${name}@${pinned}\`, but ${importedFrom} imports ${[...versions].map((version) => `\`${name}@${version}\``).join(", ")}.`);
        }
    }

    for (const name of notices.keys()) {
        if (!imports.has(name)) {
            errors.push(`THIRD-PARTY-NOTICES.md lists \`${name}\`, which no runtime import uses any more.`);
        }
    }
    return errors;
}

async function readJavaScriptSources(root, dir = "js") {
    const sources = {};
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
        const relative = path.posix.join(dir, entry.name);
        if (entry.isDirectory()) Object.assign(sources, await readJavaScriptSources(root, relative));
        else if (entry.name.endsWith(".js")) sources[relative] = await readFile(path.join(root, relative), "utf8");
    }
    return sources;
}

// Checks the repository itself; returns a list of human-readable problems.
export async function checkRepositoryNotices(root) {
    const [sources, noticesText, pkg] = await Promise.all([
        readJavaScriptSources(root),
        readFile(path.join(root, "THIRD-PARTY-NOTICES.md"), "utf8"),
        readFile(path.join(root, "package.json"), "utf8").then(JSON.parse)
    ]);
    const packageVersions = new Map(Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }));
    return checkNotices({ sources, notices: parseNotices(noticesText), packageVersions });
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const errors = await checkRepositoryNotices(root);
    if (errors.length === 0) {
        console.log("Third-party notices cover all runtime dependencies.");
    } else {
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
    }
}