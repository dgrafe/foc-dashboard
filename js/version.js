import pkg from "../package.json" with { type: "json" };
import { t } from "./i18n.js";
import { bindText } from "./i18n-ui.js";

const el = document.getElementById("app-version");
if (el) bindText(el, () => t("footer.version", { version: pkg.version }));
