// Cockpit de uma turma da Financiada: cabeçalho com UFCD e fecho formal, próximos passos e separadores.
import { useEffect, useState } from "react";
import { data as fmtDataUi } from "../../../../partilhado/ui/formatos";
import { apiFolhasPresencaFin, apiPlanosSessaoFin, apiTurmaFinFecho } from "../../../../partilhado/api";
import { apiEnviarInqueritosTurma } from "../../../../partilhado/api/inqueritos";
import { useAuth } from "../../../../partilhado/AuthGate";
import { useNomesEu, useOpcoesFormador } from "../../../../partilhado/dados/comuns";
import { docsFinCompletos } from "../../../../partilhado/dossierDocs";
import { NextActions, type NextAction } from "../../../../partilhado/SecretaryUX";
import { podeMexerDocumento, staffPodeDossie } from "../../../../partilhado/sessaoAcesso";
import { persist, toastError, toastOk } from "../../../../partilhado/toastBus";
import { FileUploadModal, PresencasSessaoModal, PlanoSessaoModal, emptyPlano, estadoPlano, type SessaoMeta } from "../../../../partilhado/TurmaExtras";
import { cronogramaToSessoes, horasDoFormador, isTurmaActiva, lugaresLivres } from "../../../../partilhado/turmaModel";
import type { FormandoFin } from "../../../../partilhado/tiposFormando";
import { Botao, ConfirmarPerigo, Separadores as Pilulas, num } from "../../../../partilhado/ui";
import { CertificadoVerModal, ExportTurmaModal, type CertificadoPreview, type ExportTurmaInfo } from "../../../ActionSurfaces";
import { useProgramaDoCurso } from "../../../cursoPrograma";
import { DtpPanel } from "../../../DtpView";
import { DespesasTurma } from "./DespesasTurma";
import { I, TABS_FORMADOR, estadoBadge, tabDoFormador } from "./base";
import { CertificadosTurmaTab, DocumentosTurmaTab, SessoesTurmaTab, TurmaTabBar, exportPayload } from "./Separadores";
import { presencasDaSessao, useCriteriosAvaliacao, useTurmaPedagogia } from "../../../PedagogiaContext";
import { herdarPlanoCurso, usePlanosCurso } from "../../../planosCurso";
import type { Separador } from "../../../rotasGesforma";
import type { Navegar } from "../../../shell/tipos";
import { TurmaActivaToggle, TurmaInactivaBanner } from "../../../TurmaCronograma";
import { CronogramaEditor } from "../../../CronogramaEditor";
import { TurmaAvaliacao } from "../../../TurmaAvaliacaoGrelha";
import { EstadoCockpit, NovaSessaoPainel, ReabrirTurma } from "./comum";
import { recarregarTurma, useMembrosFin, useResultadosTurma, useTurmaCockpit } from "./dados";
import { EditarTurmaFin, InscreverFin, TransferirEEliminarFin } from "./FinDialogos";
import { FinVisaoGeral } from "./FinVisaoGeral";
import { CronogramaDias, horasDaSessao } from "./CronogramaDias";
import { ImportarPlanosCurso } from "./ImportarPlanos";
import { descarregarCronograma } from "../../../cronogramaExport";
import { sessoesSemFim } from "../../../../partilhado/cronogramaGrelha";
import { ProcessarApoios } from "../../formandos/apoios/ProcessarApoios";
import type { SessaoCronograma } from "../../../../partilhado/turmaModel";
import { FormadorProfileSlideOver } from "./PerfilFormador";
import { rotuloCodigoCurso } from "../../../../partilhado/codigoCurso";

type VistaCronograma = "dias" | "grelha" | "lista";

/** Ordem dos separadores da Financiada: o Cronograma (por dias) primeiro, como no GesForma antigo. */
const ORDEM_FIN: Separador[] = ["sessoes", "overview", "avaliacao", "subsidio", "documentos", "dtp", "certificados", "despesas"];
const ROTULOS_FIN: Partial<Record<Separador, string>> = { sessoes: "Cronograma", overview: "Inscritos", subsidio: "Subsídio" };

