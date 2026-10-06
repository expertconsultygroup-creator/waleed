/* Model prose → HTML. Escape everything first, then allow a small subset
   (emphasis, code, lists, headings, quotes, http(s) links). Each block picks
   its own direction, so English prose inside an Arabic page keeps its
   punctuation where it belongs, and the other way round. */

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function inline(src: string): string {
  const codes: string[] = [];
  let s = src.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(code);
    return `\u0000C${codes.length - 1}\u0000`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
  return s.replace(/\u0000C(\d+)\u0000/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`);
}

function unescapeNested(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source).split("\n");
  let html = "";
  let i = 0;
  let list: "ul" | "ol" | null = null;
  let inCode = false;
  let code: string[] = [];
  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      if (!inCode) {
        closeList();
        inCode = true;
        code = [];
      } else {
        inCode = false;
        html += `<pre><code>${code.join("\n")}</code></pre>`;
      }
      i += 1;
      continue;
    }
    if (inCode) {
      code.push(line);
      i += 1;
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 4);
      html += `<h${level} dir="auto">${inline(heading[2])}</h${level}>`;
      i += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      closeList();
      html += "<hr>";
      i += 1;
      continue;
    }
    if (/^&gt;\s?/.test(line)) {
      closeList();
      const buf: string[] = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^&gt;\s?/, ""));
        i += 1;
      }
      html += `<blockquote dir="auto">${renderMarkdown(unescapeNested(buf.join("\n")))}</blockquote>`;
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        html += `<${kind} dir="auto">`;
        list = kind;
      }
      html += `<li>${inline((ul ?? ol)![1])}</li>`;
      i += 1;
      continue;
    }
    if (line.trim() === "") {
      closeList();
      i += 1;
      continue;
    }
    closeList();
    const buf = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|```|\s*[-*]\s|\s*\d+[.)]\s|&gt;)/.test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    html += `<p dir="auto">${inline(buf.join(" "))}</p>`;
  }
  if (inCode) html += `<pre><code>${code.join("\n")}</code></pre>`;
  closeList();
  return html;
}
