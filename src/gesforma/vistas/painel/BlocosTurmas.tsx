// Blocos de baixo dos painéis: próximas turmas, desagregação, métodos de pagamento e turmas a decorrer (Financiada).
import type { EixoPainel, Painel, RegimePainel, TurmaEmCurso } from "../../../partilhado/api/painel";
import {
  BarrasHorizontais, Cartao, Estado, Separadores, Tabela, cx, data, eur, formatar, num, type Coluna,
} from "../../../partilhado/ui";
import type { Navegar } from "../../shell/tipos";
import { rotuloCodigoCurso } from "../../../partilhado/codigoCurso";

function tomOcupacao(pct: number) {
  return pct >= 75 ? "#1F7A4D" : pct >= 40 ? "#9A5B00" : "#B42318";
}

/** `cronogramas`: o comercial não abre turmas; as próximas turmas levam aos Cronogramas (só leitura). */
export function CartaoProximas({ regime, turmas, navigate, cronogramas = false }: {
  regime: RegimePainel; turmas: Painel["proximasTurmas"]; navigate: Navegar; cronogramas?: boolean;
}) {
  const vista = regime === "fin" ? "fin-cockpit-turma" : "gold-cockpit-turma";
  const abrir = (id: number) => navigate(cronogramas ? "gold-cronogramas" : { view: vista, turmaId: id });
  return (
    <Cartao
      titulo="Próximas turmas"
      acoes={<button type="button" onClick={() => navigate(cronogramas ? "gold-cronogramas" : regime === "fin" ? "fin-turmas" : "gold-turmas")} className="text-[13px] font-semibold text-ligacao hover:underline">{cronogramas ? "Cronogramas" : "Turmas"}</button>}
    >
      {turmas.length === 0 && <p className="m-0 text-[13px] text-tinta-suave">Sem turmas marcadas a partir de hoje.</p>}
      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {turmas.map(t => {
          const ocupadas = t.ocupadas + t.reservas;
          const pct = t.capacidade ? Math.min(100, Math.round((ocupadas / t.capacidade) * 100)) : 0;
          return (
            <li key={t.id}>
              <button type="button" onClick={() => abrir(t.id)} className="num w-full text-left bg-transparent border-0 p-0 pb-2 border-b border-linha-suave rounded hover:bg-fundo">
                <span className="flex gap-2 text-[13px]">
                  <span className="font-semibold text-tinta truncate">{t.nome}</span>
                  <span className="ml-auto text-tinta-suave shrink-0">{data(t.inicio).slice(0, 5)}</span>
                </span>
                <span className="flex items-center gap-2.5 mt-1 text-xs text-tinta-suave">
                  <span className="relative flex-1 h-1.5 rounded bg-linha-suave" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${pct}%`, background: tomOcupacao(pct) }} />
                  </span>
                  <span title={t.reservas ? `${t.ocupadas} formandos e ${t.reservas} reservas` : undefined}>
                    {num(ocupadas)} / {num(t.capacidade)} vagas{t.reservas ? ` · ${num(t.reservas)} res.` : ""}
                  </span>
                </span>
                {t.docsCompletos != null && t.ocupadas > 0 && (
                  <span className="block mt-0.5 text-xs text-tinta-suave">Documentos completos: {num(t.docsCompletos)} / {num(t.ocupadas)}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}

type LinhaDesag = Painel["desagregacao"]["linhas"][number];

export function CartaoDesagregacao({ regime, desag, onEixo }: { regime: RegimePainel; desag: Painel["desagregacao"]; onEixo: (e: EixoPainel) => void }) {
  const fin = regime === "fin";
  const nomeEixo = { curso: fin ? "Curso / UFCD" : "Curso", local: "Local", horario: "Horário" }[desag.eixo];
  const colunas: Coluna<LinhaDesag>[] = [
    { id: "chave", titulo: nomeEixo, celula: l => <span className="font-semibold">{l.chave}</span>, principal: true },
    { id: "pre", titulo: "Pré-inscrições", celula: l => num(l.pre), alinhar: "dir" },
    { id: "formandos", titulo: fin ? "Validadas" : "Formandos", celula: l => num(l.formandos), alinhar: "dir" },
    { id: "conv", titulo: fin ? "Taxa" : "Conversão", celula: l => (l.pre ? formatar((l.formandos / l.pre) * 100, "pct") : "—"), alinhar: "dir" },
  ];
  if (!fin) colunas.push({ id: "receita", titulo: "Receita", celula: l => eur(l.receita), alinhar: "dir" });
  const eixos: { id: EixoPainel; rotulo: string }[] = fin
    ? [{ id: "curso", rotulo: "Curso" }, { id: "local", rotulo: "Local" }]
    : [{ id: "curso", rotulo: "Curso" }, { id: "local", rotulo: "Local" }, { id: "horario", rotulo: "Horário" }];
  return (
    <Cartao
      titulo="Desagregação"
      subtitulo="Pré-inscrições do período e o que deram."
      semPadding
      className="lg:col-span-2"
      acoes={<Separadores rotulo="Desagregar por" estilo="pilula" ativo={desag.eixo} onMudar={onEixo} itens={eixos} />}
    >
      <Tabela
        rotulo={`Desagregação por ${nomeEixo.toLowerCase()}`}
        linhas={desag.linhas}
        colunas={colunas}
        chave={l => l.chave}
        vazio="Sem dados no período."
      />
    </Cartao>
  );
}

export function CartaoMetodos({ metodos, porReceber, ticketMedio, navigate, pode }: {
  metodos: NonNullable<Painel["metodos"]>;
  porReceber: NonNullable<Painel["porReceber"]>;
  ticketMedio?: number;
  navigate: Navegar;
  pode: (c: string) => boolean;
}) {
  return (
    <Cartao
      titulo="Métodos de pagamento"
      acoes={pode("pagamentos.ver") ? <button type="button" onClick={() => navigate("pagamentos")} className="text-[13px] font-semibold text-ligacao hover:underline">Pagamentos</button> : undefined}
    >
      <BarrasHorizontais
        rotulo="Pagamentos confirmados por método"
        itens={metodos.map(m => ({ rotulo: m.metodo, valor: m.valor, detalhe: `${m.metodo}: ${m.n} pagamento${m.n === 1 ? "" : "s"}` }))}
        formato="eur"
        cor="#1F7A4D"
        larguraRotulo={110}
        vazio="Sem pagamentos confirmados no período."
      />
      <p className="num m-0 mt-3 text-xs text-tinta-suave">
        Pagamentos confirmados no período{ticketMedio ? ` · ticket médio ${eur(ticketMedio)}` : ""}.
        {" "}Por receber: <strong className="font-semibold text-tinta">{eur(porReceber.valor)}</strong> ({num(porReceber.n)}).
      </p>
    </Cartao>
  );
}

export function TabelaTurmasEmCurso({ turmas, minimo, navigate }: { turmas: TurmaEmCurso[]; minimo: number; navigate: Navegar }) {
  const colunas: Coluna<TurmaEmCurso>[] = [
    {
      id: "turma", titulo: "Turma", principal: true,
      celula: t => (
        <span className="flex flex-col">
          <span className="font-semibold">{t.ufcd ? `${rotuloCodigoCurso(t.ufcd)} · ` : ""}{t.nome}</span>
          <span className="text-xs text-tinta-suave">{t.local}</span>
        </span>
      ),
    },
    { id: "financiador", titulo: "Financiador", celula: t => t.financiador || "—", esconderMovel: true },
    { id: "formandos", titulo: "Formandos", celula: t => num(t.formandos), alinhar: "dir" },
    { id: "horas", titulo: "Horas dadas", celula: t => `${num(t.horasDadas)} / ${num(t.horasPrevistas)} h`, alinhar: "dir" },
    {
      id: "assid", titulo: "Assiduidade", alinhar: "dir",
      celula: t => (t.assiduidade == null ? "—" : <span className={t.assiduidade >= minimo ? "text-sucesso" : "text-aviso"}>{formatar(t.assiduidade, "pct")}</span>),
    },
    { id: "abaixo", titulo: `Abaixo de ${num(minimo)} %`, alinhar: "dir", celula: t => <span className={cx(t.abaixoMinimo ? "text-perigo font-semibold" : "text-tinta-suave")}>{num(t.abaixoMinimo)}</span> },
    { id: "docs", titulo: "Docs completos", alinhar: "dir", celula: t => `${num(t.docsCompletos)} / ${num(t.formandos)}` },
    {
      id: "dtp", titulo: "Dossiê TP", alinhar: "dir",
      celula: t => (
        <span className="inline-flex items-center gap-1.5 justify-end">
          <span className={t.dtpPct >= 70 ? "text-sucesso" : "text-perigo"}>{num(t.dtpPct)} %</span>
          {t.dtpBloqueantes > 0 ? <Estado tom="perigo">{t.dtpBloqueantes} bloq.</Estado> : <Estado tom="sucesso">ok</Estado>}
        </span>
      ),
    },
  ];
  return (
    <Cartao titulo="Turmas a decorrer · assiduidade, documentos e Dossiê TP" semPadding>
      <Tabela
        rotulo="Turmas a decorrer"
        linhas={turmas}
        colunas={colunas}
        chave={t => t.id}
        onLinha={t => navigate({ view: "fin-cockpit-turma", turmaId: t.id })}
        vazio="Nenhuma turma financiada a decorrer com estes filtros."
      />
    </Cartao>
  );
}
