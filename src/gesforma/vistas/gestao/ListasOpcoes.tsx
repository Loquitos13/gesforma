// Gestão › Listas de opções: as escolhas usadas nos formulários, com quantos registos usam cada opção.
import { useMemo, useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiApagarOpcao, apiCriarOpcao, apiLista, apiListas, apiRenomearOpcao, type OpcaoLista } from "../../../partilhado/api/listas";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  Botao, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Modal, PageHeader, Tabela, Vazio, cx, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";

export default function ListasOpcoes(_props: VistaProps) {
  const pode = usePode();
  const podeGerir = pode("crm.apagar");
  const [f, setF] = useFiltrosUrl({ lista: "origens", q: "" });
  const listas = useRecurso("listas:resumo", signal => apiListas(signal));
  const lista = useRecurso(`listas:${f.lista}`, signal => apiLista(f.lista, signal));
  const [nova, setNova] = useState("");
  const [renomear, setRenomear] = useState<OpcaoLista | null>(null);
  const [apagar, setApagar] = useState<OpcaoLista | null>(null);

  const criar = useAccao((nome: string) => apiCriarOpcao(f.lista, nome), { ok: "Opção acrescentada.", invalidar: ["listas:", "opcoes:lista"] });
  const apagarAccao = useAccao((id: number) => apiApagarOpcao(f.lista, id), { ok: "Opção eliminada.", invalidar: ["listas:", "opcoes:lista"] });

  const opcoes = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return (lista.dados?.opcoes ?? []).filter(o => !q || o.nome.toLowerCase().includes(q));
  }, [lista.dados, f.q]);

  async function acrescentar() {
    const nome = nova.trim();
    if (!nome) return;
    if (await criar.correr(nome)) setNova("");
  }

  const colunas: Coluna<OpcaoLista>[] = [
    { id: "nome", titulo: "Opção", principal: true, celula: o => <span className="font-semibold">{o.nome}</span> },
    {
      id: "uso", titulo: "Registos que a usam", alinhar: "dir",
      celula: o => (o.uso ? (
        <span title={Object.entries(o.usoPor).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(", ")}>{o.uso}</span>
      ) : <span className="text-tinta-fraca">0</span>),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: "Gestão" }, { rotulo: "Listas de opções" }]}
        titulo="Listas de opções"
        subtitulo="As escolhas dos formulários do GesForma e do site. Mudar o nome de uma opção actualiza os registos que a usam."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Cartao semPadding as="div">
          <nav aria-label="Listas" className="p-2">
            {listas.erro ? <ErroCarregar erro={listas.erro} onTentar={listas.recarregar} /> : !listas.dados ? <Esqueleto linhas={8} className="p-3" /> : (
              <ul className="m-0 list-none space-y-0.5 p-0">
                {listas.dados.listas.map(l => (
                  <li key={l.id}>
                    <button
                      type="button"
                      aria-current={l.id === f.lista ? "true" : undefined}
                      onClick={() => setF({ lista: l.id, q: "" })}
                      className={cx("flex w-full items-center justify-between gap-2 rounded-controlo px-3 py-2 text-left text-sm", l.id === f.lista ? "bg-tinta text-white" : "hover:bg-fundo")}
                    >
                      <span className="truncate">{l.titulo}</span>
                      <span className={cx("num text-xs", l.id === f.lista ? "text-white/80" : "text-tinta-suave")}>{l.opcoes}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </Cartao>

        <Cartao
          titulo={lista.dados?.titulo ?? " "}
          subtitulo={lista.dados ? `Usada em: ${lista.dados.descricao}` : undefined}
          semPadding
        >
          <div className="flex flex-wrap items-end gap-2 border-b border-linha px-5 py-3">
            <Entrada aria-label="Filtrar opções" className="max-w-xs" placeholder="Filtrar…" value={f.q} onChange={e => setF({ q: e.target.value })} />
            <form className="ml-auto flex gap-2" onSubmit={e => { e.preventDefault(); void acrescentar(); }}>
              <Entrada aria-label="Nova opção" placeholder="Nova opção" value={nova} onChange={e => setNova(e.target.value)} />
              <Botao type="submit" variante="primario" aCarregar={criar.aCorrer} disabled={!nova.trim()}>Acrescentar</Botao>
            </form>
          </div>
          {lista.erro ? <ErroCarregar className="m-5" erro={lista.erro} onTentar={lista.recarregar} /> : (
            <Tabela
              rotulo={lista.dados?.titulo ?? "Opções"}
              linhas={opcoes}
              colunas={colunas}
              chave={o => o.id}
              aCarregar={lista.aCarregar}
              acoesLinha={podeGerir ? o => (
                <div className="flex justify-end gap-1">
                  <Botao tamanho="sm" variante="fantasma" onClick={() => setRenomear(o)}>Mudar o nome</Botao>
                  <Botao tamanho="sm" variante="fantasma" onClick={() => setApagar(o)}>Eliminar</Botao>
                </div>
              ) : undefined}
              vazio={<Vazio compacto titulo={f.q ? "Nenhuma opção com esse texto." : "Esta lista ainda não tem opções."} />}
            />
          )}
        </Cartao>
      </div>

      {renomear && <Renomear lista={f.lista} opcao={renomear} onFechar={() => setRenomear(null)} />}
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo="Eliminar opção"
        descricao={apagar ? (apagar.uso
          ? `«${apagar.nome}» é usada em ${apagar.uso} registos. Esses registos continuam a mostrá-la, mas deixa de estar disponível para escolher.`
          : `«${apagar.nome}» deixa de estar disponível para escolher.`) : ""}
        onConfirmar={async () => { if (apagar) { await apagarAccao.correr(apagar.id); setApagar(null); } }}
      />
    </div>
  );
}

function Renomear({ lista, opcao, onFechar }: { lista: string; opcao: OpcaoLista; onFechar: () => void }) {
  const [nome, setNome] = useState(opcao.nome);
  const accao = useAccao((novo: string) => apiRenomearOpcao(lista, opcao.id, novo), {
    ok: r => (r.registos ? `Nome mudado em ${r.registos} registos.` : "Nome mudado."),
    invalidar: ["listas:", "opcoes:", "cursos:", "catalogo:"],
  });
  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Mudar o nome da opção"
      largura="sm"
      rodape={(
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={accao.aCorrer} disabled={!nome.trim() || nome.trim() === opcao.nome}
            onClick={async () => { if (await accao.correr(nome.trim())) onFechar(); }}>Mudar</Botao>
        </div>
      )}
    >
      <div className="space-y-2">
        <Entrada aria-label="Novo nome" autoFocus value={nome} onChange={e => setNome(e.target.value)} />
        <p className="m-0 text-[13px] text-tinta-suave">
          {opcao.uso ? `Os ${opcao.uso} registos que usam «${opcao.nome}» passam a mostrar o novo nome.` : "Nenhum registo usa esta opção."}
        </p>
      </div>
    </Modal>
  );
}
