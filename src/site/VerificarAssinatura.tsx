// Página pública de verificação (/verificar/:codigo): estado da assinatura, signatário, datas e hashes.
// O ficheiro a comparar nunca sai do computador: o SHA-256 é calculado no browser.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ROTULO_ESTADO, TOM_ESTADO, apiVerificar, type Verificacao } from "../partilhado/api/assinaturas";
import { ApiError } from "../partilhado/api/cliente";
import { Aviso, Botao, Campo, Entrada, Estado, dataHora } from "../partilhado/ui";

async function sha256(f: File) {
  const buf = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function VerificarAssinatura({ codigo: inicial }: { codigo: string }) {
  const [codigo, setCodigo] = useState(inicial);
  const [v, setV] = useState<Verificacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [comparacao, setComparacao] = useState<{ hash: string; resultado: "final" | "original" | "diferente" } | null>(null);

  async function procurar(c: string) {
    if (!c.trim()) return;
    setACarregar(true);
    setErro(null);
    setComparacao(null);
    try {
      setV(await apiVerificar(c.trim().toUpperCase()));
      if (window.location.pathname !== `/verificar/${c.trim().toUpperCase()}`) {
        window.history.replaceState(null, "", `/verificar/${encodeURIComponent(c.trim().toUpperCase())}`);
      }
    } catch (e) {
      setV(null);
      setErro(e instanceof ApiError ? e.message : "Não foi possível verificar. Tente de novo.");
    } finally {
      setACarregar(false);
    }
  }
  useEffect(() => { if (inicial) void procurar(inicial); }, [inicial]); // eslint-disable-line react-hooks/exhaustive-deps

  async function comparar(f: File | undefined) {
    if (!f || !v) return;
    const hash = await sha256(f);
    setComparacao({ hash, resultado: hash === v.hashFinal ? "final" : hash === v.hashOriginal ? "original" : "diferente" });
  }

  return (
    <div className="min-h-screen bg-fundo px-4 py-8 sm:px-8 text-tinta">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <img src="/api/v1/public/entidade/logo" alt="" className="h-9 w-auto" onError={e => { (e.currentTarget as HTMLImageElement).src = "/imagens/ena-logo-nobg.png"; }} />
        <div>
          <h1 className="m-0 text-2xl font-semibold">Verificar documento assinado</h1>
          <p className="m-0 mt-1 text-sm text-tinta-suave">Use o código de verificação que está no documento ou no QR code.</p>
        </div>
        <form className="flex gap-2 items-end flex-wrap" onSubmit={(e: FormEvent) => { e.preventDefault(); void procurar(codigo); }}>
          <Campo rotulo="Código de verificação" className="flex-1 min-w-[220px]">
            {p => <Entrada {...p} value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" />}
          </Campo>
          <Botao type="submit" variante="primario" aCarregar={aCarregar}>Verificar</Botao>
        </form>
        {erro && <Aviso tom="perigo">{erro}</Aviso>}

        {v && (
          <section className="rounded-cartao border border-linha bg-superficie p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="m-0 text-lg font-semibold flex-1 min-w-0">{v.titulo}</h2>
              <Estado tom={TOM_ESTADO[v.estado]} ponto>{ROTULO_ESTADO[v.estado]}</Estado>
            </div>
            <dl className="m-0 grid gap-2 sm:grid-cols-2 text-sm">
              <Item rotulo="Entidade">{v.entidade}</Item>
              <Item rotulo="Signatário">{v.signatario.nome}{v.signatario.nif ? ` · NIF ${v.signatario.nif}` : ""}</Item>
              <Item rotulo="Enviado">{dataHora(v.enviadoEm)}</Item>
              <Item rotulo="Assinado">{v.assinadoEm ? dataHora(v.assinadoEm) : "—"}</Item>
              {v.metodo && <Item rotulo="Método">{v.metodo}</Item>}
              {v.selo && <Item rotulo="Selo da entidade">{v.selo.titular}</Item>}
              {v.assinaturaExterna?.titular && <Item rotulo="Certificado do signatário">{v.assinaturaExterna.titular}</Item>}
            </dl>
            <dl className="m-0 space-y-2 text-sm">
              <Item rotulo="SHA-256 do documento enviado"><code className="text-xs break-all">{v.hashOriginal}</code></Item>
              {v.hashFinal && <Item rotulo="SHA-256 do documento assinado"><code className="text-xs break-all">{v.hashFinal}</code></Item>}
              {v.selo && <Item rotulo="Certificado do selo (SHA-256)"><code className="text-xs break-all">{v.selo.fingerprint}</code></Item>}
            </dl>
            <div className="border-t border-linha pt-4 space-y-2">
              <Campo rotulo="Comparar com o seu ficheiro" ajuda="O ficheiro não é enviado: o SHA-256 é calculado neste computador.">
                {p => <input {...p} type="file" accept="application/pdf,.pdf" className="text-sm" onChange={e => void comparar(e.target.files?.[0])} />}
              </Campo>
              {comparacao?.resultado === "final" && <Aviso tom="sucesso">O ficheiro é exactamente o documento assinado.</Aviso>}
              {comparacao?.resultado === "original" && <Aviso tom="info">O ficheiro é o documento enviado para assinar (ainda sem assinatura).</Aviso>}
              {comparacao?.resultado === "diferente" && <Aviso tom="perigo">O ficheiro não corresponde a este documento: pode ter sido alterado.</Aviso>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-tinta-suave">{rotulo}</dt>
      <dd className="m-0 text-tinta break-words">{children}</dd>
    </div>
  );
}
