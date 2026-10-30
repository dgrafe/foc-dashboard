import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    translations, t, setLanguage, getCurrentLanguage,
    getAvailableLanguages, getLanguageName, localeTag, onLanguageChange
} from "../js/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Collects the static markup and every module source so key usage can be checked both ways.
async function readSources() {
    const sources = {};
    for (const entry of await readdir(path.join(root, "js"))) {
        if (entry.endsWith(".js")) sources[`js/${entry}`] = await readFile(path.join(root, "js", entry), "utf8");
    }
    sources["index.html"] = await readFile(path.join(root, "index.html"), "utf8");
    return sources;
}

function usedKeys(sources) {
    const keys = new Set();
    for (const [file, content] of Object.entries(sources)) {
        if (file === "index.html") {
            for (const match of content.matchAll(/data-i18n(?:-placeholder|-title|-aria)?="([\w.]+)"/g)) keys.add(match[1]);
        } else {
            for (const match of content.matchAll(/(?:^|[^\w.])t\(\s*["']([\w.]+)["']/g)) keys.add(match[1]);
        }
    }
    return keys;
}

test("dictionary keys match their usage in markup and code", async () => {
    const used = usedKeys(await readSources());
    const en = Object.keys(translations.en);
    assert.deepEqual([...used].filter((key) => !(key in translations.en)), [], "used keys are missing from the dictionary");
    assert.deepEqual(en.filter((key) => !used.has(key)), [], "dictionary keys that nothing uses");
});

test("every locale has exactly the English key set", () => {
    const en = Object.keys(translations.en).sort();
    for (const lang of getAvailableLanguages()) {
        assert.deepEqual(Object.keys(translations[lang]).sort(), en, `locale ${lang} differs from en`);
    }
});

test("translates per language and substitutes :name placeholders", () => {
    setLanguage("en");
    assert.equal(t("dataset.title", { id: 7 }), "Dataset: 7");
    assert.equal(t("results.datasetsOne", { count: 1 }), "1 Dataset");
    assert.equal(t("format.durationDays", { days: 2, hours: 3 }), "2 days 3 hr");
    assert.equal(t("does.not.exist"), "[[does.not.exist]]");

    setLanguage("de");
    assert.equal(t("dataset.title", { id: 7 }), "Datensatz: 7");
    assert.equal(t("app.noDatasets"), translations.de["app.noDatasets"]);
    assert.equal(localeTag(), "de-DE");

    setLanguage("zh");
    assert.equal(t("dataset.title", { id: 7 }), "数据集：7");
    assert.equal(t("results.datasetsOne", { count: 1 }), "1 个数据集");
    assert.equal(localeTag(), "zh-CN");
    setLanguage("en");
});

test("falls back to English when a locale entry is missing", () => {
    const key = "dataset.title";
    const original = translations.de[key];
    delete translations.de[key];
    setLanguage("de");
    assert.equal(t(key, { id: 3 }), translations.en[key].replace(":id", "3"));
    translations.de[key] = original;
    setLanguage("en");
});

test("language switching round-trips and notifies listeners", () => {
    const events = [];
    const unsubscribe = onLanguageChange((lang) => events.push(lang));
    setLanguage("de");
    assert.equal(getCurrentLanguage(), "de");
    setLanguage("en");
    unsubscribe();
    setLanguage("fr");
    assert.deepEqual(events, ["de", "en"]);
    setLanguage("en");
    assert.equal(getLanguageName("de"), "Deutsch");
    assert.equal(getLanguageName("xx"), "xx");
    assert.deepEqual(getAvailableLanguages(), ["en", "de", "es", "fr", "zh"]);
});