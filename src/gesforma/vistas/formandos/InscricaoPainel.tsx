import { useEffect, useMemo, useState } from "react";
import {
  ESTADOS_INSCRICAO_FIN, apiAlterarInscricaoFin, apiApagarInscricaoFin, apiCriarInscricaoFin,
  type EstadoInscricaoFin, type LinhaInscricaoFin,
} from "../../../partilhado/api/formandos";
import { invalidar } from "../../../partilhado/dados/useRecurso";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { Aviso, Botao, Caixa, Campo, ConfirmarPerigo, Entrada, PainelLateral, Selecao } from "../../../partilhado/ui";
import { rotuloCodigoCurso } from "../../../partilhado/codigoCurso";

/** Documentos que a candidatura acompanha (os pontinhos da lista). */
export const DOCS_INSCRICAO: { id: string; curto: string; rotulo: string }[] = [
  { id: "cc", curto: "CC", rotulo: "Cartão de cidadão" },
  { id: "ch", curto: "CH", rotulo: "Certificado de habilitações" },
  { id: "cu", curto: "CV", rotulo: "Curriculum vitae" },
  { id: "ci", curto: "IB", rotulo: "IBAN" },
  { id: "ce", curto: "CE", rotulo: "Comprovativo de emprego" },
];

const PROXIMO: Record<EstadoInscricaoFin, string> = {
  "Recebida": "Analisar a candidatura e pedir os documentos em falta.",
  "Em análise": "Confirmar a elegibilidade com os documentos.",
  "Elegível": "Colocar numa turma da UFCD. A ficha do formando já existe em Formandos.",
  "Colocado na turma": "Acompanhar na turma e na ficha do formando.",
  "Indeferido": "Sem passos: a candidatura não é elegível.",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InscricaoPainel({ alvo, onFechar, podeApagar, onAbrirFicha }: {
  alvo: LinhaInscricaoFin | "nova" | null;
  onFechar: () => void;
  podeApagar: boolean;
  onAbrirFicha: (formandoId: number) => void;
}) {
  const editar = alvo && alvo !== "nova" ? alvo : null;
  const cursos = useOpcoes("cursos", { regime: "fin" });
  const turmas = useOpcoes("turmas", { regime: "fin" });
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [email, setEmail] = useState("");
  const [telf, setTelf] = useState("");
  const [curso, setCurso] = useState("");
  const [turma, setTurma] = useState("");
  const [estado, setEstado] = useState<EstadoInscricaoFin>("Recebida");
  const [docs, setDocs] = useState<Record<string, boolean>>({});
  const [aGravar, setAGravar] = useState(false);
  const [apagar, setApagar] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    setNome(editar?.nome ?? ""); setApelido(editar?.apelido ?? ""); setEmail(editar?.email ?? ""); setTelf(editar?.telf ?? "");
    setCurso(editar?.curso ?? ""); setTurma(editar?.turma ?? ""); setEstado(editar?.estado ?? "Recebida"); setDocs(editar?.docs ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo]);

  // Só turmas abertas desta UFCD (e a actual, se já não estiver aberta).
  const turmasOpc = useMemo(() => {
    const lista = turmas.opcoes
      .filter(t => !curso || String(t.extra?.curso ?? "").trim().toLowerCase() === curso.trim().toLowerCase())
      .map(t => ({ valor: t.valor, rotulo: t.rotulo }));
    if (turma && !lista.some(t => t.valor === turma)) lista.unshift({ valor: turma, rotulo: turma });
    return lista;
  }, [turmas.opcoes, curso, turma]);

  const erroEmail = email && !EMAIL.test(email) ? "Email inválido." : null;
  const valido = nome.trim() && curso && !erroEmail;

  async function gravar() {
    if (!valido) return;
    setAGravar(true);
    try {
      const corpo = { nome: nome.trim(), apelido: apelido.trim(), email: email.trim(), telf: telf.trim(), curso, turma, estado, docs };
      const r = editar ? await apiAlterarInscricaoFin(editar.id, corpo) : await apiCriarInscricaoFin(corpo);
      invalidar("formandos:");
      if (r.aviso) toastError(new Error(r.aviso), "Inscrição gravada, mas a ficha do formando não foi actualizada.");
      else toastOk(estado === "Elegível" || estado === "Colocado na turma" ? "Inscrição gravada. A ficha do formando está em Formandos." : "Inscrição gravada.");
      onFechar();
    } catch (err) {
      toastError(err, "Não foi possível gravar a inscrição.");
    } finally {
      setAGravar(false);
    }
  }

  async function confirmarApagar() {
    if (!editar) return;
    try {
      await apiApagarInscricaoFin(editar.id);
      invalidar("formandos:");
      toastOk("Inscrição eliminada.");
      onFechar();
    } catch (err) {
      toastError(err, "Não foi possível eliminar.");
      throw err;
    }
  }

  return (
    <PainelLateral
      aberto={Boolean(alvo)}
      onFechar={onFechar}
      titulo={editar ? `${editar.nome} ${editar.apelido}`.trim() : "Nova inscrição financiada"}
      subtitulo={editar ? [editar.ufcd && `${rotuloCodigoCurso(editar.ufcd)}`, editar.turma || "sem turma", editar.inscrito].filter(Boolean).join(" · ") : "Candidatura a uma UFCD."}
      largura={520}
      rodape={(
        <>
          {editar && podeApagar && <Botao variante="fantasma" className="mr-auto" onClick={() => setApagar(true)}>Eliminar</Botao>}
          <Botao onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={aGravar} disabled={!valido} onClick={gravar}>{editar ? "Guardar" : "Criar inscrição"}</Botao>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        {editar && (
          <Aviso tom="info" titulo="Próximo passo" acao={editar.formandoId ? <Botao tamanho="sm" onClick={() => onAbrirFicha(editar.formandoId!)}>Abrir ficha</Botao> : undefined}>
            {PROXIMO[editar.estado] ?? "—"}
          </Aviso>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo rotulo="Nome" obrigatorio>{p => <Entrada {...p} value={nome} onChange={e => setNome(e.target.value)} data-autofocus />}</Campo>
          <Campo rotulo="Apelido">{p => <Entrada {...p} value={apelido} onChange={e => setApelido(e.target.value)} />}</Campo>
          <Campo rotulo="Email" erro={erroEmail}>{p => <Entrada {...p} type="email" value={email} onChange={e => setEmail(e.target.value)} />}</Campo>
          <Campo rotulo="Telemóvel">{p => <Entrada {...p} type="tel" value={telf} onChange={e => setTelf(e.target.value)} />}</Campo>
        </div>
        <Campo rotulo="Curso / UFCD" obrigatorio>
          {p => <Selecao {...p} opcoes={cursos.selecao} vazio="Escolher…" value={curso} onChange={e => { setCurso(e.target.value); setTurma(""); }} />}
        </Campo>
        <Campo rotulo="Turma" ajuda={curso && turmasOpc.length === 0 ? "Não há turmas abertas para esta UFCD." : "Só turmas abertas."}>
          {p => <Selecao {...p} opcoes={turmasOpc} vazio="Sem turma" value={turma} onChange={e => setTurma(e.target.value)} disabled={!curso} />}
        </Campo>
        <Campo rotulo="Estado" ajuda="«Elegível» e «Colocado na turma» criam ou actualizam a ficha em Formandos.">
          {p => <Selecao {...p} opcoes={ESTADOS_INSCRICAO_FIN.map(e => ({ valor: e, rotulo: e }))} value={estado} onChange={e => setEstado(e.target.value as EstadoInscricaoFin)} />}
        </Campo>
        <fieldset className="m-0 p-0 border-0 flex flex-col gap-2">
          <legend className="text-[13px] font-medium text-tinta mb-1">Documentos entregues</legend>
          {DOCS_INSCRICAO.map(d => (
            <Caixa key={d.id} rotulo={d.rotulo} checked={Boolean(docs[d.id])} onChange={e => setDocs(x => ({ ...x, [d.id]: e.target.checked }))} />
          ))}
        </fieldset>
      </div>
      <ConfirmarPerigo
        aberto={apagar}
        onFechar={() => setApagar(false)}
        onConfirmar={confirmarApagar}
        titulo="Eliminar inscrição"
        descricao={editar ? `A candidatura de ${editar.nome} ${editar.apelido} sai das inscrições. A ficha do formando, se existir, fica.` : ""}
      />
    </PainelLateral>
  );
}
