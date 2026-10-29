import pkg from "../package.json" with { type: "json" };

const el = document.getElementById("app-version");
if (el) el.textContent = `Version ${pkg.version}`;
