import { useMemo, useState } from "react";
import type { DriveFile } from "../../../partilhado/api";
import { apiAlterarFormador, apiFichaFormador, apiGravarDocsFormador, type AcessoCriado, type FichaFormador as Ficha, type TurmaDoFormador } from "../../../partilhado/api/formadores";
import { useAuth } from "../../../partilhado/AuthGate";
import { invalidar, useRecurso } from "../../../partilhado/dados/useRecurso";
import { DisponibilidadeEditor } from "../../../partilhado/DisponibilidadeEditor";
import { DOCS_FORMADOR } from "../../../partilhado/dossierDocs";
import { FormadorCalendario } from "../../../partilhado/FormadorCalendario";
import { persist, toastOk } from "../../../partilhado/toastBus";
import { FileUploadModal } from "../../../partilhado/TurmaExtras";
import {
  Botao, Cartao, Detalhes, ErroCarregar, Esqueleto, Estado, Kpi, KpiFaixa, PageHeader, Separadores, Tabela,
  data, dataHora, eur, num, type Coluna,
} from "../../../partilhado/ui";
import type { Navegar } from "../../shell/tipos";
import { AvisoAcesso } from "./AvisoAcesso";
import { FormadorFormulario } from "./FormadorFormulario";
import { Iniciais, estadoCcp } from "./formadoresUi";

type Aba = "turmas" | "agenda" | "disponibilidade" | "documentos";

