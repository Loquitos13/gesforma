// Cockpit de uma turma Gold: cabeçalho, próximos passos e separadores (cronograma, sessões, avaliação,
// documentos, dossiê, certificados e visão geral). Dados em ./dados.ts.
import { useEffect, useState } from "react";
import { apiEnviarInqueritosTurma } from "../../../../partilhado/api/inqueritos";
import { apiTurmaGoldFecho, emitAutomation } from "../../../../partilhado/api";
import { useAuth } from "../../../../partilhado/AuthGate";
import { useNomesEu, useOpcoesFormador } from "../../../../partilhado/dados/comuns";
import { NextActions, type NextAction } from "../../../../partilhado/SecretaryUX";
import { podeMexerDocumento, staffPodeDossie } from "../../../../partilhado/sessaoAcesso";
import { FileUploadModal, PresencasSessaoModal, PlanoSessaoModal, SumarioSessaoModal, emptyPlano, emptySumario, sumarioPreenchido, type SessaoMeta } from "../../../../partilhado/TurmaExtras";
import { cronogramaToSessoes, horasDoFormador, isTurmaActiva, lugaresLivres } from "../../../../partilhado/turmaModel";
import type { FormandoTurma } from "../../../../partilhado/tiposFormando";
import { persist, toastOk } from "../../../../partilhado/toastBus";
import { Botao, ConfirmarPerigo } from "../../../../partilhado/ui";
import { CertificadoVerModal, ExportTurmaModal, type CertificadoPreview, type ExportTurmaInfo } from "../../../ActionSurfaces";
import { useProgramaDoCurso } from "../../../cursoPrograma";
import { DtpPanel } from "../../../DtpView";
import { I, TABS_FORMADOR, estadoBadge, tabDoFormador } from "./base";
import { CertificadosTurmaTab, DocumentosTurmaTab, SessoesTurmaTab, TurmaTabBar, exportPayload } from "./Separadores";
import { presencasDaSessao, useCriteriosAvaliacao, useTurmaPedagogia } from "../../../PedagogiaContext";
import { herdarPlanoCurso, herdarSumarioCurso, usePlanosCurso } from "../../../planosCurso";
import type { Separador } from "../../../rotasGesforma";
import { TurmaActivaToggle, TurmaInactivaBanner } from "../../../TurmaCronograma";
import { CronogramaEditor } from "../../../CronogramaEditor";
import { TurmaAvaliacao } from "../../../TurmaAvaliacaoGrelha";
import type { Navegar } from "../../../shell/tipos";
import { labelsSessoesFin } from "../../../../partilhado/finDossierUi";
import { EstadoCockpit, NovaSessaoPainel, ReabrirTurma } from "./comum";
import { recarregarTurma, useMembrosGold, useResultadosTurma, useTurmaCockpit } from "./dados";
import { EditarTurmaGold, InscreverGold, TransferirEEliminarGold } from "./GoldDialogos";
import { GoldVisaoGeral } from "./GoldVisaoGeral";
import { FormadorProfileSlideOver } from "./PerfilFormador";

