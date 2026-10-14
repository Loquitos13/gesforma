// Cockpit de uma turma da Financiada: cabeçalho com UFCD e fecho formal, próximos passos e separadores.
import { useEffect, useState } from "react";
import { apiTurmaFinFecho, emitAutomation } from "../../../../partilhado/api";
import { apiEnviarInqueritosTurma } from "../../../../partilhado/api/inqueritos";
import { useAuth } from "../../../../partilhado/AuthGate";
import { useNomesEu, useOpcoesFormador } from "../../../../partilhado/dados/comuns";
import { docsFinCompletos } from "../../../../partilhado/dossierDocs";
import { NextActions, type NextAction } from "../../../../partilhado/SecretaryUX";
import { podeMexerDocumento, staffPodeDossie } from "../../../../partilhado/sessaoAcesso";
import { persist, toastOk } from "../../../../partilhado/toastBus";
import { FileUploadModal, PresencasSessaoModal, PlanoSessaoModal, SumarioSessaoModal, emptyPlano, emptySumario, type SessaoMeta } from "../../../../partilhado/TurmaExtras";
import { cronogramaToSessoes, horasDoFormador, isTurmaActiva, lugaresLivres } from "../../../../partilhado/turmaModel";
import type { FormandoFin } from "../../../../partilhado/tiposFormando";
import { Botao, ConfirmarPerigo } from "../../../../partilhado/ui";
import { CertificadoVerModal, ExportTurmaModal, type CertificadoPreview, type ExportTurmaInfo } from "../../../ActionSurfaces";
import { useProgramaDoCurso } from "../../../cursoPrograma";
import { DtpPanel } from "../../../DtpView";
import { I, TABS_FORMADOR, estadoBadge, tabDoFormador } from "./base";
import { CertificadosTurmaTab, DocumentosTurmaTab, SessoesTurmaTab, TurmaTabBar, exportPayload } from "./Separadores";
import { presencasDaSessao, useCriteriosAvaliacao, useTurmaPedagogia } from "../../../PedagogiaContext";
import { herdarPlanoCurso, usePlanosCurso } from "../../../planosCurso";
import type { Separador } from "../../../rotasGesforma";
import type { Navegar } from "../../../shell/tipos";
import { TurmaActivaToggle, TurmaInactivaBanner } from "../../../TurmaCronograma";
import { CronogramaEditor } from "../../../CronogramaEditor";
import { TurmaAvaliacao } from "../../../TurmaAvaliacaoGrelha";
import { EstadoCockpit, NovaSessaoPainel } from "./comum";
import { recarregarTurma, useMembrosFin, useTurmaCockpit } from "./dados";
import { EditarTurmaFin, InscreverFin, TransferirEEliminarFin } from "./FinDialogos";
import { FinVisaoGeral } from "./FinVisaoGeral";
import { FormadorProfileSlideOver } from "./PerfilFormador";