/** Ficha do formador: dados, turmas e horas, agenda e documentos. Serve a backoffice e a área do formador. */
export function FichaFormador({ id, navigate, area = false }: { id: number; navigate: Navegar; area?: boolean }) {
  const { user, pode } = useAuth();
  const gerir = !area && pode("formadores.gerir");
  const proprio = user.role === "formador";
  const ficha = useRecurso(`formador:${id}`, s => apiFichaFormador(id, s));
  const [aba, setAba] = useState<Aba>("turmas");
  const [editar, setEditar] = useState(false);
  const [acesso, setAcesso] = useState<AcessoCriado>(null);
  const [upload, setUpload] = useState<string | null>(null);
  const recarregar = () => { invalidar(`formador:${id}`); invalidar("formadores:"); };

  if (ficha.erro && !ficha.dados) return <ErroCarregar erro={ficha.erro} onTentar={ficha.recarregar} />;
  const d = ficha.dados;
  if (!d) return <div className="space-y-4"><Esqueleto linhas={2} altura="h-8" /><Esqueleto linhas={6} altura="h-12" /></div>;
  const f = d.formador;
  const ccp = estadoCcp(f);
  const regimeLista = f.regimes.includes("gold") ? "gold-formadores" : "fin-formadores";

  return (
    <div className="space-y-4">
      <PageHeader
        trilho={area ? undefined : [{ rotulo: "Formadores", onClick: () => navigate(regimeLista) }, { rotulo: f.nome }]}
        titulo={<span className="inline-flex items-center gap-3"><Iniciais nome={f.nome} />{area ? "O meu perfil" : f.nome}</span>}
        etiqueta={<Estado tom={f.estado === "Ativo" ? "sucesso" : "neutro"} ponto>{f.estado === "Ativo" ? "Ativo" : "Inativo"}</Estado>}
        subtitulo={[f.especialidade || "Sem especialidade registada", f.regimes.map(r => (r === "gold" ? "Gold" : "Financiada")).join(" e ")].filter(Boolean).join(" · ")}
        acoes={gerir && <Botao variante="secundario" onClick={() => setEditar(true)}>Editar ficha</Botao>}
      />
      <AvisoAcesso acesso={acesso} onFechar={() => setAcesso(null)} />

      <KpiFaixa className="xl:grid-cols-5">
        <Kpi rotulo="Turmas a decorrer" valor={d.totais.turmasAtivas} delta={`${d.totais.turmas} no total`} />
        <Kpi rotulo="Horas dadas" valor={d.totais.horasDadas} formato="horas" />
        <Kpi rotulo="Horas por dar" valor={d.totais.horasPendentes} formato="horas" />
        <Kpi rotulo="Valor das horas dadas" valor={d.totais.valorDado} formato="eur" titulo="Horas dadas × valor por hora de cada turma" />
        <Kpi rotulo="Documentos em falta" valor={d.totais.docsEmFalta} delta={d.totais.docsEmFalta ? { texto: "obrigatórios por entregar", tom: "aviso" } : { texto: "obrigatórios entregues", tom: "sucesso" }} onClick={() => setAba("documentos")} />
      </KpiFaixa>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
        <div className="space-y-4">
          <Cartao titulo="Dados">
            <Detalhes colunas={1} itens={[
              { rotulo: "Email", valor: f.email ? <a href={`mailto:${f.email}`}>{f.email}</a> : "—" },
              { rotulo: "Telemóvel", valor: f.telf ? <a href={`tel:${f.telf.replace(/\s/g, "")}`}>{f.telf}</a> : "—" },
              { rotulo: "NIF", valor: f.nif || "—" },
              { rotulo: "CCP / CCPE", valor: <span className="num">{f.ccp || "—"} <Estado tom={ccp.tom}>{ccp.texto}</Estado></span> },
              { rotulo: "Valor base por hora", valor: f.custoHora ? eur(f.custoHora, true) : "—" },
            ]} />
          </Cartao>
          {!area && (
            <Cartao titulo="Área do formador">
              {d.acesso ? (
                <Detalhes colunas={1} itens={[
                  { rotulo: "Utilizador", valor: d.acesso.email },
                  { rotulo: "Estado", valor: <Estado tom={d.acesso.ativo ? "sucesso" : "neutro"}>{d.acesso.ativo ? "Conta ativa" : "Conta desativada"}</Estado> },
                  { rotulo: "Último acesso", valor: d.acesso.ultimoAcesso ? dataHora(d.acesso.ultimoAcesso) : "Ainda não entrou" },
                  ...(d.acesso.porTrocarPalavraPasse ? [{ rotulo: "Palavra-passe", valor: "Temporária: muda no primeiro acesso" }] : []),
                ]} />
              ) : (
                <p className="m-0 text-sm text-tinta-suave">Sem conta de acesso. Registe o email na ficha para a criar.</p>
              )}
            </Cartao>
          )}
        </div>

        <Cartao semPadding>
          <Separadores
            className="px-4 pt-2"
            rotulo="Secções da ficha"
            ativo={aba}
            onMudar={setAba}
            itens={[
              { id: "turmas", rotulo: "Turmas e horas", contagem: d.turmas.length },
              { id: "agenda", rotulo: "Agenda", contagem: d.sessoes.filter(s => s.data >= d.hoje).length },
              { id: "disponibilidade", rotulo: "Disponibilidade" },
              { id: "documentos", rotulo: "Documentos", contagem: d.totais.docsEmFalta || undefined },
            ]}
          />
          <div className="p-4">
            {aba === "turmas" && <TurmasDoFormador ficha={d} navigate={navigate} area={area} />}
            {aba === "agenda" && (
              <FormadorCalendario
                nome={f.nome}
                slots={f.disponibilidade}
                eventos={d.sessoes.map(s => ({
                  id: `${s.regime}:${s.turmaId}:${s.data}:${s.horaInicio}`, data: s.data, titulo: s.turma, turma: s.turma,
                  inicio: s.horaInicio, fim: s.horaFim, hora: [s.horaInicio, s.horaFim].filter(Boolean).join(" a "),
                }))}
              />
            )}
            {aba === "disponibilidade" && (
              <>
                    <DisponibilidadeEditor
                      value={f.disponibilidade}
                      locked={!gerir && !proprio}
                      onChange={slots => void persist(apiAlterarFormador(id, { disponibilidade: slots }).then(() => { toastOk("Disponibilidade gravada."); recarregar(); }))}
                      nota="O cronograma só atribui sessões nestes horários."
                    />
              </>
            )}
            {aba === "documentos" && <DocumentosDoFormador ficha={d} podeAlterar={gerir || proprio} onCarregar={setUpload} />}
          </div>
        </Cartao>
      </div>

      {gerir && (
        <FormadorFormulario
          aberto={editar}
          regime={f.regimes[0] ?? "gold"}
          formador={f}
          especialidades={[]}
          onFechar={() => setEditar(false)}
          onGuardado={(_x, a) => { setEditar(false); if (a) setAcesso(a); toastOk("Ficha gravada."); recarregar(); }}
        />
      )}
      <FileUploadModal
        open={Boolean(upload)}
        onClose={() => setUpload(null)}
        title={`Carregar: ${tiposDoc(d).find(x => x.id === upload)?.label ?? ""}`}
        accent={f.regimes.includes("gold") ? "gold" : "fin"}
        context={{ kind: "formador-doc", regime: f.regimes.includes("gold") ? "gold" : "fin", formando: f.nome, label: tiposDoc(d).find(x => x.id === upload)?.label }}
        onConfirm={(file: DriveFile) => {
          if (!upload) return;
          const docs = [
            ...d.docs.filter(x => x.id !== upload).map(({ atualizadoEm: _a, ...x }) => x),
            { id: upload, uploaded: true, fileName: file.name, driveFileId: file.id, driveUrl: file.openUrl },
          ];
          setUpload(null);
          void persist(apiGravarDocsFormador(id, docs).then(() => { toastOk("Documento guardado."); recarregar(); }));
        }}
      />
    </div>
  );
}

