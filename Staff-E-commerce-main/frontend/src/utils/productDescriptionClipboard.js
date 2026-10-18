// Only text and table structure are imported. Word's HTML, styles and links
// never enter the live editor; borders are supplied by the editor stylesheet.
export function normalizePastedDescription(description) {
  const compact = (value, cell = false) => {
    const text = value.replace(/\r\n?/g, "\n")
      .replace(/[\u200b\ufeff]/g, "")
      .split("\n")
      .map((line) => line.replace(/[ \t\u00a0\u2000-\u200a\u202f\u3000]+/g, " ").trim())
      .join("\n").trim();
    return text.replace(cell ? /\n{2,}/g : /\n{3,}/g, cell ? "\n" : "\n\n");
  };
  return {
    ...description,
    text: compact(description.text),
    tables: description.tables.map((table) => ({
      ...table,
      rows: table.rows.map((row) => row.map((cell) => compact(cell, true))),
    })),
  };
}

export function readDescriptionText(node) {
  if (node.nodeType === 3) return node.textContent || "";
  if (node.nodeType !== 1 && node.nodeType !== 11) return "";
  const tag = node.nodeName.toLowerCase();
  if (["table", "script", "style", "head", "noscript", "iframe", "object"].includes(tag)) return "";
  if (tag === "br") return "\n";
  const text = Array.from(node.childNodes).map(readDescriptionText).join("");
  return ["p", "div", "li", "h1", "h2", "h3", "h4", "tr"].includes(tag) ? `${text}\n` : text;
}

export function readDescriptionDocument(root) {
  return {
    text: readDescriptionText(root).replace(/\u00a0/g, " ").trimEnd(),
    tables: Array.from(root.querySelectorAll("table")).filter((table) => !table.parentElement?.closest("table"))
      .map((table) => ({
        header: table.dataset.descriptionHeader === "true" || !!table.rows[0]?.querySelector("th"),
        rows: Array.from(table.rows).map((row) => Array.from(row.cells).map((cell) => readDescriptionText(cell).trim())),
      })).filter((table) => table.rows.length),
  };
}

export function descriptionFragment(document, description) {
  const fragment = document.createDocumentFragment();
  const appendText = (text) => {
    if (!text) return;
    const paragraph = document.createElement("div");
    text.split("\n").forEach((line, index) => {
      if (index) paragraph.append(document.createElement("br"));
      paragraph.append(document.createTextNode(line));
    });
    fragment.append(paragraph);
  };
  appendText(description.text);
  description.tables.forEach((table) => {
    const element = document.createElement("table");
    element.dataset.descriptionHeader = String(table.header);
    const body = document.createElement("tbody");
    table.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      row.forEach((text) => {
        const cell = document.createElement(table.header && rowIndex === 0 ? "th" : "td");
        cell.textContent = text;
        tr.append(cell);
      });
      body.append(tr);
    });
    element.append(body);
    fragment.append(element);
    const trailing = document.createElement("div");
    trailing.append(document.createElement("br"));
    fragment.append(trailing);
  });
  return fragment;
}
