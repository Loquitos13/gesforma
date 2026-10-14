// Formadores Gold e Financiada: lista com KPIs (CCP, documentos, turmas, horas). Cada linha abre a ficha.
import { useState } from "react";
import {
  apiAlterarFormador, apiApagarFormador, apiFormadores, type AcessoCriado, type FormadorBase, type LinhaFormador, type Regime,
} from "../../../partilhado/api/formadores";
import { useAuth } from "../../../partilhado/AuthGate";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { SLOTS_CCP } from "../../../partilhado/disponibilidade";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import {
  Botao, Cartao, ConfirmarPerigo, ErroCarregar, Estado, Filtros, Kpi, KpiFaixa, PageHeader, Paginacao, Tabela,
  data, eur, num, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { MenuLinha } from "../turmas/MenuLinha";
import { AvisoAcesso } from "./AvisoAcesso";
import { FormadorFormulario } from "./FormadorFormulario";
import { Iniciais, estadoCcp } from "./formadoresUi";

const PADRAO = { q: "", estado: "", especialidade: "", disponibilidade: "", alerta: "", ordem: "", pagina: "1" };
const POR_PAGINA = 25;

export default function Formadores({ view, navigate }: VistaProps) {
  const regime: Regime = view === "fin-formadores" ? "fin" : "gold";
  const fin = regime === "fin";
  const { pode } = useAuth();
  const gerir = pode("formadores.gerir");
  const [f, setF, limpar] = useFiltrosUrl(PADRAO);
  const [form, setForm] = useState<{ formador: FormadorBase | null } | null>(null);
  const [apagar, setApagar] = useState<LinhaFormador | null>(null);
  const [acesso, setAcesso] = useState<AcessoCriado>(null);

  const pedido = { regime, ...f, pagina: Number(f.pagina) || 1, porPagina: POR_PAGINA };
  const lista = useRecurso(`formadores:${regime}:${JSON.stringify(pedido)}`, s => apiFormadores(pedido, s));
  const kpis = lista.dados?.kpis;
  const depoisDeGravar = () => { invalidar("formadores:"); invalidar("formador:"); invalidar("opcoes:formadores"); };
  const ativar = useAccao((x: LinhaFormador) => apiAlterarFormador(x.id, { estado: x.estado === "Ativo" ? "Inactivo" : "Ativo" }), {
    ok: r => r.formador.estado === "Ativo" ? "Formador ativado." : "Formador desativado.",
  });
  const abrir = (x: LinhaFormador) => navigate({ view: "formador-ficha", formadorId: x.id });
  const filtrosAtivos = ["q", "estado", "especialidade", "disponibilidade", "alerta"].filter(k => f[k as keyof typeof f]).length;

  const colunas: Coluna<LinhaFormador>[] = [
    {
      id: "nome", titulo: "Formador", ordenavel: true, principal: true,
      celula: x => (
        <div className="flex items-center gap-3 min-w-0">
          <Iniciais nome={x.nome} />
          <div className="min-w-0">
            <p className="m-0 font-semibold text-tinta truncate">{x.nome}</p>
            <p className="m-0 text-xs text-tinta-suave truncate">{x.email || "Sem email"}{x.temAcesso ? " · com acesso" : ""}</p>
          </div>
        </div>
      ),
    },
    {
      id: "ccp", titulo: "CCP", ordenavel: true,
      celula: x => {
        const e = estadoCcp(x);
        return <div className="text-[13px]"><p className="m-0 num">{x.ccp || "—"}</p><Estado tom={e.tom}>{e.texto}</Estado></div>;
      },
    },
    {
      id: "especialidade", titulo: "Especialidade", esconderMovel: true,
      celula: x => (
        <div className="text-[13px] min-w-0">
          <p className="m-0 truncate max-w-[220px]">{x.especialidade || "—"}</p>
          <div className="flex gap-1 mt-1">
            {x.regimes.includes("gold") && <Estado tom="acao">Gold</Estado>}
            {x.regimes.includes("fin") && <Estado tom="info">Financiada</Estado>}
          </div>
        </div>
      ),
    },
    {
      id: "turmas", titulo: "Turmas", ordenavel: true,
      celula: x => (
        <div className="num text-[13px]">
          <p className="m-0">{x.turmasAtivas} a decorrer · {x.turmas} no total</p>
          <p className="m-0 text-xs text-tinta-suave">{x.proximaSessao ? `Próxima sessão ${data(x.proximaSessao)}` : "Sem sessões marcadas"}</p>
        </div>
      ),
    },
    {
      id: "horas", titulo: "Horas", ordenavel: true, alinhar: "dir",
      celula: x => <div className="num text-[13px] text-right"><p className="m-0">{num(x.horasDadas)} h dadas</p><p className="m-0 text-xs text-tinta-suave">{num(x.horasPendentes)} h por dar</p></div>,
    },
    { id: "valor", titulo: "Valor/h", alinhar: "dir", esconderMovel: true, celula: x => <span className="num text-[13px]">{x.custoHora ? eur(x.custoHora, true) : "—"}</span> },
    {
      id: "docs", titulo: "Documentos", ordenavel: true,
      celula: x => x.docsEmFalta > 0
        ? <Estado tom="aviso">{x.docsEmFalta} em falta</Estado>
        : <Estado tom="sucesso">Completos</Estado>,
    },
    { id: "estado", titulo: "Estado", esconderMovel: true, celula: x => <Estado tom={x.estado === "Ativo" ? "sucesso" : "neutro"} ponto>{x.estado === "Ativo" ? "Ativo" : "Inativo"}</Estado> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        trilho={[{ rotulo: fin ? "Financiada" : "Gold", onClick: () => navigate(fin ? "fin-painel" : "gold-painel") }, { rotulo: "Formadores" }]}
        titulo={fin ? "Formadores da Financiada" : "Formadores Gold"}
        subtitulo={kpis ? `${num(kpis.ativos)} ativos · ${num(kpis.total)} neste regime` : "A carregar…"}
        acoes={gerir && <Botao onClick={() => setForm({ formador: null })}>Novo formador</Botao>}
      />
      <AvisoAcesso acesso={acesso} onFechar={() => setAcesso(null)} />

      <KpiFaixa className="xl:grid-cols-5">
        <Kpi rotulo="Ativos" valor={kpis?.ativos} onClick={() => setF({ estado: "Ativo", alerta: "" })} titulo="Ver só os ativos" />
        <Kpi rotulo="Com turma a decorrer" valor={kpis?.comTurma} onClick={() => setF({ alerta: "com_turma" })} />
        <Kpi rotulo="Documentos em falta" valor={kpis?.docsEmFalta} delta={kpis?.docsEmFalta ? { texto: "formadores com documentos obrigatórios por entregar", tom: "aviso" } : undefined} onClick={() => setF({ alerta: "docs" })} />
        <Kpi rotulo="CCP a expirar" valor={kpis?.ccpAExpirar} delta={kpis?.ccpAExpirar ? { texto: "expirados ou nos próximos 90 dias", tom: "perigo" } : undefined} onClick={() => setF({ alerta: "ccp" })} />
        <Kpi rotulo="Horas dadas" valor={kpis?.horasDadas} formato="horas" />
      </KpiFaixa>

      <Filtros
        pesquisa={{ valor: f.q, onMudar: q => setF({ q }), placeholder: "Pesquisar por nome, email, telemóvel ou CCP" }}
        selecoes={[
          { chave: "especialidade", rotulo: "Especialidade", opcoes: (lista.dados?.especialidades ?? []).map(e => ({ valor: e, rotulo: e })), valor: f.especialidade, onMudar: especialidade => setF({ especialidade }) },
          { chave: "disponibilidade", rotulo: "Disponibilidade", opcoes: SLOTS_CCP.map(s => ({ valor: s.id, rotulo: `${s.label} (${s.horas})` })), valor: f.disponibilidade, onMudar: disponibilidade => setF({ disponibilidade }) },
          { chave: "estado", rotulo: "Estado", opcoes: [{ valor: "Ativo", rotulo: "Ativos" }, { valor: "Inactivo", rotulo: "Inativos" }], valor: f.estado, onMudar: estado => setF({ estado }) },
          {
            chave: "alerta", rotulo: "Situação", valor: f.alerta, onMudar: alerta => setF({ alerta }),
            opcoes: [
              { valor: "com_turma", rotulo: "Com turma a decorrer" }, { valor: "sem_turma", rotulo: "Sem turma a decorrer" },
              { valor: "docs", rotulo: "Documentos em falta" }, { valor: "ccp", rotulo: "CCP a expirar" },
            ],
          },
        ]}
        ativos={filtrosAtivos}
        onLimpar={limpar}
      />

      <Cartao semPadding>
        {lista.erro && !lista.dados ? <ErroCarregar erro={lista.erro} onTentar={lista.recarregar} className="m-4" /> : (
          <Tabela
            rotulo={fin ? "Formadores da Financiada" : "Formadores Gold"}
            linhas={lista.dados?.linhas ?? []}
            colunas={colunas}
            chave={x => x.id}
            ordem={f.ordem}
            onOrdenar={ordem => setF({ ordem })}
            onLinha={abrir}
            aCarregar={lista.aCarregar && !lista.dados}
            acoesLinha={x => (
              <MenuLinha
                rotulo={`Mais ações para ${x.nome}`}
                acoes={[
                  { rotulo: "Abrir ficha", onClick: () => abrir(x) },
                  ...(gerir ? [
                    { rotulo: "Editar", onClick: () => setForm({ formador: x }) },
                    { rotulo: x.estado === "Ativo" ? "Desativar" : "Ativar", onClick: () => void ativar.correr(x).then(r => r && depoisDeGravar()) },
                    { rotulo: "Eliminar", perigo: true, onClick: () => setApagar(x) },
                  ] : []),
                ]}
              />
            )}
            vazio={filtrosAtivos
              ? <span>Nenhum formador com estes filtros. <Botao variante="ligacao" onClick={limpar}>Limpar filtros</Botao></span>
              : <span>Ainda não há formadores neste regime{gerir ? ". Crie o primeiro com «Novo formador»." : "."}</span>}
          />
        )}
        {lista.dados && lista.dados.total > POR_PAGINA && (
          <div className="border-t border-linha px-4 py-3">
            <Paginacao pagina={lista.dados.pagina} porPagina={lista.dados.porPagina} total={lista.dados.total} onMudar={p => setF({ pagina: String(p) })} />
          </div>
        )}
      </Cartao>

      <FormadorFormulario
        aberto={Boolean(form)}
        regime={regime}
        formador={form?.formador ?? null}
        especialidades={lista.dados?.especialidades ?? []}
        onFechar={() => setForm(null)}
        onGuardado={(_f, a) => {
          setForm(null);
          if (a?.password || (a && !form?.formador)) setAcesso(a);
          toastOk("Formador gravado.");
          depoisDeGravar();
        }}
      />
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo="Eliminar formador"
        descricao={apagar ? `${apagar.nome} sai da lista e dos menus de escolha. Se já deu sessões, desative-o em vez de o eliminar.` : ""}
        onConfirmar={async () => {
          if (!apagar) return;
          try {
            await apiApagarFormador(apagar.id);
            toastOk("Formador eliminado.");
            depoisDeGravar();
          } catch (e) {
            toastError(e, "Não foi possível eliminar o formador.");
          }
        }}
      />
    </div>
  );
}