function tiposDoc(d: Ficha) {
  const base = DOCS_FORMADOR.map(x => ({ id: x.id, label: x.label, required: Boolean(x.required) }));
  const extras = d.docs.filter(x => !base.some(b => b.id === x.id)).map(x => ({ id: x.id, label: x.fileName || x.id, required: false }));
  return [...base, ...extras];
}

function TurmasDoFormador({ ficha, navigate, area }: { ficha: Ficha; navigate: Navegar; area: boolean }) {
  const colunas: Coluna<TurmaDoFormador>[] = useMemo(() => [
    {
      id: "turma", titulo: "Turma", principal: true,
      celula: t => (
        <div className="min-w-0">
          <p className="m-0 font-semibold truncate">{t.nome}</p>
          <p className="m-0 text-xs text-tinta-suave truncate max-w-[220px]" title={t.curso}>{t.regime === "gold" ? "Gold" : "Financiada"} · {t.curso}{t.responsavel ? " · responsável" : ""}</p>
        </div>
      ),
    },
    { id: "periodo", titulo: "Período", celula: t => <span className="num text-[13px] whitespace-nowrap">{data(t.inicio)}{t.fim && t.fim !== t.inicio ? ` – ${data(t.fim)}` : ""}</span> },
    { id: "sessoes", titulo: "Sessões", alinhar: "dir", esconderMovel: true, celula: t => <span className="num">{t.sessoes}</span> },
    {
      id: "horas", titulo: "Horas", alinhar: "dir",
      celula: t => <div className="num text-right text-[13px] whitespace-nowrap"><p className="m-0">{num(t.horasDadas)} h dadas</p><p className="m-0 text-xs text-tinta-suave">{num(t.horasPendentes)} h por dar</p></div>,
    },
    { id: "valor", titulo: "Valor/h", alinhar: "dir", esconderMovel: true, celula: t => <span className="num">{t.valorHora ? eur(t.valorHora, true) : "—"}</span> },
    { id: "dado", titulo: "Horas dadas × valor", alinhar: "dir", celula: t => <span className="num font-semibold">{eur(t.valorDado, true)}</span> },
    { id: "estado", titulo: "Estado", esconderMovel: true, celula: t => <Estado tom={t.fechada ? "neutro" : t.horasPendentes > 0 ? "acao" : "aviso"}>{t.fechada ? "Fechada" : t.horasPendentes > 0 ? "Em curso" : "Por fechar"}</Estado> },
  ], []);
  return (
    <div className="space-y-3">
      <Tabela
        rotulo="Turmas do formador"
        linhas={ficha.turmas}
        colunas={colunas}
        chave={t => `${t.regime}:${t.id}`}
        onLinha={t => navigate({ view: t.regime === "gold" ? "gold-cockpit-turma" : "fin-cockpit-turma", turmaId: t.id, tab: "overview" })}
        vazio={area ? "Ainda não tem turmas atribuídas." : "Este formador ainda não está em nenhuma turma."}
      />
      {ficha.turmas.length > 0 && (
        <p className="m-0 text-xs text-tinta-suave">
          Horas contadas a partir do cronograma de cada turma (sessões presenciais e síncronas). O valor usa o valor por hora da turma ou, sem ele, o valor base do formador.
        </p>
      )}
    </div>
  );
}

function DocumentosDoFormador({ ficha, podeAlterar, onCarregar }: { ficha: Ficha; podeAlterar: boolean; onCarregar: (id: string) => void }) {
  const tipos = tiposDoc(ficha);
  return (
    <ul className="m-0 p-0 list-none divide-y divide-linha-suave">
      {tipos.map(t => {
        const doc = ficha.docs.find(x => x.id === t.id && x.uploaded);
        return (
          <li key={t.id} className="flex items-center gap-3 py-3 flex-wrap">
            <span className={`w-2 h-2 rounded-full shrink-0 ${doc ? "bg-sucesso" : t.required ? "bg-perigo" : "bg-linha-forte"}`} aria-hidden="true" />
            <div className="flex-1 min-w-[180px]">
              <p className="m-0 text-sm font-medium">{t.label}{t.required && <span className="text-perigo" title="Obrigatório"> *</span>}</p>
              <p className="m-0 text-xs text-tinta-suave">{doc ? `${doc.fileName}${doc.atualizadoEm ? ` · ${data(doc.atualizadoEm)}` : ""}` : t.required ? "Obrigatório, em falta" : "Opcional"}</p>
            </div>
            {doc?.driveUrl && <Botao variante="ligacao" tamanho="sm" onClick={() => window.open(doc.driveUrl, "_blank", "noopener,noreferrer")}>Abrir</Botao>}
            {podeAlterar && <Botao variante="secundario" tamanho="sm" onClick={() => onCarregar(t.id)}>{doc ? "Substituir" : "Carregar"}</Botao>}
          </li>
        );
      })}
    </ul>
  );
}
