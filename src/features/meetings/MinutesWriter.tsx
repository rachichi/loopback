// Plays the drafted minutes in as if they were being written, right after Generate. The text is typed out
// over a few seconds, then onDone hands over to the editor. Display only: nothing here is saved.
import { useEffect, useMemo, useRef, useState } from "react";

const ALLOWED = new Set(["H1", "H2", "H3", "P", "UL", "OL", "LI", "STRONG", "EM", "B", "I", "BR"]);
/** Roughly how long the whole draft takes to type. */
const TOTAL_MS = 4500;
const TICK_MS = 40;

/** The minutes as a DOM tree of known tags only: no attributes, no scripts, whatever the HTML held. */
function cleanTree(html: string): HTMLElement {
  const root = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;
  const clean = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE || !ALLOWED.has((child as Element).tagName)) {
        if (child.nodeType === Node.ELEMENT_NODE && ["SCRIPT", "STYLE"].includes((child as Element).tagName)) { child.remove(); continue; }
        // Unknown tag: keep its text, drop the tag.
        clean(child);
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const attribute of Array.from((child as Element).attributes)) (child as Element).removeAttribute(attribute.name);
      clean(child);
    }
  };
  clean(root);
  return root;
}

/** The first `count` characters of the tree's text, with the tags around them kept. */
function truncate(root: HTMLElement, count: number): string {
  const copy = root.cloneNode(true) as HTMLElement;
  let left = count;
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (left <= 0) { child.remove(); continue; }
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? "";
        if (text.length > left) child.textContent = text.slice(0, left);
        left -= text.length;
      } else walk(child);
    }
  };
  walk(copy);
  return copy.innerHTML;
}

export default function MinutesWriter({ html, onDone }: {
  /** The drafted minutes. Null while they are still loading. */
  html: string | null;
  onDone: () => void;
}) {
  const tree = useMemo(() => (html === null ? null : cleanTree(html)), [html]);
  const total = tree?.textContent?.length ?? 0;
  const [shown, setShown] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tree) return;
    if (shown >= total) { onDone(); return; }
    const step = Math.max(2, Math.ceil(total / (TOTAL_MS / TICK_MS)));
    const timer = window.setTimeout(() => setShown((count) => Math.min(total, count + step)), TICK_MS);
    return () => window.clearTimeout(timer);
  }, [tree, shown, total]);
  // Follow the writing down the page.
  useEffect(() => { if (body.current) body.current.scrollTop = body.current.scrollHeight; }, [shown]);

  if (!tree) return <div className="transcript-empty">Writing minutes…</div>;
  return (
    <div className="minutes-editor">
      <div className="minutes-body writing" ref={body}>
        <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: truncate(tree, shown) }} />
      </div>
    </div>
  );
}