export function CockpitFin({ turmaId, initialTab = "sessoes", navigate }: { turmaId?: number; initialTab?: Separador; navigate: Navegar }) {
  const { turma, erro, aCarregar, patch, setCronograma, publicarCronograma, toggle } = useTurmaCockpit("fin", turmaId);
  const { membros } = useMembrosFin(turmaId);
  const { user } = useAuth();
  const souFormador = user.role === "formador";
  const nomesEu = useNomesEu();
  const opcoesFormador = useOpcoesFormador(undefined, "fin");
  // «cronograma» (a grelha de 45 minutos) é uma vista do separador Cronograma.
  const [vistaCrono, setVistaCrono] = useState<VistaCronograma>(initialTab === "cronograma" ? "grelha" : "dias");
  const separadorDe = (t: Separador): Separador => {
    const s = t === "cronograma" ? "sessoes" : t;
    return souFormador ? tabDoFormador(s) : s;
  };
  const [tab, setTabBase] = useState<Separador>(separadorDe(initialTab));
  const setTab = (t: Separador) => { if (t === "cronograma") setVistaCrono("grelha"); setTabBase(separadorDe(t)); };
  useEffect(() => { setTab(initialTab); }, [initialTab, turmaId, souFormador]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editarSessao, setEditarSessao] = useState<SessaoCronograma | null>(null);
  const [diaNovo, setDiaNovo] = useState("");
  const [apagarSessao, setApagarSessao] = useState<SessaoCronograma | null>(null);
  const ped = useTurmaPedagogia("fin", turma?.id ?? 0, turma?.cronograma);
  const criterios = useCriteriosAvaliacao("fin", turma?.curso);
  const programa = useProgramaDoCurso("fin", turma?.curso ?? "");
  const modelosCurso = usePlanosCurso("fin", turma?.curso ?? "");
  const [planoSessao, setPlanoSessao] = useState<SessaoMeta | null>(null);
  const [presencasSessao, setPresencasSessao] = useState<SessaoMeta | null>(null);
  const [uploadCert, setUploadCert] = useState<number | null>(null);
  const [uploadNota, setUploadNota] = useState<number | null>(null);
  const [verCert, setVerCert] = useState<CertificadoPreview | null>(null);
  const [exportar, setExportar] = useState<ExportTurmaInfo | null>(null);
  const [formadorAberto, setFormadorAberto] = useState<string | null>(null);
  const [novaSessao, setNovaSessao] = useState(false);
  const [inscrever, setInscrever] = useState(false);
  const [editar, setEditar] = useState(false);
  const [fechar, setFechar] = useState(false);
  const [transferir, setTransferir] = useState<FormandoFin | null>(null);
  const [eliminar, setEliminar] = useState<FormandoFin | null>(null);
  const [envioInq, setEnvioInq] = useState("");
  const { resultados } = useResultadosTurma("fin", souFormador ? undefined : turmaId);

  return (
    <EstadoCockpit aCarregar={aCarregar} erro={erro} existe={Boolean(turma)} onVoltar={() => navigate("fin-turmas")}>
      {() => {
        const t = turma!;
        const activa = isTurmaActiva(t);
        const livres = Math.max(0, lugaresLivres(t));
        const sessoes = cronogramaToSessoes(t.cronograma);
        const sumarios = ped.sumarios;
        const prontos = membros.filter(f => docsFinCompletos(f)).length;
        const nomesCockpit = membros.map(f => ({ id: f.id, nome: `${f.nome} ${f.apelido}` }));
        const podeDoc = (s: SessaoMeta, doc: "plano" | "sumario" | "presencas") => {
          const validado = doc === "plano" ? Boolean(ped.planos[s.n]?.assinado) : doc === "sumario" ? Boolean(sumarios[s.n]?.assinado) : Boolean(sumarios[s.n]?.presencasValidadas);
          return podeMexerDocumento({ role: user.role, nomes: nomesEu, sessao: s, validado });
        };
        const docsFalta = membros.length - prontos;
        const semPlano = sessoes.filter(s => !ped.planos[s.n]).length;
        const proximos: NextAction[] = [];
        const faltaFecho = resultados?.fecho?.falta ?? [];
        // Regra do servidor: o dossiê só bloqueia o fecho quando as regras pedagógicas o pedem, e aí qualquer item em falta conta.
        const dossieBloqueia = Boolean(resultados?.regras.dtpBloqueiaFecho);
        if (!souFormador && !t.fechadaEm && ped.dtp.pct < 100 && (dossieBloqueia || ped.dtp.pct < 70)) {
          proximos.push({
            tone: dossieBloqueia ? "error" : "warn", title: `Dossiê a ${ped.dtp.pct} %`,
            detail: dossieBloqueia ? "Cada item do dossiê em falta bloqueia o fecho da turma." : "Complete o dossiê técnico-pedagógico.",
            onClick: () => setTab("dtp"),
          });
        }
        if (!souFormador && docsFalta) proximos.push({ tone: "error", title: `${docsFalta} com documentos em falta`, detail: "Cartão, habilitações, CV, morada, IBAN, emprego, contrato ou RGPD.", onClick: () => setTab("overview") });
        if (semPlano) proximos.push({ tone: "warn", title: `${semPlano} sessões sem plano`, detail: "O formador ainda não carregou o plano de sessão.", onClick: () => setTab(separadorDe("sessoes")) });
        const porAprovar = sessoes.filter(s => estadoPlano(ped.planos[s.n]) === "submetido").length;
        const devolvidos = sessoes.filter(s => estadoPlano(ped.planos[s.n]) === "devolvido").length;
        if (!souFormador && porAprovar) proximos.unshift({ tone: "warn", title: `${porAprovar} plano(s) de sessão por aprovar`, detail: "Reveja, aprove ou devolva com comentários.", onClick: () => setTab(separadorDe("sessoes")) });
        if (souFormador && devolvidos) proximos.unshift({ tone: "error", title: `${devolvidos} plano(s) de sessão devolvido(s)`, detail: "A coordenação deixou comentários: corrija e volte a submeter.", onClick: () => setTab(separadorDe("sessoes")) });
        const sessoesTab = (
                <SessoesTurmaTab accent="fin" regime="fin" turmaId={t.id} onPlanosImportados={() => void ped.recarregar()} turmaNome={t.nome} cursoNome={t.curso} sessoes={sessoes} planos={ped.planos} presencas={ped.presencas}
                  sumarios={sumarios} formandos={nomesCockpit} onNovaSessao={() => setNovaSessao(true)} onPlano={setPlanoSessao}
                  semSumario onPresencas={setPresencasSessao} onOpenFormador={setFormadorAberto} podeEditar={podeDoc} podeCriar={!souFormador}
                  formadorOpcoes={souFormador ? undefined : opcoesFormador}
                  onFormador={souFormador ? undefined : (s, nome) => {
                    if (!s.id) return;
                    setCronograma(t.cronograma.map(x => x.id === s.id ? { ...x, formadores: nome ? [nome] : [] } : x));
                  }} />
        );
        const ocupacao = t.alunosTotal > 0 ? Math.min(100, (t.alunos / t.alunosTotal) * 100) : 0;
        // Indicadores do topo (como o «Gerir turma» antigo): volume = horas × presentes nas folhas.
        const porId = new Map(t.cronograma.map(c => [c.id, c]));
        const horasDe = (s: { id?: string }) => horasDaSessao(s.id ? porId.get(s.id) : undefined);
        const volumeRealizado = sessoes.reduce((soma, s) => soma + horasDe(s) * (ped.presencas[s.n]?.filter(p => p.presente).length ?? 0), 0);
        const volumeCandidatura = t.horas * t.alunosTotal;
        const diasUteis = new Set(sessoes.map(s => s.dataIso ?? "").filter(d => d && [1, 2, 3, 4, 5].includes(new Date(`${d}T12:00:00Z`).getUTCDay())));
        const diasUteisFeitos = [...diasUteis].filter(d => d < new Date().toISOString().slice(0, 10)).length;
        const avaliacaoPendente = resultados?.formandos.filter(f => f.nota == null && !/desist/i.test(f.estado)).length;
        const indicadores = [
          { rotulo: "Inscritos / Vagas", valor: <><span className="text-emerald-700">{t.alunos}</span><span className="text-tinta-suave">/{t.alunosTotal}</span></>, detalhe: `${prontos} com documentos prontos`, tab: "overview" as Separador },
          { rotulo: "Volume de formação", valor: <><span className="text-blue-900">{num(volumeRealizado)} h</span><span className="text-tinta-suave"> / {num(volumeCandidatura)} h</span></>, detalhe: `Realizado / em candidatura · expectável ${num(t.horas * t.alunos)} h`, tab: "sessoes" as Separador },
          { rotulo: "Subsídio de alimentação", valor: <span className="text-blue-900">{diasUteis.size} dias úteis</span>, detalhe: `${diasUteisFeitos} já realizados`, tab: "subsidio" as Separador },
          { rotulo: "Avaliação da aprendizagem", valor: <span className={avaliacaoPendente ? "text-red-800" : "text-emerald-700"}>{avaliacaoPendente == null ? "—" : avaliacaoPendente ? `${avaliacaoPendente} pendentes` : "Completa"}</span>, detalhe: "Formandos sem nota", tab: "avaliacao" as Separador },
        ];

        return (
          <>
            <div className="space-y-5">
              <section className="rounded-painel bg-nav p-5 text-white">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-ligacao text-white text-xs font-bold px-2.5 py-1 rounded-controlo">UFCD {t.ufcdCod || "—"}</span>
                      <span className="bg-white/10 text-white text-xs font-bold px-2.5 py-1 rounded-controlo font-mono">{t.nome}</span>
                      {estadoBadge(t.estado)}
                      {!souFormador && <TurmaActivaToggle compact light accent="fin" activa={activa} onChange={toggle} />}
                    </div>
                    <h1 className="m-0 mt-2 text-lg font-semibold">{t.curso}</h1>
                    <p className="m-0 mt-2 flex flex-wrap gap-4 text-slate-300 text-xs">
                      <span className="flex items-center gap-1">{I.location} {t.local}</span>
                      <span className="flex items-center gap-1">{I.calendar} {fmtDataUi(t.dataInicio)}</span>
                      <span className="flex items-center gap-1">{I.school} {t.formador || "Sem formador"} · {t.horas} h</span>
                    </p>
                  </div>
                  {!souFormador && (
                    <div className="flex gap-2 flex-wrap items-center">
                      <Botao tamanho="sm" variante="fantasma" className="text-white hover:text-tinta" onClick={() => {
                        setEnvioInq("A enviar…");
                        void apiEnviarInqueritosTurma("fin", t.id)
                          .then(r => { setEnvioInq(`${r.enviados} enviados${r.semEmail ? `, ${r.semEmail} sem email` : ""}`); void ped.recarregar(); })
                          .catch(err => setEnvioInq(err instanceof Error ? err.message : "Não foi possível enviar."));
                      }}>Enviar inquéritos</Botao>
                      <Botao tamanho="sm" variante="fantasma" className="text-white hover:text-tinta" title="Inquéritos de impacto, cerca de 3 meses depois do fim (só aos formandos)" onClick={() => {
                        setEnvioInq("A enviar…");
                        void apiEnviarInqueritosTurma("fin", t.id, "pos")
                          .then(r => { setEnvioInq(`Pós-formação: ${r.enviados} enviados${r.semEmail ? `, ${r.semEmail} sem email` : ""}`); void ped.recarregar(); })
                          .catch(err => setEnvioInq(err instanceof Error ? err.message : "Não foi possível enviar."));
                      }}>Enviar pós-formação</Botao>
                      <Botao tamanho="sm" variante="primario" onClick={() => setEditar(true)}>Editar turma</Botao>
                      {!t.fechadaEm && staffPodeDossie(user.role) && (
                        <Botao tamanho="sm" variante="secundario" disabled={!resultados || faltaFecho.length > 0}
                          title={faltaFecho.length ? `Falta: ${faltaFecho.slice(0, 5).join(" ")}${faltaFecho.length > 5 ? "…" : ""}` : "Gera o relatório de execução e marca a turma como concluída"}
                          onClick={() => setFechar(true)}>Fecho formal</Botao>
                      )}
                      {t.fechadaEm && <span className="text-xs font-semibold text-emerald-200 px-3 py-2 bg-white/10 rounded-controlo">Fechada {fmtDataUi(t.fechadaEm.slice(0, 10))}</span>}
                      {t.fechadaEm && <ReabrirTurma regime="fin" turmaId={t.id} onReaberta={() => recarregarTurma("fin", t.id)} />}
                      <Botao tamanho="sm" variante="fantasma" soIcone aria-label="Exportar turma" className="text-white hover:text-tinta" icone={I.download}
                        onClick={() => setExportar(exportPayload(
                          { nome: t.nome, curso: t.curso, local: t.local, formandos: t.alunos, accent: "fin", turmaId: t.id },
                          membros.map(f => ({ nome: `${f.nome} ${f.apelido}`, email: f.email, telf: f.telf, estado: f.estado })),
                          sessoes, ped,
                        ))} />
                      {envioInq && <p role="status" className="m-0 text-xs text-amber-200 max-w-[12rem]">{envioInq}</p>}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">{t.alunos} formandos{souFormador ? "" : ` · ${prontos} com documentos prontos`}</span>
                    <span className="text-blue-200">{livres} vagas restantes</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2" role="progressbar" aria-valuenow={Math.round(ocupacao)} aria-valuemin={0} aria-valuemax={100} aria-label="Ocupação da turma">
                    <div className="h-2 rounded-full bg-blue-300" style={{ width: `${ocupacao}%` }} />
                  </div>
                </div>
              </section>

              <NextActions accent="fin" actions={proximos.slice(0, 3)} />
              {!souFormador && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {indicadores.map(k => (
                    <button key={k.rotulo} type="button" onClick={() => setTab(k.tab)}
                      className="rounded-painel border border-linha bg-superficie px-4 py-3 text-left hover:border-linha-forte">
                      <p className="m-0 text-[13px] text-tinta-suave">{k.rotulo}</p>
                      <p className="num m-0 mt-1 text-2xl font-semibold">{k.valor}</p>
                      <p className="m-0 mt-0.5 text-xs text-tinta-suave">{k.detalhe}</p>
                    </button>
                  ))}
                </div>
              )}
              <TurmaTabBar tab={tab} onChange={setTab} accent="fin" dtpPct={ped.dtp.pct} dossie={staffPodeDossie(user.role)} despesas={!souFormador}
                ordem={ORDEM_FIN} rotulos={ROTULOS_FIN} so={souFormador ? TABS_FORMADOR : undefined} />
              {!activa && <TurmaInactivaBanner nome={t.nome} onActivate={() => toggle(true)} />}

              {tab === "sessoes" && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Pilulas<VistaCronograma> estilo="pilula" rotulo="Vista do cronograma" ativo={souFormador && vistaCrono === "grelha" ? "dias" : vistaCrono} onMudar={setVistaCrono}
                    itens={[{ id: "dias", rotulo: "Por dias" }, ...(souFormador ? [] : [{ id: "grelha" as const, rotulo: "Grelha de 45 min" }]), { id: "lista", rotulo: "Lista de sessões" }]} />
                  {!souFormador && vistaCrono === "dias" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <ImportarPlanosCurso regime="fin" turmaId={t.id} onImportados={() => void ped.recarregar()} />
                      <Botao tamanho="sm" variante="secundario" disabled={!t.cronograma.length}
                        onClick={() => descarregarCronograma({ curso: t.curso, local: t.local, horario: t.horario, inicio: t.dataInicio, formador: t.formador, nome: t.nome, sessoes: sessoesSemFim(t.cronograma) })}>Descarregar</Botao>
                      <Botao tamanho="sm" variante="secundario" onClick={() => setVistaCrono("grelha")}>Regenerar grelha</Botao>
                      <Botao tamanho="sm" variante="primario" onClick={() => { setDiaNovo(""); setNovaSessao(true); }}>+ Sessão</Botao>
                    </div>
                  )}
                </div>
              )}
              {tab === "sessoes" && vistaCrono === "dias" && (() => {
                // Como no GesForma antigo: o que falta preencher e as datas da acção por cima dos dias.
                const hoje = new Date().toISOString().slice(0, 10);
                const folhasFalta = sessoes.filter(s => (s.dataIso ?? "") <= hoje && !ped.presencas[s.n]).length;
                const datas = sessoes.map(s => s.dataIso ?? "").filter(Boolean).sort();
                return (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-painel border border-linha bg-superficie px-4 py-2.5 text-[13px]">
                    <span className="text-tinta-suave">Faltam preencher:</span>
                    <span className={folhasFalta ? "font-semibold text-amber-700" : "text-emerald-700"}>{folhasFalta ? `⚠ ${folhasFalta} ${folhasFalta === 1 ? "folha de presenças" : "folhas de presenças"}` : "Folhas em dia"}</span>
                    <span className={semPlano ? "font-semibold text-red-700" : "text-emerald-700"}>{semPlano ? `${semPlano} ${semPlano === 1 ? "plano de sessão" : "planos de sessão"}` : "Planos em dia"}</span>
                    <span className="text-tinta-suave">Início <span className="num text-tinta">{fmtDataUi(datas[0] || t.dataInicio)}</span>{datas.length ? <> · fim <span className="num text-tinta">{fmtDataUi(datas[datas.length - 1]!)}</span></> : null} · {t.local || "Local por definir"}</span>
                  </div>
                );
              })()}
              {tab === "sessoes" && (vistaCrono === "dias" || (souFormador && vistaCrono === "grelha")) && (
                <CronogramaDias sessoes={sessoes} cronograma={t.cronograma} inicio={t.dataInicio} planos={ped.planos} presencas={ped.presencas} sumarios={sumarios}
                  inscritos={membros.length} podeCriar={!souFormador} podeEditarSessao={!souFormador}
                  onNova={dia => { setDiaNovo(dia); setNovaSessao(true); }} onEditar={setEditarSessao} onEliminar={setApagarSessao}
                  onPresencas={setPresencasSessao} onPlano={setPlanoSessao} />
              )}
              {tab === "sessoes" && vistaCrono === "grelha" && !souFormador && (
                <CronogramaEditor layout="page" accent="fin" turmaId={t.id} identidade={`fin-${t.id}`} nome={t.nome} sessoes={t.cronograma}
                  onChange={setCronograma} publicar={publicarCronograma} inicio={t.dataInicio} horario={t.horario} horas={t.horas} formador={t.formador} curso={t.curso} local={t.local} />
              )}
              {tab === "dtp" && staffPodeDossie(user.role) && (
                <DtpPanel regime="fin" turma={{ codigo: t.nome, id: t.id, titulo: t.curso, sub: `${rotuloCodigoCurso(t.ufcdCod)} · ${t.horas} h` }} dtp={ped.dtp} estado={ped.estado}
                  onToggle={(item, proximo) => void ped.guardarDtp(item.id, proximo)} onAnexo={(item, file) => void ped.guardarDtpAnexo(item.id, file)}
                  onActualizar={() => void ped.recarregar()} />
              )}
              {tab === "sessoes" && vistaCrono === "lista" && sessoesTab}
              {tab === "subsidio" && !souFormador && (
                <ProcessarApoios embutido turma={{ id: t.id, nome: t.nome }} aberto onFechar={() => undefined} />
              )}
              {tab === "avaliacao" && (
                <TurmaAvaliacao key={t.id} regime="fin" turmaId={t.id} cursoNome={t.curso} turmaNome={t.nome} accent="fin" formandos={nomesCockpit} soLeitura={souFormador} />
              )}
              {tab === "documentos" && !souFormador && (
                <DocumentosTurmaTab regime="fin" curso={t.curso} criterios={criterios} guardados={ped.documentos} onSaveDoc={doc => void ped.guardarDocumento(doc)}
                  dtpItems={ped.dtp.items} onSaveDtp={(id, estado) => void ped.guardarDtp(id, estado)}
                  finCtx={{ formandos: membros, facts: ped.dtp.facts, cronograma: t.cronograma, curso: t.curso, ufcdCod: t.ufcdCod, horas: t.horas, dtpPct: ped.dtp.pct, programa: t.programaDocumentos }} />
              )}
              {tab === "certificados" && !souFormador && (
                <CertificadosTurmaTab formandos={nomesCockpit} certificados={ped.certificados}
                  onUpload={(id, nota) => { setUploadNota(nota ?? null); setUploadCert(id); }} onView={setVerCert} onNota={(id, p) => ped.guardarCertificado(id, p)}
                  curso={t.curso} turma={t.nome} regime="fin" turmaId={t.id} />
              )}
              {tab === "despesas" && !souFormador && (
                <DespesasTurma turmaId={t.id} onFicha={id => navigate({ view: "fin-formando-ficha", formandoId: id, filtros: { aba: "financiamento" } })} />
              )}
              {tab === "overview" && (
                <FinVisaoGeral turma={t} membros={membros} prontos={prontos} souFormador={souFormador} activa={activa} programa={programa.labels}
                  onFicha={souFormador ? undefined : f => navigate({ view: "fin-formando-ficha", formandoId: f.id })}
                  onTransferir={setTransferir} onEliminar={setEliminar} onAdicionar={() => setInscrever(true)}
                  onEditarPrograma={() => navigate("fin-cursos")} onFormadores={nomes => patch({ formadores: nomes })} onFormador={setFormadorAberto}
                  verCustos={!souFormador} onValoresHora={valores => patch({ valoresHoraFormador: valores })} />
              )}
            </div>

            <PlanoSessaoModal open={!!planoSessao} onClose={() => setPlanoSessao(null)} sessao={planoSessao ?? undefined}
              plano={planoSessao ? herdarPlanoCurso(modelosCurso.planos, planoSessao.n, ped.plano(planoSessao.n)) : emptyPlano()}
              soLeitura={souFormador && planoSessao && ped.planosDoCurso.includes(planoSessao.n) ? "Plano definido na ficha do curso"
                : planoSessao && !podeDoc(planoSessao, "plano") ? (ped.planos[planoSessao.n]?.assinado ? "Aprovado: só a coordenação o altera" : "Só consulta") : undefined}
              coordenacao={staffPodeDossie(user.role)}
              qualificada={{ turmaId: t.id }}
              onSave={data => { if (planoSessao) void ped.guardarPlano(planoSessao.n, data, planoSessao.id); }}
              onPdf={planoSessao ? () => { apiPlanosSessaoFin(t.id, planoSessao.n).catch(err => toastError(err, "Não foi possível gerar o plano de sessão.")); } : undefined} />
            <PresencasSessaoModal open={!!presencasSessao} onClose={() => setPresencasSessao(null)} sessao={presencasSessao ?? undefined} turmaNome={t.nome} cursoNome={t.curso}
              formandos={presencasSessao ? presencasDaSessao(nomesCockpit, ped.presencas[presencasSessao.n]) : []}
              folha={presencasSessao ? ped.folhas[presencasSessao.n] : null}
              validada={presencasSessao ? Boolean(sumarios[presencasSessao.n]?.presencasValidadas) : false}
              soLeitura={presencasSessao && !podeDoc(presencasSessao, "presencas")
                ? (sumarios[presencasSessao.n]?.presencasValidadas ? "Folha validada pela coordenação pedagógica: só a coordenação a altera." : "Só consulta: não está atribuído a esta sessão.")
                : undefined}
              podeValidar={staffPodeDossie(user.role)}
              onSave={(rows, folha) => { if (presencasSessao) void ped.guardarPresencas(presencasSessao.n, rows, presencasSessao.id, folha); }}
              qualificada={presencasSessao ? { turmaId: t.id, sessaoId: presencasSessao.id } : undefined}
              onAssinar={souFormador ? (rows, folha) => { if (presencasSessao) void ped.guardarPresencas(presencasSessao.n, rows, presencasSessao.id, folha, true); } : undefined}
              onValidar={(validar, rows, folha) => { if (presencasSessao) void ped.validarPresencas(presencasSessao.n, validar, rows, folha, presencasSessao.id); }}
              onImprimir={presencasSessao ? () => { apiFolhasPresencaFin(t.id, presencasSessao.n).catch(err => toastError(err, "Não foi possível gerar a folha de presenças.")); } : undefined} />
            <FileUploadModal open={uploadCert !== null} onClose={() => setUploadCert(null)} title="Carregar certificado" accent="fin"
              context={{ kind: "certificado", regime: "fin", turma: t.nome, formando: uploadCert != null ? String(uploadCert) : undefined, label: "Certificado" }}
              onConfirm={file => { if (uploadCert != null) void ped.guardarCertificado(uploadCert, { emitido: true, ficheiroId: file.id, ficheiroNome: file.name, ficheiroUrl: file.openUrl, ...(uploadNota != null ? { nota: uploadNota } : {}) }); }} />
            <CertificadoVerModal open={!!verCert} onClose={() => setVerCert(null)} cert={verCert} accent="fin" />
            <ExportTurmaModal open={!!exportar} onClose={() => setExportar(null)} turma={exportar} />
            <FormadorProfileSlideOver open={!!formadorAberto} onClose={() => setFormadorAberto(null)} nome={formadorAberto ?? t.formador} accent="fin" turma={t.nome}
              horas={formadorAberto ? horasDoFormador(t.cronograma, formadorAberto) : undefined} />
            <NovaSessaoPainel key={`sessao-${novaSessao}-${diaNovo}`} aberto={novaSessao} onFechar={() => setNovaSessao(false)} regime="fin" turma={t} horaPadrao="19:00" duracao={3}
              dataInicial={diaNovo} onCriar={s => { setCronograma([...t.cronograma, s]); setNovaSessao(false); }} />
            <NovaSessaoPainel key={`editar-${editarSessao?.id ?? ""}`} aberto={Boolean(editarSessao)} onFechar={() => setEditarSessao(null)} regime="fin" turma={t} horaPadrao="19:00" duracao={3}
              sessao={editarSessao}
              onCriar={s => { setCronograma(t.cronograma.map(x => x.id === s.id ? s : x)); setEditarSessao(null); }}
              onEliminar={() => { setApagarSessao(editarSessao); setEditarSessao(null); }} />
            <ConfirmarPerigo aberto={Boolean(apagarSessao)} onFechar={() => setApagarSessao(null)} titulo="Eliminar sessão" acao="Eliminar sessão"
              descricao={apagarSessao ? `A sessão de ${fmtDataUi(apagarSessao.data)} sai do cronograma.` : ""}
              onConfirmar={async () => { if (apagarSessao) setCronograma(t.cronograma.filter(x => x.id !== apagarSessao.id)); setApagarSessao(null); }} />
            <InscreverFin aberto={inscrever} onFechar={() => setInscrever(false)} turma={t} activa={activa} membros={membros} onActivar={() => toggle(true)} />
            <EditarTurmaFin aberto={editar} onFechar={() => setEditar(false)} turma={t} onGravar={patch} />
            <TransferirEEliminarFin turma={t} transferir={transferir} eliminar={eliminar} onFechar={() => { setTransferir(null); setEliminar(null); }} />
            <ConfirmarPerigo
              aberto={fechar}
              onFechar={() => setFechar(false)}
              titulo="Fecho formal da turma"
              acao="Fechar turma"
              descricao="O estado passa a Concluída e o relatório de execução fica no dossiê. Depois disso a turma só reabre com a administração."
              onConfirmar={async () => {
                const r = await persist(apiTurmaFinFecho(t.id));
                if (!r) return;
                recarregarTurma("fin", t.id);
                if (r.aviso) toastError(new Error(r.aviso));
                else toastOk("Turma fechada. O relatório de execução foi anexado ao dossiê.");
              }}
            />
          </>
        );
      }}
    </EstadoCockpit>
  );
}
