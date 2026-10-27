import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

// Dev uses pinned esm.sh URLs; the bundle resolves them to the exact npm versions in package.json.
const esmShToNpm = {
  name: "esm-sh-to-npm",
  setup(b) {
    b.onResolve({ filter: /^https:\/\/esm\.sh\// }, (args) => {
      const url = new URL(args.path);
      const match = url.pathname.slice(1).match(/^((?:@[^/@]+\/)?[^/@]+)@[^/]+(\/.*)?$/);
      if (!match) throw new Error(`Cannot map ${args.path} to an npm package`);
      return b.resolve(match[1] + (match[2] ?? ""), {
        kind: args.kind,
        resolveDir: root,
      });
    });
  },
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const result = await build({
  entryPoints: { app: path.join(root, "js/app.js"), styles: path.join(root, "css/styles.css") },
  outdir: dist,
  entryNames: "assets/[name]-[hash]",
  chunkNames: "assets/[name]-[hash]",
  bundle: true,
  splitting: true,
  format: "esm",
  target: "es2022",
  minify: true,
  metafile: true,
  legalComments: "none",
  plugins: [esmShToNpm],
  logLevel: "info",
});

const outputs = Object.entries(result.metafile.outputs);
const find = (entry) =>
  "./" + path.relative(dist, path.resolve(outputs.find(([, o]) => o.entryPoint === entry)[0])).replaceAll("\\", "/");
const jsFile = find("js/app.js");
const cssFile = find("css/styles.css");

let html = await readFile(path.join(root, "index.html"), "utf8");
html = html.replace("./css/styles.css", cssFile).replace("./js/app.js", jsFile);
await writeFile(path.join(dist, "index.html"), html);

for (const file of ["LICENSE", "THIRD-PARTY-NOTICES.md"]) {
  await cp(path.join(root, file), path.join(dist, file));
}
console.log("Release build written to dist/");
