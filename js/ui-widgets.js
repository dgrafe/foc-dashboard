const SVG_NS = "http://www.w3.org/2000/svg";

function createIconSvg() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    return svg;
}

function createSvgPath(d) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    return path;
}

export function createHashCopyControl(hash, label) {
    const button = document.createElement("button");
    button.className = "copy-hash-button";
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;

    const icon = createIconSvg();
    const frontSheet = document.createElementNS(SVG_NS, "rect");
    frontSheet.setAttribute("width", "14");
    frontSheet.setAttribute("height", "14");
    frontSheet.setAttribute("x", "8");
    frontSheet.setAttribute("y", "8");
    frontSheet.setAttribute("rx", "2");
    const backSheet = createSvgPath("M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v2");
    icon.append(frontSheet, backSheet);
    button.appendChild(icon);

    const status = document.createElement("span");
    status.className = "piece-copy-status";
    status.setAttribute("aria-live", "polite");
    button.addEventListener("click", () => copyPieceCid(hash, status));
    return { button, status };
}

export function createDownloadLink(url, label, source, iconText = "download") {
    const link = document.createElement("a");
    link.className = "download-icon";
    if (source === "Provider") link.classList.add("download-provider");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", label);
    link.title = label;
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    if (iconText === "external") {
        const svg = createIconSvg();
        svg.appendChild(createSvgPath("M13 5h6v6M19 5l-9 9M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"));
        icon.appendChild(svg);
    } else if (iconText === "download") {
        const svg = createIconSvg();
        svg.append(createSvgPath("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"), createSvgPath("m7 10 5 5 5-5M12 15V3"));
        icon.appendChild(svg);
    } else {
        icon.textContent = iconText;
    }
    const sourceLabel = document.createElement("span");
    sourceLabel.className = "download-source";
    sourceLabel.textContent = source;
    link.append(icon, sourceLabel);
    return link;
}

export async function copyPieceCid(cid, status) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(cid);
        } else {
            const field = document.createElement("textarea");
            field.value = cid;
            field.style.position = "fixed";
            field.style.opacity = "0";
            document.body.appendChild(field);
            field.select();
            const copied = document.execCommand("copy");
            field.remove();
            if (!copied) throw new Error("Clipboard unavailable");
        }
        status.textContent = "Copied";
        setTimeout(() => { status.textContent = ""; }, 1800);
    } catch {
        status.textContent = "Could not copy";
    }
}

export function addEmptyPieces(container, message) {
    const line = document.createElement("p");
    line.className = "piece-result pending";
    line.textContent = message;
    container.appendChild(line);
}

export function setResult(container, message, kind) {
    container.replaceChildren();
    const text = document.createElement("span");
    text.className = kind;
    text.textContent = message;
    container.appendChild(text);
}