export function CockpitGold({ turmaId, initialTab = "overview", navigate }: { turmaId?: number; initialTab?: Separador; navigate: Navegar }) {
  const { turma, erro, aCarregar, patch, setCronograma, toggle } = useTurmaCockpit("gold", turmaId);
  const { membros } = useMembrosGold(turmaId);
  const { user } = useAuth();
  const souFormador = user.role === "formador";
  const nomesEu = useNomesEu();
  const opcoesFormador = useOpcoesFormador(undefined, "gold");
  const [tab, setTab] = useState<Separador>(initialTab);
  useEffect(() => { setTab(souFormador ? tabDoFormador(initialTab) : initialTab); }, [initialTab, turmaId, souFormador]);
  const ped = useTurmaPedagogia("gold", turma?.id ?? 0);
  const criterios = useCriteriosAvaliacao("gold", turma?.curso);
  const programa = useProgramaDoCurso("gold", turma?.curso ?? "");
  const modelosCurso = usePlanosCurso("gold", turma?.curso ?? "");
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
  const [transferir, setTransferir] = useState<FormandoTurma | null>(null);
  const [eliminar, setEliminar] = useState<FormandoTurma | null>(null);
  const [envioInq, setEnvioInq] = useState("");
  const [fechar, setFechar] = useState(false);
  const { resultados } = useResultadosTurma("gold", souFormador ? undefined : turmaId);

  return (
    <EstadoCockpit aCarregar={aCarregar} erro={erro} existe={Boolean(turma)} onVoltar={() => navigate("gold-turmas")}>
      {() => {
        const t = turma!;
        const activa = isTurmaActiva(t);
        const vagasLivres = lugaresLivres(t);
        const sessoes = cronogramaToSessoes(t.cronograma);
        const sumarios = ped.sumarios;
        const nomesCockpit = membros.map(f => ({ id: f.id, nome: `${f.nome} ${f.apelido}` }));
        const podeDoc = (s: SessaoMeta, doc: "plano" | "sumario" | "presencas") => {
          const validado = doc === "plano" ? Boolean(ped.planos[s.n]?.assinado) : doc === "sumario" ? Boolean(sumarios[s.n]?.assinado) : Boolean(sumarios[s.n]?.presencasValidadas);
          return podeMexerDocumento({ role: user.role, nomes: nomesEu, sessao: s, validado });
        };
        const porPagar = membros.filter(f => !f.pago).length;
        const semSumario = sessoes.filter(s => !sumarioPreenchido(sumarios[s.n])).length;
        const proximos: NextAction[] = [];
        const fechada = Boolean(resultados?.turma.fechada);
        const faltaFecho = resultados?.fecho?.falta ?? [];
        // Regra do servidor: o dossiê só bloqueia o fecho quando as regras pedagógicas o pedem, e aí qualquer item em falta conta.
        const dossieBloqueia = Boolean(resultados?.regras.dtpBloqueiaFecho);
        if (!souFormador && !fechada && ped.dtp.pct < 100 && (dossieBloqueia || ped.dtp.pct < 70)) {
          proximos.push({
            tone: dossieBloqueia ? "error" : "warn", title: `Dossiê a ${ped.dtp.pct} %`,
            detail: dossieBloqueia ? "Cada item do dossiê em falta bloqueia o fecho da turma." : "Complete o dossiê técnico-pedagógico.",
            onClick: () => setTab("dtp"),
          });
        }
        if (!souFormador && porPagar) proximos.push({ tone: "warn", title: `${porPagar} por pagar`, detail: "Pedir o pagamento na ficha do formando.", onClick: () => setTab("overview") });
        if (semSumario) proximos.push({ tone: "warn", title: `${semSumario} sessões sem sumário`, detail: "O formador ainda não fechou a sessão.", onClick: () => setTab("sessoes") });
        if (vagasLivres === 0) proximos.push({ tone: "info", title: "Turma lotada", detail: "Novas pré-inscrições não entram aqui.", onClick: () => setTab("overview") });
        const ocupacao = t.vagas > 0 ? Math.min(100, (t.totalAlunos / t.vagas) * 100) : 0;

        return (
          <>
            <div className="space-y-5">
              <section className="rounded-painel bg-nav p-5 text-white">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-acao text-tinta text-xs font-bold px-2.5 py-1 rounded-controlo">{t.nome}</span>
                      {estadoBadge(t.estado)}
                      {!souFormador && <TurmaActivaToggle compact light activa={activa} onChange={toggle} />}
                    </div>
                    <h1 className="m-0 mt-2 text-lg font-semibold">{t.curso}</h1>
                    <p className="m-0 mt-2 flex flex-wrap gap-4 text-slate-300 text-xs">
                      <span className="flex items-center gap-1">{I.location} {t.local}</span>
                      <span className="flex items-center gap-1">{I.calendar} {t.dataInicio}</span>
                      <span className="flex items-center gap-1">{I.school} {t.horario}</span>
                    </p>
                  </div>
                  {!souFormador && (
                    <div className="flex gap-2 flex-wrap items-center">
                      <Botao tamanho="sm" variante="fantasma" className="text-white hover:text-tinta" onClick={() => {
                        setEnvioInq("A enviar…");
                        void apiEnviarInqueritosTurma("gold", t.id)
                          .then(r => setEnvioInq(`${r.enviados} enviados${r.semEmail ? `, ${r.semEmail} sem email` : ""}`))
                          .catch(err => setEnvioInq(err instanceof Error ? err.message : "Não foi possível enviar."));
                      }}>Enviar inquéritos</Botao>
                      <Botao tamanho="sm" variante="primario" onClick={() => setEditar(true)}>Editar turma</Botao>
                      {resultados && !fechada && staffPodeDossie(user.role) && (
                        <Botao tamanho="sm" variante="secundario" disabled={faltaFecho.length > 0}
                          title={faltaFecho.length ? `Falta: ${faltaFecho.slice(0, 5).join(" ")}${faltaFecho.length > 5 ? "…" : ""}` : "Fecha a turma: deixa de aceitar alterações pedagógicas e inscrições"}
                          onClick={() => setFechar(true)}>Fecho formal</Botao>
                      )}
                      {fechada && <span className="text-xs font-semibold text-emerald-200 px-3 py-2 bg-white/10 rounded-controlo">Fechada</span>}
                      {fechada && <ReabrirTurma regime="gold" turmaId={t.id} onReaberta={() => recarregarTurma("gold", t.id)} />}
                      <Botao tamanho="sm" variante="fantasma" soIcone aria-label="Exportar turma" className="text-white hover:text-tinta" icone={I.download}
                        onClick={() => setExportar(exportPayload(
                          { nome: t.nome, curso: t.curso, local: t.local, formandos: t.totalAlunos, accent: "gold", turmaId: t.id },
                          membros.map(f => ({ nome: `${f.nome} ${f.apelido}`, email: f.email, telf: f.telf, estado: f.pago ? "Pago" : "Por pagar" })),
                          sessoes, ped,
                        ))} />
                      {envioInq && <p role="status" className="m-0 text-xs text-amber-200 max-w-[12rem]">{envioInq}</p>}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">{t.totalAlunos} formandos inscritos</span>
                    <span className={vagasLivres === 0 ? "text-red-300 font-bold" : vagasLivres <= 3 ? "text-amber-300 font-bold" : "text-emerald-300"}>
                      {vagasLivres === 0 ? "Lotada" : `${vagasLivres} vagas restantes`}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2" role="progressbar" aria-valuenow={Math.round(ocupacao)} aria-valuemin={0} aria-valuemax={100} aria-label="Ocupação da turma">
                    <div className="h-2 rounded-full" style={{ width: `${ocupacao}%`, backgroundColor: vagasLivres === 0 ? "#B42318" : vagasLivres <= 3 ? "#FFB020" : "#1F7A4D" }} />
                  </div>
                  <p className="m-0 mt-1 text-right text-xs text-slate-400">{t.vagas} vagas no total</p>
                </div>
              </section>

              <NextActions accent="gold" actions={proximos.slice(0, 3)} />
              <TurmaTabBar tab={tab} onChange={setTab} accent="gold" dtpPct={ped.dtp.pct} dossie={staffPodeDossie(user.role)} so={souFormador ? TABS_FORMADOR : undefined} />
              {!activa && <TurmaInactivaBanner nome={t.nome} onActivate={() => toggle(true)} />}

              {tab === "cronograma" && !souFormador && (
                <CronogramaEditor layout="page" turmaId={t.id} identidade={`gold-${t.id}`} nome={t.nome} sessoes={t.cronograma}
                  onChange={setCronograma} inicio={t.dataInicio} horario={t.horario} horas={t.horas} formador={t.formador} curso={t.curso} local={t.local} />
              )}
              {tab === "dtp" && staffPodeDossie(user.role) && (
                <DtpPanel regime="gold" turma={{ codigo: t.nome, id: t.id, titulo: t.curso, sub: `${t.local} · ${t.horario}` }} dtp={ped.dtp} estado={ped.estado}
                  onToggle={(item, proximo) => void ped.guardarDtp(item.id, proximo)} onAnexo={(item, file) => void ped.guardarDtpAnexo(item.id, file)} />
              )}
              {tab === "sessoes" && (
                <SessoesTurmaTab accent="gold" regime="gold" turmaId={t.id} onPlanosImportados={() => void ped.recarregar()} turmaNome={t.nome} cursoNome={t.curso} sessoes={sessoes} planos={ped.planos} presencas={ped.presencas}
                  sumarios={sumarios} formandos={nomesCockpit} onNovaSessao={() => setNovaSessao(true)} onPlano={setPlanoSessao}
                  onSumario={setSumarioSessao} onPresencas={setPresencasSessao} onOpenFormador={setFormadorAberto} podeEditar={podeDoc} podeCriar={!souFormador}
                  formadorOpcoes={souFormador ? undefined : opcoesFormador}
                  onFormador={souFormador ? undefined : (s, nome) => {
                    if (!s.id) return;
                    setCronograma(t.cronograma.map(x => x.id === s.id ? { ...x, formadores: nome ? [nome] : [] } : x));
                  }} />
              )}
              {tab === "avaliacao" && (
                <TurmaAvaliacao key={t.id} regime="gold" turmaId={t.id} cursoNome={t.curso} turmaNome={t.nome} accent="gold" formandos={nomesCockpit} soLeitura={souFormador} />
              )}
              {tab === "documentos" && !souFormador && (
                <DocumentosTurmaTab regime="gold" curso={t.curso} criterios={criterios} guardados={ped.documentos} onSaveDoc={doc => void ped.guardarDocumento(doc)}
                  dtpItems={ped.dtp.items} formandos={nomesCockpit.map(f => f.nome)} sessoes={labelsSessoesFin(t.cronograma)} />
              )}
              {tab === "certificados" && !souFormador && (
                <CertificadosTurmaTab formandos={nomesCockpit} certificados={ped.certificados}
                  onUpload={(id, nota) => { setUploadNota(nota ?? null); setUploadCert(id); }} onView={setVerCert} onNota={(id, p) => ped.guardarCertificado(id, p)}
                  curso={t.curso} turma={t.nome} regime="gold" turmaId={t.id} />
              )}
              {tab === "overview" && (
                <GoldVisaoGeral turma={t} membros={membros} souFormador={souFormador} activa={activa} programa={programa.labels}
                  onFicha={souFormador ? undefined : f => navigate({ view: "gold-formando-ficha", formandoId: f.id })}
                  onTransferir={setTransferir} onEliminar={setEliminar} onAdicionar={() => setInscrever(true)}
                  onEditarPrograma={() => navigate("gold-cursos")} onFormadores={nomes => patch({ formadores: nomes })}
                  onFormador={setFormadorAberto} onSala={valor => patch({ custoHoraSala: valor })} />
              )}
            </div>

            <PlanoSessaoModal open={!!planoSessao} onClose={() => setPlanoSessao(null)} sessao={planoSessao ?? undefined}
              plano={planoSessao ? herdarPlanoCurso(modelosCurso.planos, planoSessao.n, ped.plano(planoSessao.n)) : emptyPlano()}
              soLeitura={souFormador && planoSessao && ped.planosDoCurso.includes(planoSessao.n) ? "Plano definido na ficha do curso" : undefined}
              onSave={data => { if (planoSessao) void ped.guardarPlano(planoSessao.n, data, planoSessao.id); }} />
            <SumarioSessaoModal open={!!sumarioSessao} onClose={() => setSumarioSessao(null)} sessao={sumarioSessao ?? undefined}
              sumario={sumarioSessao ? herdarSumarioCurso(modelosCurso.planos, sumarioSessao.n, ped.sumario(sumarioSessao.n)) : emptySumario()}
              onSave={data => {
                if (!sumarioSessao) return;
                void ped.guardarSumario(sumarioSessao.n, data, sumarioSessao.id);
                if (data.assinado) {
                  void emitAutomation("sessao.summary_signed", { email: user.email, nome: t.formador || user.name, curso: t.curso, turma: t.nome }, `sumario:gold:${t.id}:${sumarioSessao.n}`);
                }
              }} />
            <PresencasSessaoModal open={!!presencasSessao} onClose={() => setPresencasSessao(null)} sessao={presencasSessao ?? undefined} turmaNome={t.nome} cursoNome={t.curso}
              formandos={presencasSessao ? presencasDaSessao(nomesCockpit, ped.presencas[presencasSessao.n]) : nomesCockpit}
              onSave={rows => { if (presencasSessao) void ped.guardarPresencas(presencasSessao.n, rows, presencasSessao.id); }} />
            <FileUploadModal open={uploadCert !== null} onClose={() => setUploadCert(null)} title="Carregar certificado"
              context={{ kind: "certificado", regime: "gold", turma: t.nome, formando: uploadCert != null ? String(uploadCert) : undefined, label: "Certificado" }}
              onConfirm={file => { if (uploadCert != null) void ped.guardarCertificado(uploadCert, { emitido: true, ficheiroId: file.id, ficheiroNome: file.name, ficheiroUrl: file.openUrl, ...(uploadNota != null ? { nota: uploadNota } : {}) }); }} />
            <CertificadoVerModal open={!!verCert} onClose={() => setVerCert(null)} cert={verCert} accent="gold" />
            <ExportTurmaModal open={!!exportar} onClose={() => setExportar(null)} turma={exportar} />
            <FormadorProfileSlideOver open={!!formadorAberto} onClose={() => setFormadorAberto(null)} nome={formadorAberto ?? ""} accent="gold" turma={t.nome}
              horas={formadorAberto ? horasDoFormador(t.cronograma, formadorAberto) : undefined} />
            <NovaSessaoPainel key={`sessao-${novaSessao}`} aberto={novaSessao} onFechar={() => setNovaSessao(false)} regime="gold" turma={t} horaPadrao="09:00" duracao={4}
              onCriar={s => { setCronograma([...t.cronograma, s]); setNovaSessao(false); }} />
            <InscreverGold aberto={inscrever} onFechar={() => setInscrever(false)} turma={t} activa={activa} membros={membros} onActivar={() => toggle(true)} />
            <EditarTurmaGold aberto={editar} onFechar={() => setEditar(false)} turma={t} onGravar={patch} />
            <TransferirEEliminarGold turma={t} transferir={transferir} eliminar={eliminar} onFechar={() => { setTransferir(null); setEliminar(null); }} />
            <ConfirmarPerigo
              aberto={fechar}
              onFechar={() => setFechar(false)}
              titulo="Fecho formal da turma"
              acao="Fechar turma"
              descricao="A turma deixa de aceitar alterações pedagógicas e inscrições. Depois disso só reabre com a administração."
              onConfirmar={async () => {
                const r = await persist(apiTurmaGoldFecho(t.id));
                if (!r) return;
                recarregarTurma("gold", t.id);
                toastOk("Turma fechada.");
              }}
            />
          </>
        );
      }}
    </EstadoCockpit>
  );
}
