import { useEffect, useMemo, useRef, useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import {
  apiAcessoFormando, apiAlterarFormandoFin, apiAnexarOutroDocFormando, apiCarregarDocFormando, apiCriarFormandoFin, apiCriarFormandoGold,
  apiDocsDoCursoFicha, type DocDoCursoFicha, type Regime,
} from "../../../partilhado/api/formandos";
import { invalidar } from "../../../partilhado/dados/useRecurso";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { Aviso, Botao, Caixa, Campo, Entrada, Modal, Selecao, Separadores } from "../../../partilhado/ui";

type Pagamento = "por_pagar" | "pago" | "oferta";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACEITA = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";
const semExtensao = (n: string) => n.replace(/\.[a-z0-9]{2,5}$/i, "");

/**
 * Ficha criada à mão pela secretaria (oferta, pagamento combinado à parte, inscrição em papel).
 * O acesso à área do formando usa o email como utilizador e uma palavra-passe temporária enviada por email.
 */
export function NovaFicha({ aberto, onFechar, regime, onCriada }: {
  aberto: boolean;
  onFechar: () => void;
  regime: Regime;
  onCriada: (id: number) => void;
}) {
  const gold = regime === "gold";
  // A palavra-passe gerada é mostrada: só quem o servidor deixa gerar o acesso vê esta opção (o comercial não).
  const pode = usePode();
  const podeAcesso = pode(gold ? "formandosGold.gerir" : "formandosFin.gerir");
  const cursos = useOpcoes("cursos", { regime });
  const turmas = useOpcoes("turmas", { regime });
  const locais = useOpcoes("locais", { regime });
  const metodos = useOpcoes("lista", { lista: "metodos_pagamento" });
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [email, setEmail] = useState("");
  const [telf, setTelf] = useState("");
  const [curso, setCurso] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [local, setLocal] = useState("");
  const [horario, setHorario] = useState("");
  const [pagamento, setPagamento] = useState<Pagamento>("por_pagar");
  const [metodo, setMetodo] = useState("");
  const [criarAcesso, setCriarAcesso] = useState(true);
  // Inscrição feita pela equipa (ex.: vinda da plataforma antiga): por omissão, sem emails de documentos nem de pagamento.
  const [semEmails, setSemEmails] = useState(true);
  const [aGravar, setAGravar] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  // Documentos do curso escolhido (obrigatórios como no curso; opcionais e condicionais como opcionais) e outros documentos.
  const [docsCurso, setDocsCurso] = useState<DocDoCursoFicha[]>([]);
  const [docsEstado, setDocsEstado] = useState<"vazio" | "a_carregar" | "ok" | "erro">("vazio");
  const [ficheiros, setFicheiros] = useState<Record<string, File>>({});
  const [outros, setOutros] = useState<{ chave: string; ficheiro: File; nome: string }[]>([]);
  const escolhaDoc = useRef<HTMLInputElement>(null);
  const escolhaOutros = useRef<HTMLInputElement>(null);
  const [alvoDoc, setAlvoDoc] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setNome(""); setApelido(""); setEmail(""); setTelf(""); setCurso(""); setTurmaId(""); setLocal(""); setHorario("");
    setPagamento("por_pagar"); setMetodo(""); setCriarAcesso(true); setSemEmails(true); setErros({});
    setDocsCurso([]); setDocsEstado("vazio"); setFicheiros({}); setOutros([]);
  }, [aberto]);

  useEffect(() => {
    setFicheiros({});
    if (!aberto || !curso) { setDocsCurso([]); setDocsEstado("vazio"); return; }
    const ctl = new AbortController();
    setDocsEstado("a_carregar");
    apiDocsDoCursoFicha(regime, curso, ctl.signal)
      .then(r => { setDocsCurso(r.documentos); setDocsEstado("ok"); })
      .catch(() => { if (!ctl.signal.aborted) { setDocsCurso([]); setDocsEstado("erro"); } });
    return () => ctl.abort();
  }, [aberto, regime, curso]);

  // Primeiro o curso, depois o local e o horário; as turmas são as desse curso, local e horário (vêm em `extra`).
  const igual = (a: unknown, b: string) => String(a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
  const doCurso = useMemo(() => turmas.opcoes.filter(t => curso && igual(t.extra?.curso, curso)), [turmas.opcoes, curso]);
  const unicos = (v: string[]) => [...new Set(v.map(x => x.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"))
    .map(x => ({ valor: x, rotulo: x }));
  // Locais: os das turmas do curso (sem turmas, todos os locais).
  const locaisDoCurso = useMemo(() => {
    const das = unicos(doCurso.map(t => String(t.extra?.local ?? "")));
    return das.length ? das : locais.selecao;
  }, [doCurso, locais.selecao]);
  const horariosDoLocal = useMemo(
    () => unicos(doCurso.filter(t => !local || igual(t.extra?.local, local)).map(t => String(t.extra?.horario ?? ""))),
    [doCurso, local],
  );
  const turmasDoCurso = useMemo(
    () => doCurso
      .filter(t => (!local || igual(t.extra?.local, local)) && (!horario || igual(t.extra?.horario, horario)))
      .map(t => ({ valor: String(t.id), rotulo: t.rotulo })),
    [doCurso, local, horario],
  );

  function validarCampos() {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Indique o nome.";
    if (!EMAIL.test(email.trim())) e.email = "Indique um email válido (é o utilizador da área do formando).";
    if (!curso) e.curso = "Escolha o curso.";
    if (gold && pagamento === "pago" && !metodo) e.metodo = "Indique como foi pago.";
    if (curso && docsEstado === "a_carregar") e.docs = "Aguarde: a carregar os documentos do curso.";
    if (curso && docsEstado === "erro") e.docs = "Não foi possível ler os documentos do curso. Escolha o curso de novo.";
    const falta = docsCurso.filter(d => d.required && !ficheiros[d.id]);
    if (falta.length) e.docs = `Carregue os documentos obrigatórios do curso: ${falta.map(d => d.label).join(", ")}.`;
    if (outros.some(o => !o.nome.trim())) e.docs = "Dê um nome a cada um dos outros documentos.";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function gravar() {
    if (!validarCampos()) return;
    setAGravar(true);
    try {
      const turma = turmaId ? Number(turmaId) : undefined;
      // Financiada: a acção pede os documentos já carregados; a turma associa-se depois de os carregar.
      const r = gold
        ? await apiCriarFormandoGold({
          nome: nome.trim(), apelido: apelido.trim(), email: email.trim(), telf: telf.trim(), curso, local, turmaId: turma, semEmails, docsCurso: true,
          ...(pagamento === "oferta" ? { metodo: "Oferta", pago: true, valor: 0 } : pagamento === "pago" ? { pago: true, metodo } : { pago: false }),
        })
        : await apiCriarFormandoFin({ nome: nome.trim(), apelido: apelido.trim(), email: email.trim(), telf: telf.trim(), curso, semEmails, docsCurso: true });
      const id = r.formando.id;
      const falhas: string[] = [];
      for (const d of docsCurso) {
        const f = ficheiros[d.id];
        if (f) await apiCarregarDocFormando(regime, id, d.id, f).catch(() => { falhas.push(d.label); });
      }
      for (const o of outros) {
        await apiAnexarOutroDocFormando(regime, id, o.ficheiro, o.nome.trim()).catch(() => { falhas.push(o.nome.trim()); });
      }
      if (falhas.length) toastError(new Error(`Não foi possível carregar: ${falhas.join(", ")}. Carregue-os na ficha.`), "Documentos por carregar.");
      if (!gold && turma) {
        await apiAlterarFormandoFin(id, { turmaId: turma }).catch(err => toastError(err, "Ficha criada, mas sem a acção: associe-a na ficha."));
      }
      invalidar("formandos:");
      if (criarAcesso && podeAcesso) {
        const a = await apiAcessoFormando(regime, id, { enviarEmail: true }).catch(err => { toastError(err, "Ficha criada, mas o acesso não foi gerado."); return null; });
        if (a) {
          toastOk(a.acesso.emailEnviado
            ? `Ficha criada. Acesso enviado para ${a.acesso.email}.`
            : `Ficha criada. O email do acesso não saiu: gere uma palavra-passe nova na ficha.`);
        }
      } else {
        toastOk("Ficha criada.");
      }
      onCriada(id);
    } catch (err) {
      toastError(err, "Não foi possível criar a ficha.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Nova ficha de formando"
      subtitulo={gold ? "Inscrição feita pela secretaria (oferta, pagamento combinado ou em papel)." : "Formando financiado inscrito pela equipa."}
      largura="md"
      rodape={(
        <>
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={aGravar} onClick={gravar}>Criar ficha</Botao>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo rotulo="Nome" obrigatorio erro={erros.nome}>{p => <Entrada {...p} value={nome} onChange={e => setNome(e.target.value)} autoComplete="off" data-autofocus />}</Campo>
          <Campo rotulo="Apelido">{p => <Entrada {...p} value={apelido} onChange={e => setApelido(e.target.value)} autoComplete="off" />}</Campo>
        </div>
        <Campo rotulo="Email" obrigatorio erro={erros.email} ajuda="É o utilizador da área do formando.">
          {p => <Entrada {...p} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" />}
        </Campo>
        <Campo rotulo="Telemóvel">{p => <Entrada {...p} type="tel" value={telf} onChange={e => setTelf(e.target.value)} autoComplete="off" />}</Campo>
        <Campo rotulo={gold ? "Curso" : "Curso / UFCD"} obrigatorio erro={erros.curso}>
          {p => <Selecao {...p} opcoes={cursos.selecao} vazio="Escolher…" value={curso} onChange={e => { setCurso(e.target.value); setLocal(""); setHorario(""); setTurmaId(""); }} />}
        </Campo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo rotulo="Local">
            {p => <Selecao {...p} opcoes={locaisDoCurso} vazio="—" value={local} disabled={!curso}
              onChange={e => { setLocal(e.target.value); setHorario(""); setTurmaId(""); }} />}
          </Campo>
          <Campo rotulo="Horário">
            {p => <Selecao {...p} opcoes={horariosDoLocal} vazio="Todos" value={horario} disabled={!curso || !horariosDoLocal.length}
              onChange={e => { setHorario(e.target.value); setTurmaId(""); }} />}
          </Campo>
        </div>
        <Campo rotulo="Turma" ajuda={!curso ? "Escolha primeiro o curso." : turmasDoCurso.length ? "Opcional: sem turma fica como avulso." : "Não há turmas abertas deste curso neste local e horário."}>
          {p => <Selecao {...p} opcoes={turmasDoCurso} vazio="Sem turma" value={turmaId} onChange={e => setTurmaId(e.target.value)} disabled={!curso} />}
        </Campo>
        {curso && (
          <div className="flex flex-col gap-2" aria-labelledby="nova-ficha-docs">
            <span id="nova-ficha-docs" className="text-[13px] font-medium text-tinta">Documentos do curso</span>
            <input ref={escolhaDoc} type="file" accept={ACEITA} className="sr-only" tabIndex={-1} aria-hidden="true"
              onChange={e => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f && alvoDoc) setFicheiros(x => ({ ...x, [alvoDoc]: f }));
              }} />
            {docsEstado === "a_carregar" && <p className="m-0 text-xs text-tinta-suave">A carregar os documentos do curso…</p>}
            {docsEstado === "ok" && docsCurso.length === 0 && <p className="m-0 text-xs text-tinta-suave">Este curso não tem documentos definidos na ficha do curso.</p>}
            {docsCurso.length > 0 && (
              <ul className="m-0 p-0 list-none rounded-cartao border border-linha divide-y divide-linha-suave">
                {docsCurso.map(d => {
                  const f = ficheiros[d.id];
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm text-tinta">{d.label}
                          <span className={d.required ? "text-perigo font-semibold" : "text-tinta-suave"}> · {d.required ? "obrigatório" : d.condicional ? "opcional (condicional)" : "opcional"}</span>
                        </p>
                        {f && <p className="m-0 text-xs text-tinta-suave truncate" title={f.name}>{f.name}</p>}
                      </div>
                      {f && <Botao tamanho="sm" variante="fantasma" onClick={() => setFicheiros(x => { const n = { ...x }; delete n[d.id]; return n; })}>Tirar</Botao>}
                      <Botao tamanho="sm" variante={f ? "fantasma" : "secundario"} onClick={() => { setAlvoDoc(d.id); escolhaDoc.current?.click(); }}>
                        {f ? "Trocar" : "Carregar"}
                      </Botao>
                    </li>
                  );
                })}
              </ul>
            )}
            <input ref={escolhaOutros} type="file" multiple accept={ACEITA} className="sr-only" tabIndex={-1} aria-hidden="true"
              onChange={e => {
                const fs = [...(e.target.files ?? [])];
                e.target.value = "";
                setOutros(x => [...x, ...fs.map((f, i) => ({ chave: `${Date.now()}-${i}-${f.name}`, ficheiro: f, nome: semExtensao(f.name) }))]);
              }} />
            {outros.length > 0 && (
              <ul className="m-0 p-0 list-none flex flex-col gap-2">
                {outros.map(o => (
                  <li key={o.chave} className="flex items-center gap-2">
                    <Entrada aria-label={`Nome do documento ${o.ficheiro.name}`} value={o.nome} maxLength={120}
                      onChange={e => setOutros(x => x.map(y => (y.chave === o.chave ? { ...y, nome: e.target.value } : y)))} />
                    <Botao tamanho="sm" variante="fantasma" onClick={() => setOutros(x => x.filter(y => y.chave !== o.chave))}>Tirar</Botao>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <Botao tamanho="sm" variante="fantasma" onClick={() => escolhaOutros.current?.click()}>Anexar outros documentos</Botao>
            </div>
            <p className="m-0 text-xs text-tinta-suave">Os ficheiros vão para a Drive, na pasta do formando, e ficam validados. Os obrigatórios do curso são precisos para criar a ficha.</p>
            {erros.docs && <Aviso tom="perigo">{erros.docs}</Aviso>}
          </div>
        )}
        {gold && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-tinta">Pagamento</span>
            <Separadores<Pagamento>
              rotulo="Pagamento"
              estilo="pilula"
              ativo={pagamento}
              onMudar={setPagamento}
              itens={[{ id: "por_pagar", rotulo: "Por pagar" }, { id: "pago", rotulo: "Já pago" }, { id: "oferta", rotulo: "Oferta" }]}
            />
            {pagamento === "por_pagar" && <p className="m-0 text-xs text-tinta-suave">Fica com o preço do curso. Na ficha pode pedir o pagamento por email (IBAN) e registá-lo quando chegar.</p>}
            {pagamento === "oferta" && <p className="m-0 text-xs text-tinta-suave">Oferecido pela ENA: fica a 0 € e já regularizado.</p>}
            {pagamento === "pago" && (
              <Campo rotulo="Como foi pago" obrigatorio erro={erros.metodo}>
                {p => <Selecao {...p} opcoes={metodos.selecao} vazio="Escolher…" value={metodo} onChange={e => setMetodo(e.target.value)} />}
              </Campo>
            )}
          </div>
        )}
        <Caixa
          rotulo="Sem emails de documentos nem de pagamento"
          ajuda="Para inscrições já tratadas pela equipa (ex.: plataforma antiga): o formando não recebe pedidos nem lembretes de documentos, emails de pagamento nem o email do registo no Netforce (CCP). Os documentos carregam-se na ficha. Os outros emails da turma continuam."
          checked={semEmails}
          onChange={e => setSemEmails(e.target.checked)}
        />
        {podeAcesso && <Caixa
          rotulo="Criar o acesso à área do formando e enviar por email"
          ajuda="Utilizador: o email. Palavra-passe temporária, a mudar no primeiro acesso."
          checked={criarAcesso}
          onChange={e => setCriarAcesso(e.target.checked)}
        />}
        {cursos.erro != null && <Aviso tom="perigo">Não foi possível carregar os cursos. Feche e abra de novo.</Aviso>}
      </div>
    </Modal>
  );
}
