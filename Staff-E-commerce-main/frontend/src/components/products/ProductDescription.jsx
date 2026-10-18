import { useEffect, useRef, useState } from "react";
import { parseProductDescription, serializeProductDescription, MAX_TABLE_ROWS, MAX_TABLE_COLUMNS } from "../../utils/productDescription";
import { descriptionFragment, normalizePastedDescription, readDescriptionDocument } from "../../utils/productDescriptionClipboard";


export function ProductDescriptionContent({ value }) {
  const document = parseProductDescription(value);
  if (!document.text.trim() && !document.tables.length) return <p className="text-sm text-gray-500">Không có mô tả</p>;
  return <div className="space-y-4 text-sm text-gray-700">
    {document.text.trim() && <p className="whitespace-pre-wrap break-words">{document.text}</p>}
    {document.tables.map((table, index) => <div key={index} className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-left" aria-label={`Bảng thông tin sản phẩm ${index + 1}`}><tbody>
        {table.rows.map((row, rowIndex) => <tr key={rowIndex} className={table.header && rowIndex === 0 ? "bg-gray-100 font-semibold" : rowIndex % 2 ? "bg-gray-50" : "bg-white"}>
          {row.map((cell, columnIndex) => {
            const Cell = table.header && rowIndex === 0 ? "th" : "td";
            return <Cell key={columnIndex} scope={Cell === "th" ? "col" : undefined} className="min-w-36 max-w-80 whitespace-pre-wrap break-words border border-gray-200 px-3 py-2.5 align-top">{cell}</Cell>;
          })}
        </tr>)}
      </tbody></table>
    </div>)}
  </div>;
}

export default function ProductDescriptionEditor({ value, onChange, disabled = false }) {
  const editor = useRef(null);
  const lastValue = useRef(null);
  const [pasteError, setPasteError] = useState("");

  useEffect(() => {
    if (!editor.current || value === lastValue.current) return;
    editor.current.replaceChildren(descriptionFragment(editor.current.ownerDocument, parseProductDescription(value)));
    lastValue.current = value;
  }, [value]);

  const save = () => {
    const next = serializeProductDescription(readDescriptionDocument(editor.current));
    lastValue.current = next;
    onChange(next);
  };

  const paste = (event) => {
    event.preventDefault();
    if (disabled) return;
    setPasteError("");
    const root = editor.current;
    const document = root.ownerDocument;
    const html = event.clipboardData.getData("text/html");
    let description;
    if (html) {
      const template = document.createElement("template");
      template.innerHTML = html;
      description = readDescriptionDocument(template.content);
      if (description.tables.some((table) => table.rows.length > MAX_TABLE_ROWS || table.rows.some((row) => row.length > MAX_TABLE_COLUMNS))) {
        setPasteError(`Bảng hỗ trợ tối đa ${MAX_TABLE_ROWS} hàng và ${MAX_TABLE_COLUMNS} cột. Hãy chia bảng trước khi dán.`);
        return;
      }
    } else {
      description = { text: event.clipboardData.getData("text/plain"), tables: [] };
    }
    const fragment = descriptionFragment(document, normalizePastedDescription(description));
    const selection = document.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range && root.contains(range.commonAncestorContainer)) {
      // A Word table belongs between paragraphs, rather than nested in a cell.
      const container = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
      if (description.tables.length && container?.closest("table")) {
        setPasteError("Hãy đặt con trỏ ngoài bảng hiện tại để dán thêm bảng.");
        return;
      }
      range.deleteContents();
      const last = fragment.lastChild;
      range.insertNode(fragment);
      if (last) { range.setStartAfter(last); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
    } else {
      root.append(fragment);
    }
    save();
  };

  return <div className="space-y-2">
    <div ref={editor} contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Mô tả sản phẩm, hỗ trợ dán bảng từ Word" onInput={save} onBlur={save} onPaste={paste} onDrop={(event) => event.preventDefault()}
      className={`min-h-40 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:min-w-28 [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:min-w-28 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left ${disabled ? "bg-gray-50 opacity-60" : "bg-white"}`} />

  </div>;
}

