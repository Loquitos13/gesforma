// Configurações › Entidade: logótipo usado nos emails, recibos, propostas, contratos e cronogramas.
import { useRef, useState } from "react";
import { apiApagarLogo, apiCarregarLogo, apiLogo } from "../../../../partilhado/api/configuracoes";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { urlLogoEntidade } from "../../../../partilhado/logoEntidade";
import { Botao, Cartao, ConfirmarPerigo, ErroCarregar, Esqueleto, dataHora } from "../../../../partilhado/ui";

const MAX = 1024 * 1024;

export function LogoEntidade({ podeEditar }: { podeEditar: boolean }) {
  const { dados, erro, aCarregar, recarregar } = useRecurso("configuracoes/logo", s => apiLogo(s));
  const input = useRef<HTMLInputElement>(null);
  const [aApagar, setAApagar] = useState(false);
  const [erroLocal, setErroLocal] = useState("");
  const carregar = useAccao((f: File) => apiCarregarLogo(f), { ok: "Logótipo guardado.", invalidar: ["configuracoes/logo"] });
  const apagar = useAccao(() => apiApagarLogo(), { ok: "Logótipo removido.", invalidar: ["configuracoes/logo"] });
  const logo = dados?.logo ?? null;

  function escolher(f: File | undefined) {
    setErroLocal("");
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) return setErroLocal("Use uma imagem PNG ou JPG.");
    if (f.size > MAX) return setErroLocal("O logótipo passa de 1 MB.");
    void carregar.correr(f);
  }

  return (
    <Cartao
      titulo="Logótipo"
      subtitulo="Aparece nos emails, recibos, propostas, contratos e cronogramas. PNG ou JPG até 1 MB; de preferência com fundo transparente."
      acoes={podeEditar ? (
        <div className="flex gap-2">
          {logo && <Botao variante="fantasma" tamanho="sm" onClick={() => setAApagar(true)} disabled={apagar.aCorrer}>Remover</Botao>}
          <Botao variante="secundario" tamanho="sm" aCarregar={carregar.aCorrer} onClick={() => input.current?.click()}>
            {logo ? "Substituir" : "Carregar logótipo"}
          </Botao>
        </div>
      ) : undefined}
    >
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        aria-label="Ficheiro do logótipo"
        onChange={e => { escolher(e.target.files?.[0]); e.target.value = ""; }}
      />
      {aCarregar && !dados ? <Esqueleto linhas={2} /> : erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : (
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-4">
            <div className="h-20 w-48 rounded-controlo border border-linha bg-white flex items-center justify-center p-2">
              <img src={urlLogoEntidade(logo?.versao)} alt="Logótipo actual" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="h-20 w-48 rounded-controlo border border-linha bg-nav flex items-center justify-center p-2" aria-hidden="true">
              <img src={urlLogoEntidade(logo?.versao)} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          </div>
          <div className="text-[13px] text-tinta-suave space-y-1">
            {logo ? (
              <>
                <p className="m-0 text-tinta font-medium">{logo.nome}</p>
                <p className="m-0">{Math.round(logo.tamanho / 1024)} KB · actualizado {dataHora(logo.actualizado)}</p>
              </>
            ) : (
              <p className="m-0">Sem logótipo carregado: os documentos usam o logótipo ENA do site.</p>
            )}
            {erroLocal && <p className="m-0 text-perigo" role="alert">{erroLocal}</p>}
          </div>
        </div>
      )}
      <ConfirmarPerigo
        aberto={aApagar}
        onFechar={() => setAApagar(false)}
        onConfirmar={async () => { await apagar.correr(); setAApagar(false); }}
        titulo="Remover o logótipo?"
        descricao="Os emails e documentos novos passam a usar o logótipo ENA do site. Os PDF já emitidos não mudam."
        acao="Remover"
      />
    </Cartao>
  );
}
