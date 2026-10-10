const WIN: Record<string, number> = {
  "á": 0xe1, "à": 0xe0, "â": 0xe2, "ã": 0xe3,
  "é": 0xe9, "ê": 0xea,
  "í": 0xed,
  "ó": 0xf3, "ô": 0xf4, "õ": 0xf5,
  "ú": 0xfa,
  "ç": 0xe7,
  "Á": 0xc1, "À": 0xc0, "Â": 0xc2, "Ã": 0xc3,
  "É": 0xc9, "Ê": 0xca,
  "Í": 0xcd,
  "Ó": 0xd3, "Ô": 0xd4, "Õ": 0xd5,
  "Ú": 0xda,
  "Ç": 0xc7,
  "º": 0xba, "ª": 0xaa,
  "·": 0xb7, "•": 0x95,
  "–": 0x96, "—": 0x97, "…": 0x85,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94,
};

function pdfString(value: string) {
  let out = "";
  for (const ch of value) {
    if (ch === "\\" || ch === "(" || ch === ")") {
      out += `\\${ch}`;
      continue;
    }
    const code = ch.codePointAt(0) ?? 63;
    const byte = code < 128 ? code : WIN[ch];
    if (byte == null || byte < 32) {
      out += "?";
      continue;
    }
    if (byte < 128) out += String.fromCharCode(byte);
    else out += `\\${byte.toString(8).padStart(3, "0")}`;
  }
  return out;
}

/** PDF de texto simples, uma coluna, várias páginas. */
export function pdfDeLinhas(linhas: string[]) {
  const porPagina = 46;
  const paginas: string[][] = [];
  const fonte = linhas.length ? linhas : [" "];
  for (let i = 0; i < fonte.length; i += porPagina) paginas.push(fonte.slice(i, i + porPagina));

  const objs: string[] = [];
  const pageIds: number[] = [];
  let id = 3;
  const fontId = 3 + paginas.length * 2;
  for (const pagina of paginas) {
    const pageId = id++;
    const contentId = id++;
    pageIds.push(pageId);
    const comandos = ["BT", "/F1 11 Tf", "50 800 Td", "14 TL"];
    pagina.forEach((linha, iLinha) => {
      const texto = `(${pdfString(linha.slice(0, 110))})`;
      comandos.push(iLinha === 0 ? `${texto} Tj` : `T* ${texto} Tj`);
    });
    comandos.push("ET");
    const stream = comandos.join("\n");
    objs.push(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >> endobj\n`);
    objs.push(`${contentId} 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj\n`);
  }
  objs.push(`${fontId} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj\n`);

  const kids = pageIds.map(n => `${n} 0 R`).join(" ");
  const ordered = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >> endobj\n`,
    ...objs,
  ];
  const header = "%PDF-1.4\n";
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(header);
  const chunks = [header];
  for (const obj of ordered) {
    const n = Number(obj.match(/^(\d+) 0 obj/)?.[1] ?? 0);
    offsets[n] = cursor;
    chunks.push(obj);
    cursor += Buffer.byteLength(obj);
  }
  const size = fontId + 1;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) xref += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  chunks.push(`${xref}trailer << /Size ${size} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF`);
  return Buffer.from(chunks.join(""));
}
