// Carregar, ver e remover um logótipo do rodapé dos documentos da Financiada (DGERT ou programa).
import { useRef, useState } from "react";
import {
  apiApagarLogoDocumento, apiCarregarLogoDocumento, apiLogoDocumento, urlLogoDocumento, type DestinoLogo,
} from "../partilhado/api/logosDocumentos";
import { useAccao } from "../partilhado/dados/useAccao";
import { useRecurso } from "../partilhado/dados/useRecurso";
import { Botao, ConfirmarPerigo, ErroCarregar, Esqueleto, dataHora } from "../partilhado/ui";

const MAX = 1024 * 1024;

export function LogoDocumento({ destino, podeEditar, semLogo, nome }: {
  destino: DestinoLogo;
  podeEditar: boolean;
  /** Texto quando ainda não há logótipo. */
  semLogo: string;
  /** Para o texto de confirmação («o logótipo da DGERT»). */
  nome: string;
}) {
  const chave = `logo-doc:${destino.api}`;
  const { dados, erro, aCarregar, recarregar } = useRecurso(chave, s => apiLogoDocumento(destino, s));
  const input = useRef<HTMLInputElement>(null);
  const [aApagar, setAApagar] = useState(false);
  const [erroLocal, setErroLocal] = useState("");
  const carregar = useAccao((f: File) => apiCarregarLogoDocumento(destino, f), { ok: "Logótipo guardado.", invalidar: [chave] });
  const apagar = useAccao(() => apiApagarLogoDocumento(destino), { ok: "Logótipo removido.", invalidar: [chave] });
  const logo = dados?.logo ?? null;

  function escolher(f: File | undefined) {
    setErroLocal("");
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) return setErroLocal("Use uma imagem PNG ou JPG.");
    if (f.size > MAX) return setErroLocal("O logótipo passa de 1 MB.");
    void carregar.correr(f);
  }

  if (aCarregar && !dados) return <Esqueleto linhas={2} />;
  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept="image/png,image/jpeg" className="sr-only" aria-label="Ficheiro do logótipo"
        onChange={e => { escolher(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="h-20 w-56 rounded-controlo border border-linha bg-white flex items-center justify-center p-2">
          {logo
            ? <img src={urlLogoDocumento(destino, logo.versao)} alt={`Logótipo actual: ${nome}`} className="max-h-full max-w-full object-contain" />
            : <span className="text-xs text-tinta-suave">Sem logótipo</span>}
        </div>
        <div className="text-[13px] text-tinta-suave space-y-1 min-w-0">
          {logo ? (
            <>
              <p className="m-0 text-tinta font-medium truncate">{logo.nome}</p>
              <p className="m-0">{Math.round(logo.tamanho / 1024)} KB · actualizado {dataHora(logo.actualizado)}</p>
            </>
          ) : <p className="m-0">{semLogo}</p>}
          {erroLocal && <p className="m-0 text-perigo" role="alert">{erroLocal}</p>}
        </div>
      </div>
      {podeEditar && (
        <div className="flex gap-2">
          <Botao variante="secundario" tamanho="sm" aCarregar={carregar.aCorrer} onClick={() => input.current?.click()}>
            {logo ? "Substituir" : "Carregar logótipo"}
          </Botao>
          {logo && <Botao variante="fantasma" tamanho="sm" onClick={() => setAApagar(true)} disabled={apagar.aCorrer}>Remover</Botao>}
        </div>
      )}
      <ConfirmarPerigo
        aberto={aApagar}
        onFechar={() => setAApagar(false)}
        onConfirmar={async () => { await apagar.correr(); setAApagar(false); }}
        titulo="Remover o logótipo?"
        descricao={`Os documentos gerados a partir de agora saem sem ${nome}. Os PDF já emitidos não mudam.`}
        acao="Remover"
      />
    </div>
  );
}
