// Sistema › Site › Testemunhos: as opiniões que os formandos deixam na área do formando.
// Só as aprovadas (e com autorização do formando) aparecem no bloco Testemunhos do site.
import { useState } from "react";
import { apiApagarTestemunho, apiReverTestemunho, apiTestemunhos, type EstadoTestemunho } from "../../../partilhado/api/site";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Aviso, Botao, Cartao, ConfirmarPerigo, ErroCarregar, Esqueleto, Estado, cx } from "../../../partilhado/ui";
import { fmtDataLisboa } from "../../../partilhado/horaLisboa";

const FILTROS: [EstadoTestemunho | "", string][] = [["pendente", "Por rever"], ["aprovado", "Aprovados"], ["recusado", "Recusados"], ["", "Todos"]];
const TOM: Record<EstadoTestemunho, "aviso" | "sucesso" | "neutro"> = { pendente: "aviso", aprovado: "sucesso", recusado: "neutro" };
const ROTULO: Record<EstadoTestemunho, string> = { pendente: "Por rever", aprovado: "Aprovado", recusado: "Recusado" };

export function TestemunhosSite() {
  const [filtro, setFiltro] = useState<EstadoTestemunho | "">("pendente");
  const { dados, erro, recarregar } = useRecurso(`testemunhos:${filtro}`, s => apiTestemunhos(filtro || undefined, s));
  const [apagar, setApagar] = useState<number | null>(null);
  const rever = useAccao((p: { id: number; estado: EstadoTestemunho }) => apiReverTestemunho(p.id, p.estado), { ok: "Testemunho atualizado.", invalidar: ["testemunhos:"] });
  const tirar = useAccao(apiApagarTestemunho, { ok: "Testemunho apagado.", invalidar: ["testemunhos:"] });

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Aviso tom="info">
        Os formandos deixam a opinião na área do formando (botão «Deixe a sua opinião»). Só os aprovados, e cujo formando autorizou a publicação,
        aparecem no bloco Testemunhos do site. Se o formando alterar a opinião, ela volta a «Por rever».
      </Aviso>
      <div role="tablist" aria-label="Estado" className="flex flex-wrap gap-2">
        {FILTROS.map(([id, rotulo]) => (
          <button key={id || "todos"} type="button" role="tab" aria-selected={filtro === id} onClick={() => setFiltro(id)}
            className={cx("rounded-full border px-3 py-1.5 text-sm font-semibold", filtro === id ? "border-acao bg-acao/10 text-tinta" : "border-linha text-tinta-suave hover:text-tinta")}>
            {rotulo}
          </button>
        ))}
      </div>
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : !dados ? <Esqueleto linhas={6} /> : dados.testemunhos.length === 0 ? (
        <Cartao><p className="m-0 text-sm text-tinta-suave">Sem testemunhos {filtro ? `«${FILTROS.find(f => f[0] === filtro)?.[1].toLowerCase()}»` : ""}.</p></Cartao>
      ) : dados.testemunhos.map(t => (
        <Cartao key={t.id}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Estado tom={TOM[t.estado]} ponto>{ROTULO[t.estado]}</Estado>
              <strong>{t.nome}</strong>
              <span className="text-tinta-suave">{t.email} · {fmtDataLisboa(t.atualizadoEm)}</span>
              <span className="ml-auto text-[var(--c-acento,#FFA900)]" aria-label={`${t.estrelas} em 5 estrelas`}>{"★".repeat(t.estrelas)}<span className="text-black/15">{"★".repeat(5 - t.estrelas)}</span></span>
            </div>
            <p className="m-0 text-sm text-tinta-suave">{t.curso ? `Sobre: ${t.curso}` : "Sobre a ENA em geral"}</p>
            <p className="m-0 whitespace-pre-line">{t.texto}</p>
            {!t.autorizaPublicar && <p className="m-0 text-sm font-semibold text-tinta-suave">O formando não autorizou a publicação: mesmo aprovado, não aparece no site.</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Botao variante="fantasma" onClick={() => setApagar(t.id)}>Apagar</Botao>
              {t.estado !== "recusado" && <Botao aCarregar={rever.aCorrer} onClick={() => void rever.correr({ id: t.id, estado: "recusado" })}>Recusar</Botao>}
              {t.estado !== "aprovado" && <Botao variante="primario" aCarregar={rever.aCorrer} onClick={() => void rever.correr({ id: t.id, estado: "aprovado" })}>Aprovar</Botao>}
            </div>
          </div>
        </Cartao>
      ))}
      <ConfirmarPerigo aberto={apagar != null} onFechar={() => setApagar(null)} titulo="Apagar este testemunho?" acao="Apagar"
        descricao="Sai da lista e do site. O formando pode voltar a escrever um novo na área do formando."
        onConfirmar={async () => { if (apagar != null) await tirar.correr(apagar); setApagar(null); }} />
    </div>
  );
}
