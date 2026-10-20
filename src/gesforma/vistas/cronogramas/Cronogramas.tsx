// Cronogramas das turmas Gold para vender (perfil comercial): datas, vagas, preço e sessões. Só leitura:
// sem formandos, custos nem contactos de formadores. Quem gere turmas usa as Turmas.
import { useMemo, useState } from "react";
import { apiCronogramasGold, type CronogramaVenda, type SessaoCronogramaVenda } from "../../../partilhado/api/cronogramas";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import {
  Botao, BotaoLigacao, Cartao, ErroCarregar, Esqueleto, Estado, Filtros, PageHeader, Tabela, Vazio,
  data, eur, num, useFiltrosUrl, type Coluna, type OpcaoSelecao,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";

const MODALIDADE: Record<string, string> = {
  presencial: "Presencial",
  sincrona: "Síncrona",
  auto: "Auto-aprendizagem",
  avaliacao: "Avaliação",
  matricula: "Matrícula",
};

const FASES: OpcaoSelecao[] = [{ valor: "por_comecar", rotulo: "Por começar" }, { valor: "a_decorrer", rotulo: "A decorrer" }];

function opcoesDe(turmas: CronogramaVenda[], campo: "curso" | "local" | "horario"): OpcaoSelecao[] {
  return [...new Set(turmas.map(t => t[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt")).map(v => ({ valor: v, rotulo: v }));
}

function horas(s: SessaoCronogramaVenda) {
  if (s.horaInicio && s.horaFim) return `${s.horaInicio}–${s.horaFim}`;
  return s.horaInicio || s.horaFim || "—";
}

const COLUNAS_SESSOES: Coluna<SessaoCronogramaVenda & { n: number }>[] = [
  { id: "data", titulo: "Data", celula: s => <span className="num">{data(s.data)}</span> },
  { id: "horas", titulo: "Horas", celula: s => <span className="num">{horas(s)}</span> },
  { id: "modalidade", titulo: "Modalidade", celula: s => MODALIDADE[s.modalidade] ?? (s.modalidade || "—"), esconderMovel: true },
  { id: "modulos", titulo: "Módulo", principal: true, celula: s => s.modulos.join(", ") || "—" },
  { id: "formador", titulo: "Formador", celula: s => s.formadores.join(", ") || "—", esconderMovel: true },
];

function urlPublica(caminho: string) {
  return `${window.location.origin}${caminho}`;
}

async function copiarLigacao(caminho: string) {
  try {
    await navigator.clipboard.writeText(urlPublica(caminho));
    toastOk("Ligação pública do cronograma copiada.");
  } catch {
    toastError(new Error("Não foi possível copiar. Abra o cronograma e copie o endereço."));
  }
}

function CartaoTurma({ t, aberta, onAlternar }: { t: CronogramaVenda; aberta: boolean; onAlternar: () => void }) {
  const semVagas = t.vagasLivres <= 0;
  const anunciadas = t.vagasMostradas !== t.vagasLivres;
  return (
    <Cartao
      as="article"
      titulo={<span className="flex flex-wrap items-center gap-2">{t.curso || t.nome}<Estado tom={t.fase === "a_decorrer" ? "info" : "neutro"}>{t.fase === "a_decorrer" ? "A decorrer" : "Por começar"}</Estado></span>}
      subtitulo={[t.nome !== t.curso ? t.nome : "", t.local, t.horario].filter(Boolean).join(" · ")}
      acoes={(
        <span className="flex flex-wrap gap-2">
          {t.ligacaoPublica && <Botao tamanho="sm" variante="secundario" onClick={() => void copiarLigacao(t.ligacaoPublica!)}>Copiar ligação pública</Botao>}
          {t.ligacaoPublica && <BotaoLigacao tamanho="sm" href={t.ligacaoPublica} target="_blank" rel="noreferrer">Abrir</BotaoLigacao>}
        </span>
      )}
    >
      <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
        <div><dt className="text-xs text-tinta-suave">Início</dt><dd className="m-0 num">{data(t.dataInicio)}</dd></div>
        <div><dt className="text-xs text-tinta-suave">Fim</dt><dd className="m-0 num">{data(t.dataFim)}</dd></div>
        <div>
          <dt className="text-xs text-tinta-suave">Vagas livres</dt>
          <dd className="m-0 num">
            {semVagas ? <Estado tom="perigo">Sem vagas</Estado> : <span className="font-semibold text-tinta">{num(t.vagasLivres)}</span>}
            {anunciadas && !semVagas && <span className="block text-xs text-tinta-suave">O site mostra {num(t.vagasMostradas)}</span>}
          </dd>
        </div>
        <div><dt className="text-xs text-tinta-suave">Preço</dt><dd className="m-0 num">{t.preco != null ? eur(t.preco) : "—"}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
        <span className="text-tinta-suave">
          {t.sessoes.length ? `${num(t.sessoes.length)} sess${t.sessoes.length === 1 ? "ão" : "ões"} no cronograma` : "Ainda sem sessões no cronograma."}
          {t.publicadoEm ? ` · publicado a ${data(t.publicadoEm)}` : ""}
        </span>
        {t.sessoes.length > 0 && (
          <button type="button" onClick={onAlternar} aria-expanded={aberta} className="font-semibold text-ligacao hover:underline">
            {aberta ? "Esconder sessões" : "Ver sessões"}
          </button>
        )}
      </div>
      {aberta && t.sessoes.length > 0 && (
        <Tabela
          className="mt-3"
          rotulo={`Sessões de ${t.nome}`}
          linhas={t.sessoes.map((s, n) => ({ ...s, n }))}
          colunas={COLUNAS_SESSOES}
          chave={s => s.n}
          alturaMax="24rem"
        />
      )}
    </Cartao>
  );
}

export default function Cronogramas({ navigate }: VistaProps) {
  const [f, setF, limpar] = useFiltrosUrl({ q: "", curso: "", local: "", horario: "", fase: "", vagas: "" });
  const { dados, erro, aCarregar, recarregar } = useRecurso("cronogramas:gold", signal => apiCronogramasGold(signal));
  const [abertas, setAbertas] = useState<Set<number>>(new Set());
  const turmas = useMemo(() => dados?.turmas ?? [], [dados]);
  const q = f.q.trim().toLowerCase();
  const visiveis = turmas.filter(t =>
    (!f.curso || t.curso === f.curso) && (!f.local || t.local === f.local) && (!f.horario || t.horario === f.horario)
    && (!f.fase || t.fase === f.fase) && (!f.vagas || t.vagasLivres > 0)
    && (!q || `${t.curso} ${t.nome} ${t.local} ${t.horario}`.toLowerCase().includes(q)));
  const ativos = [f.q, f.curso, f.local, f.horario, f.fase, f.vagas].filter(Boolean).length;

  function alternar(id: number) {
    setAbertas(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: "Gold", onClick: () => navigate("gold-painel") }, { rotulo: "Cronogramas" }]}
        titulo="Cronogramas"
        subtitulo="Turmas Gold abertas e por começar: datas, vagas, preço e as sessões do cronograma. Só leitura; para vender, registe a pré-inscrição."
        acoes={<Botao variante="primario" onClick={() => navigate("gold-preinscricoes")}>Pré-inscrições</Botao>}
      />
      <Filtros
        pesquisa={{ valor: f.q, onMudar: v => setF({ q: v }), placeholder: "Curso, turma, local…" }}
        selecoes={[
          { chave: "curso", rotulo: "Curso", opcoes: opcoesDe(turmas, "curso"), valor: f.curso, onMudar: v => setF({ curso: v }), vazio: "Todos os cursos" },
          { chave: "local", rotulo: "Local", opcoes: opcoesDe(turmas, "local"), valor: f.local, onMudar: v => setF({ local: v }), vazio: "Todos os locais" },
          { chave: "horario", rotulo: "Horário", opcoes: opcoesDe(turmas, "horario"), valor: f.horario, onMudar: v => setF({ horario: v }), vazio: "Todos os horários" },
          { chave: "fase", rotulo: "Fase", opcoes: FASES, valor: f.fase, onMudar: v => setF({ fase: v }), vazio: "Por começar e a decorrer" },
          { chave: "vagas", rotulo: "Vagas", opcoes: [{ valor: "1", rotulo: "Só com vagas" }], valor: f.vagas, onMudar: v => setF({ vagas: v }), vazio: "Com e sem vagas" },
        ]}
        ativos={ativos}
        onLimpar={limpar}
      />

      {erro && !dados ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      {!dados && !erro ? <Esqueleto linhas={4} altura="h-32" /> : null}
      {dados && visiveis.length === 0 && (
        <Vazio
          titulo={turmas.length ? "Nenhuma turma com estes filtros." : "Sem turmas Gold abertas."}
          descricao={turmas.length ? undefined : "Quando a secretaria abrir turmas, os cronogramas aparecem aqui."}
        />
      )}
      {dados && visiveis.length > 0 && (
        <div className={aCarregar ? "flex flex-col gap-4 opacity-70" : "flex flex-col gap-4"} aria-busy={aCarregar}>
          {visiveis.map(t => <CartaoTurma key={t.turmaId} t={t} aberta={abertas.has(t.turmaId)} onAlternar={() => alternar(t.turmaId)} />)}
        </div>
      )}
    </div>
  );
}
