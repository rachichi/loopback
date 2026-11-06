// A small Markdown to HTML converter for the minutes the model writes: headings, bullets, numbered
// lines, bold and italic, paragraphs. No dependencies, so it runs in Deno and Node.

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (text: string) =>
  escape(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>");

export function markdownToHtml(markdown: string): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (!line.trim()) { close(); continue; }
    if (heading) { close(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
    const kind = bullet ? "ul" : numbered ? "ol" : null;
    if (kind) {
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
      continue;
    }
    close();
    out.push(`<p>${inline(line.trim())}</p>`);
  }
  close();
  return out.join("\n");
}
