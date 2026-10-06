import { useEffect, useRef, useState } from "react";
import { urlModeloPublico } from "./api";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export function LeituraConsentimento({
  token,
  tipo,
  label,
  onAceite,
  busy,
}: {
  token: string;
  tipo: string;
  label: string;
  onAceite: () => void;
  busy: boolean;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [paginas, setPaginas] = useState<string[]>([]);
  const [imagem, setImagem] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [lido, setLido] = useState(false);
  const [folhasProntas, setFolhasProntas] = useState(0);

  useEffect(() => {
    let cancel = false;
    const urls: string[] = [];
    setPaginas([]);
    setImagem("");
    setTexto("");
    setErro("");
    setLido(false);
    setFolhasProntas(0);
    (async () => {
      const res = await fetch(urlModeloPublico(token, tipo));
      if (!res.ok) throw new Error("Não foi possível abrir o documento.");
      const mime = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      const buf = await res.arrayBuffer();
      if (cancel) return;
      if (mime.startsWith("image/")) {
        const url = URL.createObjectURL(new Blob([buf], { type: mime }));
        urls.push(url);
        setImagem(url);
        return;
      }
      if (mime.startsWith("text/")) {
        setTexto(new TextDecoder().decode(buf));
        return;
      }
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const folhas: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancel) return;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport }).promise;
        folhas.push(canvas.toDataURL("image/jpeg", 0.86));
      }
      if (!cancel) setPaginas(folhas);
    })().catch(err => {
      if (!cancel) setErro(err instanceof Error ? err.message : "Não foi possível abrir o documento.");
    });
    return () => {
      cancel = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [token, tipo]);

  useEffect(() => {
    const folhas = paginas.length + (imagem ? 1 : 0);
    if (texto) {
      const el = caixa.current;
      if (el && el.scrollHeight <= el.clientHeight + 8) setLido(true);
      return;
    }
    if (!folhas || folhasProntas < folhas) return;
    const el = caixa.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setLido(true);
  }, [folhasProntas, paginas.length, imagem, texto]);

  function aoRolar(el: HTMLDivElement) {
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 28) setLido(true);
  }

  const aCarregar = !erro && !paginas.length && !imagem && !texto;

  return (
    <div className="px-6 pb-5 sm:px-8">
      <p className="text-sm text-[#5c564c]">
        Leia {label} até ao fim. O consentimento só fica disponível quando o documento chega ao final.
      </p>
      <div
        ref={caixa}
        onScroll={e => aoRolar(e.currentTarget)}
        className="mt-3 max-h-[28rem] overflow-y-auto rounded-xl border border-[#e7e1d6] bg-[#faf8f4]"
      >
        {aCarregar && <p className="px-4 py-8 text-sm text-[#8a8172]">A abrir o documento…</p>}
        {erro && <p className="px-4 py-6 text-sm text-red-700">{erro}</p>}
        {imagem && <img src={imagem} alt={label} className="w-full" onLoad={() => setFolhasProntas(n => n + 1)} />}
        {texto && <pre className="whitespace-pre-wrap px-4 py-4 text-sm leading-relaxed text-[#1b2330]">{texto}</pre>}
        {paginas.map((src, i) => (
          <img key={i} src={src} alt={`${label}, página ${i + 1}`} className="w-full border-b border-[#efeae1]" onLoad={() => setFolhasProntas(n => n + 1)} />
        ))}
      </div>
      <button
        type="button"
        disabled={busy || !lido}
        onClick={onAceite}
        className="mt-4 w-full rounded-lg bg-[#ffa900] px-4 py-3 text-sm font-semibold text-[#1b2330] disabled:opacity-40 sm:w-auto"
      >
        {busy ? "A registar…" : lido ? "Li e aceito" : "Deslize até ao fim do documento"}
      </button>
    </div>
  );
}
