// DOM integration for i18n: binds elements to translated text/attributes, translates the
// static markup (data-i18n* attributes) and provides the language selector.
// Dynamic UI created in other modules binds through bindText/bindAttr/bindDom so a language
// switch re-renders it; bindings on removed elements are pruned automatically.
import { t, getCurrentLanguage, setLanguage, getAvailableLanguages, getLanguageName, onLanguageChange } from "./i18n.js";

const bindings = new Set();

// Registers `apply` for the element and runs it once, so the element starts out translated.
function trackFor(el, apply) {
    bindings.add({ el, apply, wasConnected: el.isConnected });
    apply();
    return apply;
}

// Keeps el.textContent in sync with the current language; render returns the translated text.
export function bindText(el, render) {
    return trackFor(el, () => {
        el.textContent = render();
    });
}

// Keeps an attribute (e.g. title or aria-label) in sync with the current language.
export function bindAttr(el, attr, render) {
    return trackFor(el, () => {
        el.setAttribute(attr, render());
    });
}

// Lets render(el) rebuild a whole subtree on first bind and on every language change.
export function bindDom(el, render) {
    return trackFor(el, () => render(el));
}

// Re-renders every live binding. Detached nodes are kept: cards and rows are built off-DOM and only
// appended once loaded, so pruning those would leave them permanently in the old language. A binding
// is dropped only after it was seen connected and has since been removed (a finished search).
function retranslateBound() {
    for (const entry of [...bindings]) {
        if (entry.el.isConnected) {
            entry.wasConnected = true;
            entry.apply();
        } else if (entry.wasConnected) {
            bindings.delete(entry);
        } else {
            entry.apply();
        }
    }
}

function translateStatic() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (el.tagName === "META") el.setAttribute("content", t(key));
        else el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
        el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
}

function updateHead() {
    document.documentElement.lang = getCurrentLanguage();
    document.title = t("meta.title");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));
}

function installLanguageSelector() {
    const footer = document.querySelector("footer");
    if (!footer || document.getElementById("languageSelector")) return;
    const select = document.createElement("select");
    select.id = "languageSelector";
    select.className = "language-switch";
    for (const code of getAvailableLanguages()) {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = getLanguageName(code);
        option.selected = code === getCurrentLanguage();
        select.appendChild(option);
    }
    select.addEventListener("change", () => setLanguage(select.value));
    bindAttr(select, "aria-label", () => t("footer.languageLabel"));
    footer.append(select);
}

let initialized = false;

export function initI18n() {
    if (initialized) return;
    initialized = true;
    updateHead();
    translateStatic();
    installLanguageSelector();
    onLanguageChange(() => {
        updateHead();
        translateStatic();
        retranslateBound();
    });
}