export function CockpitFin({ turmaId, initialTab = "overview", navigate }: { turmaId?: number; initialTab?: Separador; navigate: Navegar }) {
  const { turma, erro, aCarregar, patch, setCronograma, toggle } = useTurmaCockpit("fin", turmaId);
  const { membros } = useMembrosFin(turmaId);
  const { user } = useAuth();
  const souFormador = user.role === "formador";
  const nomesEu = useNomesEu();
  const opcoesFormador = useOpcoesFormador(undefined, "fin");
  const [tab, setTab] = useState<Separador>(initialTab);
  useEffect(() => { setTab(souFormador ? tabDoFormador(initialTab) : initialTab); }, [initialTab, turmaId, souFormador]);
  const ped = useTurmaPedagogia("fin", turma?.id ?? 0);
  const criterios = useCriteriosAvaliacao("fin", turma?.curso);
  const programa = useProgramaDoCurso("fin", turma?.curso ?? "");
  const modelosCurso = usePlanosCurso("fin", turma?.curso ?? "");
  const [planoSessao, setPlanoSessao] = useState<SessaoMeta | null>(null);
  const [sumarioSessao, setSumarioSessao] = useState<SessaoMeta | null>(null);
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
        if (!souFormador && ped.dtp.pct < 70) proximos.push({ tone: "error", title: `Dossiê a ${ped.dtp.pct} %`, detail: "Sem dossiê a turma financiada não arranca.", onClick: () => setTab("dtp") });
        if (!souFormador && docsFalta) proximos.push({ tone: "error", title: `${docsFalta} com documentos em falta`, detail: "Cartão, habilitações, CV, morada, IBAN, emprego, contrato ou RGPD.", onClick: () => setTab("overview") });
        if (semPlano) proximos.push({ tone: "warn", title: `${semPlano} sessões sem plano`, detail: "O formador ainda não carregou o plano de sessão.", onClick: () => setTab("sessoes") });
        const ocupacao = t.alunosTotal > 0 ? Math.min(100, (t.alunos / t.alunosTotal) * 100) : 0;

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
                      <span className="flex items-center gap-1">{I.calendar} {t.dataInicio}</span>
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
                      <Botao tamanho="sm" variante="primario" onClick={() => setEditar(true)}>Editar turma</Botao>
                      {!t.fechadaEm && staffPodeDossie(user.role) && (
                        <Botao tamanho="sm" variante="secundario" disabled={ped.dtp.pct < 70}
                          title={ped.dtp.pct < 70 ? "Complete o dossiê (pelo menos 70 %) antes do fecho formal." : "Gera o relatório de execução e marca a turma como concluída"}
                          onClick={() => setFechar(true)}>Fecho formal</Botao>
                      )}
                      {t.fechadaEm && <span className="text-xs font-semibold text-emerald-200 px-3 py-2 bg-white/10 rounded-controlo">Fechada {t.fechadaEm}</span>}
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
              <TurmaTabBar tab={tab} onChange={setTab} accent="fin" dtpPct={ped.dtp.pct} dossie={staffPodeDossie(user.role)} so={souFormador ? TABS_FORMADOR : undefined} />
              {!activa && <TurmaInactivaBanner nome={t.nome} onActivate={() => toggle(true)} />}

              {tab === "cronograma" && !souFormador && (
                <CronogramaEditor layout="page" accent="fin" turmaId={t.id} identidade={`fin-${t.id}`} nome={t.nome} sessoes={t.cronograma}
                  onChange={setCronograma} inicio={t.dataInicio} horario={t.horario} horas={t.horas} formador={t.formador} curso={t.curso} local={t.local} />
              )}
              {tab === "dtp" && staffPodeDossie(user.role) && (
                <DtpPanel regime="fin" turma={{ codigo: t.nome, id: t.id, titulo: t.curso, sub: `UFCD ${t.ufcdCod} · ${t.horas} h` }} dtp={ped.dtp} estado={ped.estado}
                  onToggle={(item, proximo) => void ped.guardarDtp(item.id, proximo)} onAnexo={(item, file) => void ped.guardarDtpAnexo(item.id, file)}
                  onActualizar={() => void ped.recarregar()} />
              )}
              {tab === "sessoes" && (
                <SessoesTurmaTab accent="fin" turmaNome={t.nome} cursoNome={t.curso} sessoes={sessoes} planos={ped.planos} presencas={ped.presencas}
                  sumarios={sumarios} formandos={nomesCockpit} onNovaSessao={() => setNovaSessao(true)} onPlano={setPlanoSessao}
                  onSumario={setSumarioSessao} onPresencas={setPresencasSessao} onOpenFormador={setFormadorAberto} podeEditar={podeDoc} podeCriar={!souFormador}
                  formadorOpcoes={souFormador ? undefined : opcoesFormador}
                  onFormador={souFormador ? undefined : (s, nome) => {
                    if (!s.id) return;
                    setCronograma(t.cronograma.map(x => x.id === s.id ? { ...x, formadores: nome ? [nome] : [] } : x));
                  }} />
              )}
              {tab === "avaliacao" && (
                <TurmaAvaliacao key={t.id} regime="fin" turmaId={t.id} cursoNome={t.curso} turmaNome={t.nome} accent="fin" formandos={nomesCockpit} />
              )}
              {tab === "documentos" && !souFormador && (
                <DocumentosTurmaTab regime="fin" curso={t.curso} criterios={criterios} guardados={ped.documentos} onSaveDoc={doc => void ped.guardarDocumento(doc)}
                  finCtx={{ formandos: membros, facts: ped.dtp.facts, cronograma: t.cronograma, curso: t.curso, ufcdCod: t.ufcdCod, horas: t.horas, dtpPct: ped.dtp.pct }} />
              )}
              {tab === "certificados" && !souFormador && (
                <CertificadosTurmaTab formandos={nomesCockpit} certificados={ped.certificados} presencas={ped.presencas} sessoesRegistadas={ped.dtp.facts.presencas.done}
                  onUpload={(id, nota) => { setUploadNota(nota ?? null); setUploadCert(id); }} onView={setVerCert} onNota={(id, p) => void ped.guardarCertificado(id, p)}
                  curso={t.curso} turma={t.nome} regime="fin" turmaId={t.id} />
              )}
              {tab === "overview" && (
                <FinVisaoGeral turma={t} membros={membros} prontos={prontos} souFormador={souFormador} activa={activa} programa={programa.labels}
                  onFicha={souFormador ? undefined : f => navigate({ view: "fin-formando-ficha", formandoId: f.id })}
                  onTransferir={setTransferir} onEliminar={setEliminar} onAdicionar={() => setInscrever(true)}
                  onEditarPrograma={() => navigate("fin-cursos")} onFormadores={nomes => patch({ formadores: nomes })} onFormador={setFormadorAberto} />
              )}
            </div>

            <PlanoSessaoModal open={!!planoSessao} onClose={() => setPlanoSessao(null)} sessao={planoSessao ?? undefined}
              plano={planoSessao ? herdarPlanoCurso(modelosCurso.planos, planoSessao.n, ped.plano(planoSessao.n)) : emptyPlano()}
              onSave={data => { if (planoSessao) void ped.guardarPlano(planoSessao.n, data); }} />
            <SumarioSessaoModal open={!!sumarioSessao} onClose={() => setSumarioSessao(null)} accent="fin" sessao={sumarioSessao ?? undefined}
              sumario={sumarioSessao ? ped.sumario(sumarioSessao.n) : emptySumario()}
              onSave={data => {
                if (!sumarioSessao) return;
                void ped.guardarSumario(sumarioSessao.n, data);
                if (data.assinado) {
                  void emitAutomation("sessao.summary_signed", { email: user.email, nome: t.formador || user.name, curso: t.curso, turma: t.nome }, `sumario:fin:${t.id}:${sumarioSessao.n}`);
                }
              }} />
            <PresencasSessaoModal open={!!presencasSessao} onClose={() => setPresencasSessao(null)} sessao={presencasSessao ?? undefined} turmaNome={t.nome} cursoNome={t.curso}
              formandos={presencasSessao ? presencasDaSessao(nomesCockpit, ped.presencas[presencasSessao.n]) : nomesCockpit}
              onSave={rows => { if (presencasSessao) void ped.guardarPresencas(presencasSessao.n, rows); }} />
            <FileUploadModal open={uploadCert !== null} onClose={() => setUploadCert(null)} title="Carregar certificado" accent="fin"
              context={{ kind: "certificado", regime: "fin", turma: t.nome, formando: uploadCert != null ? String(uploadCert) : undefined, label: "Certificado" }}
              onConfirm={file => { if (uploadCert != null) void ped.guardarCertificado(uploadCert, { emitido: true, ficheiroId: file.id, ficheiroNome: file.name, ficheiroUrl: file.openUrl, ...(uploadNota != null ? { nota: uploadNota } : {}) }); }} />
            <CertificadoVerModal open={!!verCert} onClose={() => setVerCert(null)} cert={verCert} accent="fin" />
            <ExportTurmaModal open={!!exportar} onClose={() => setExportar(null)} turma={exportar} />
            <FormadorProfileSlideOver open={!!formadorAberto} onClose={() => setFormadorAberto(null)} nome={formadorAberto ?? t.formador} accent="fin" turma={t.nome}
              horas={formadorAberto ? horasDoFormador(t.cronograma, formadorAberto) : undefined} />
            <NovaSessaoPainel key={`sessao-${novaSessao}`} aberto={novaSessao} onFechar={() => setNovaSessao(false)} regime="fin" turma={t} horaPadrao="19:00" duracao={3}
              onCriar={s => { setCronograma([...t.cronograma, s]); setNovaSessao(false); }} />
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
                toastOk("Turma fechada. O relatório de execução foi anexado ao dossiê.");
              }}
            />
          </>
        );
      }}
    </EstadoCockpit>
  );
}
