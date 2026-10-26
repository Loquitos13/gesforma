import { useMemo, useState } from "react";
import { apiCreateDtpEntidade, apiDtpEntidades } from "../../../../partilhado/api";
import { apiCriarItem } from "../../../../partilhado/api/catalogos";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../../partilhado/dados/useRecurso";
import { MultiSearchSelect } from "../../../../partilhado/FormKit";
import { toastError } from "../../../../partilhado/toastBus";
import { lembrarPrograma, ordenarPorRecentes, programasRecentes } from "../../../programasRecentes";
import { Botao, Campo, Cartao, Entrada, Estado, Modal, Selecao, SelecaoPesquisa, Vazio, data as fmtData, type OpcaoSelecao } from "../../../../partilhado/ui";
import type { Opcao } from "../../../../partilhado/api/catalogos";
import { localDoElearning, OPCOES_SINCRONIA, regimeSincronia } from "../../../../partilhado/regimeSincronia";
import type { ContactosLocal } from "./modelo";
import type { FichaCurso } from "./useFichaCurso";
import { CONTACTOS_LOCAL } from "../../../../partilhado/contactosLocal";

const CAMPOS_CONTACTO = CONTACTOS_LOCAL.map(([campo, rotulo]) => [campo, rotulo, campo === "email" ? "email" : "tel"] as const);

/**
 * Contactos para dúvidas de cada local deste curso (aparecem no cartão do local na página do curso).
 * Por omissão são os de Edição de cursos › Locais; o que se escreve aqui vale só para este curso, campo a campo,
 * e só enquanto o local estiver atribuído ao curso.
 */
function ContactosDosLocais({ f, locais }: { f: FichaCurso; locais: Opcao[] }) {
  const { data, patch } = f;
  if (!data.locais.length) return null;
  const doCatalogo = (local: string) => locais.find(o => o.valor.toLowerCase() === local.toLowerCase())?.extra ?? {};
  const mudar = (local: string, campo: keyof ContactosLocal, valor: string) => {
    const guardados = (data.contactosLocais ?? {})[local] as Partial<ContactosLocal> | undefined;
    const atual: ContactosLocal = { telemovel: "", telefone: "", email: "", whatsapp: "", ...guardados };
    const novo = { ...atual, [campo]: valor };
    const resto = { ...data.contactosLocais };
    if (Object.values(novo).some(v => v.trim())) resto[local] = novo; else delete resto[local];
    patch({ contactosLocais: resto });
  };
  const repor = (local: string) => {
    const resto = { ...data.contactosLocais };
    delete resto[local];
    patch({ contactosLocais: resto });
  };
  return (
    <Cartao titulo="Contactos de cada local" subtitulo="Aparecem no cartão do local na página do curso. Por omissão são os de Edição de cursos › Locais; o que escrever aqui muda-os só neste curso.">
      <div className="flex flex-col gap-5">
        {data.locais.map(local => {
          const base = doCatalogo(local);
          const proprios = data.contactosLocais?.[local];
          return (
            <fieldset key={local} className="m-0 border-0 border-t border-linha p-0 pt-4 first:border-t-0 first:pt-0">
              <legend className="flex w-full items-center gap-2 text-sm font-bold">
                {local}
                {proprios && <Estado tom="info">Contactos deste curso</Estado>}
              </legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CAMPOS_CONTACTO.map(([campo, rotulo, tipo]) => (
                  <Campo key={campo} rotulo={rotulo}>
                    {p => (
                      <Entrada {...p} type={tipo} value={proprios?.[campo] ?? ""} placeholder={String(base[campo] ?? "") || "—"}
                        onChange={e => mudar(local, campo, e.target.value)} />
                    )}
                  </Campo>
                ))}
              </div>
              {proprios && (
                <div className="mt-2">
                  <Botao tamanho="sm" variante="fantasma" onClick={() => repor(local)}>Usar os do local</Botao>
                </div>
              )}
            </fieldset>
          );
        })}
        <p className="m-0 text-[13px] text-tinta-suave">Em cinzento, os contactos do local. Um campo vazio usa o do local. Se tirar o local deste curso, os contactos daqui deixam de contar.</p>
      </div>
    </Cartao>
  );
}

/** Mantém o valor actual visível mesmo que já não esteja nas opções. */
function comValor(opcoes: OpcaoSelecao[], valor: string) {
  return !valor || opcoes.some(o => o.valor === valor) ? opcoes : [{ valor, rotulo: valor }, ...opcoes];
}

export function TabOferta({ f }: { f: FichaCurso }) {
  const { data, patch, falhas, regime, turmas } = f;
  const tipos = useOpcoes("lista", { lista: "tipos_curso" });
  // A categoria do curso é uma das Áreas Temáticas do regime (Gold › Áreas Temáticas ou Financiada › Áreas Temáticas);
  // é por ela que o site sugere cursos relacionados.
  const categorias = useOpcoes("areas", { regime });
  const modalidades = useOpcoes("lista", { lista: "regimes_curso" });
  const locais = useOpcoes("locais", { regime });
  const horarios = useOpcoes("horarios", { regime: "gold" });
  const programas = useOpcoes("programas", { regime: "fin" });
  const [novoLocal, setNovoLocal] = useState<{ nome: string; morada: string } | null>(null);
  const [aCriar, setACriar] = useState(false);

  const locaisPreco = useMemo(() => [...new Set([...data.locais, ...turmas.map(t => t.local)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt")), [data.locais, turmas]);
  const horariosPreco = useMemo(() => [...new Set([...horarios.opcoes.map(h => h.valor), ...turmas.map(t => t.horario)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt")), [horarios.opcoes, turmas]);

  async function criarLocal() {
    if (!novoLocal?.nome.trim()) return;
    setACriar(true);
    try {
      const nome = novoLocal.nome.trim();
      if (!locais.opcoes.some(o => o.valor.toLowerCase() === nome.toLowerCase())) {
        await apiCriarItem("locais", regime, { nome, morada: novoLocal.morada.trim(), salas: 0, status: "Ativo" });
        invalidar("opcoes:locais");
        invalidar(`catalogo:locais:${regime}`);
      }
      if (!data.locais.includes(nome)) patch({ locais: [...data.locais, nome] });
      setNovoLocal(null);
    } catch (e) {
      toastError(e, "Não foi possível criar o local.");
    } finally {
      setACriar(false);
    }
  }

  // E-learning síncrono decorre na Sala Virtual (aulas online); assíncrono é só o Moodle: o local é fixo.
  const localFixo = localDoElearning(data.regime, data.regimeSincronia);
  const comLocalElearning = (p: Partial<typeof data>) => {
    const local = localDoElearning(p.regime ?? data.regime, p.regimeSincronia ?? data.regimeSincronia);
    return local ? { ...p, locais: [local] } : p;
  };

  return (
    <div className="space-y-4">
      <Cartao titulo="Dados da oferta" subtitulo={regime === "fin" ? "Curso financiado (UFCD). Os campos com * são obrigatórios." : "Curso Gold (autofinanciado). Os campos com * são obrigatórios."}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {regime === "gold" && (
            <Campo rotulo="Tipo comercial" obrigatorio erro={falhas.tipo} ajuda="Pré-inscrição grava o pedido; Pré-pago abre o pagamento; Acesso direto não abre formulário.">
              {p => <Selecao {...p} opcoes={comValor(tipos.selecao, data.tipo)} vazio="Escolher…" value={data.tipo} onChange={e => patch({ tipo: e.target.value })} />}
            </Campo>
          )}
          <Campo rotulo="Área temática" obrigatorio erro={falhas.categoria} ajuda="As áreas criam-se em Áreas Temáticas, no menu do regime.">

            {p => <Selecao {...p} opcoes={comValor(categorias.selecao, data.categoria)} vazio="Escolher…" value={data.categoria} onChange={e => patch({ categoria: e.target.value })} />}
          </Campo>
          <Campo rotulo="Modalidade" obrigatorio erro={falhas.regime}>
            {p => <Selecao {...p} opcoes={comValor(modalidades.selecao, data.regime)} vazio="Escolher…" value={data.regime} onChange={e => patch(comLocalElearning({ regime: e.target.value }))} />}
          </Campo>
          <Campo rotulo="Regime" ajuda="Síncrono: sessões em tempo real com o formador. Assíncrono: o formando segue ao seu ritmo. Misto: aulas online síncronas (Sala Virtual) e tarefas de e-learning no Moodle.">
            {p => <Selecao {...p} opcoes={[...OPCOES_SINCRONIA]} vazio="Por definir" value={data.regimeSincronia} onChange={e => patch(comLocalElearning({ regimeSincronia: regimeSincronia(e.target.value) }))} />}
          </Campo>
          {regime === "fin" && (
            <Campo rotulo="Programa" ajuda="Programa, prioridade e tipologias dos documentos das turmas deste curso (Edição de cursos › Programas). Cada turma pode escolher outro; sem programa, vale o primeiro activo.">
              {p => <SelecaoPesquisa {...p} opcoes={comValor(ordenarPorRecentes(programas.selecao, programasRecentes()), data.programaFin)} vazio="Sem programa" placeholder="Pesquisar programa…" value={data.programaFin} onChange={v => { lembrarPrograma(v); patch({ programaFin: v }); }} />}
            </Campo>
          )}
          {regime === "gold" && (
            <Campo rotulo="Preço (€)" obrigatorio erro={falhas.preco}>
              {p => <Entrada {...p} type="number" min={0} step="0.01" value={data.preco} onChange={e => patch({ preco: e.target.value })} />}
            </Campo>
          )}
          <Campo rotulo="Horas" obrigatorio erro={falhas.horas}>
            {p => <Entrada {...p} type="number" min={1} step={1} value={data.horas} onChange={e => patch({ horas: e.target.value })} />}
          </Campo>
          <Campo rotulo="Tags" obrigatorio erro={falhas.tags} ajuda="Separadas por vírgulas.">
            {p => <Entrada {...p} value={data.tags} onChange={e => patch({ tags: e.target.value })} />}
          </Campo>
        </div>
        {regime === "gold" && <EntidadeResponsavel f={f} />}
        <div className="mt-4">
          <Campo rotulo="Locais deste curso" obrigatorio erro={falhas.locais}
            ajuda={localFixo
              ? (localFixo === "Sala Virtual"
                ? (data.regimeSincronia === "misto" ? "E-learning misto: aulas online na Sala Virtual e tarefas no Moodle." : "E-learning síncrono: as aulas são online, na Sala Virtual.")
                : "E-learning assíncrono: só acesso ao Moodle.")
              : "Pelo menos um. Horário, datas e vagas definem-se na turma."}>
            {() => localFixo ? <p className="m-0 text-sm font-semibold text-tinta">{localFixo}</p> : (
              <MultiSearchSelect
                values={data.locais}
                onChange={v => patch({ locais: v })}
                options={locais.opcoes.map(o => ({ value: o.valor, sub: String(o.extra?.morada ?? "") }))}
                placeholder="Pesquisar local…"
                noneLabel="Escolher locais…"
                unitSingular="local"
                unitPlural="locais"
                onAdd={() => setNovoLocal({ nome: "", morada: "" })}
                addLabel="Novo local"
              />
            )}
          </Campo>
        </div>
      </Cartao>

      <ContactosDosLocais f={f} locais={locais.opcoes} />

      {regime === "gold" && (
        <Cartao titulo="Preço por local e horário" subtitulo="O preço acima vale para o curso inteiro. Aqui fixa outro valor para um local, um horário ou os dois; a regra mais específica ganha.">
          {data.precosOferta.length === 0 && <p className="m-0 mb-3 text-[13px] text-tinta-suave">Sem preços especiais: a pré-inscrição usa o preço do curso.</p>}
          <div className="space-y-2">
            {data.precosOferta.map(row => {
              const mudar = (p: Partial<typeof row>) => patch({ precosOferta: data.precosOferta.map(x => (x.id === row.id ? { ...x, ...p } : x)) });
              return (
                <div key={row.id} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
                  <Campo rotulo="Local">{p => <Selecao {...p} opcoes={comValor(locaisPreco.map(v => ({ valor: v, rotulo: v })), row.local)} vazio="Qualquer local" value={row.local} onChange={e => mudar({ local: e.target.value })} />}</Campo>
                  <Campo rotulo="Horário">{p => <Selecao {...p} opcoes={comValor(horariosPreco.map(v => ({ valor: v, rotulo: v })), row.horario)} vazio="Qualquer horário" value={row.horario} onChange={e => mudar({ horario: e.target.value })} />}</Campo>
                  <Campo rotulo="Preço (€)">{p => <Entrada {...p} type="number" min={0} value={row.preco} onChange={e => mudar({ preco: e.target.value })} />}</Campo>
                  <Botao variante="fantasma" onClick={() => patch({ precosOferta: data.precosOferta.filter(x => x.id !== row.id) })}>Remover</Botao>
                </div>
              );
            })}
          </div>
          {falhas.precosOferta && <p role="alert" className="m-0 mt-2 text-xs text-perigo">{falhas.precosOferta}</p>}
          <Botao className="mt-3" variante="secundario" tamanho="sm" onClick={() => patch({ precosOferta: [...data.precosOferta, { id: `preco-${Date.now()}`, local: "", horario: "", preco: data.preco }] })}>
            Acrescentar preço
          </Botao>
        </Cartao>
      )}

      <Cartao titulo="Valor base por formador" subtitulo="Interno: não aparece no site. A turma pode sobrepor este valor.">
        <div className="space-y-2">
          {data.valoresFormador.map((row, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_auto]">
              <Entrada aria-label="Formador" placeholder="Nome do formador" value={row.nome} onChange={e => patch({ valoresFormador: data.valoresFormador.map((v, j) => (j === i ? { ...v, nome: e.target.value } : v)) })} />
              <Entrada aria-label="Valor por hora" type="number" min={0} step="0.5" placeholder="€/h" value={row.valorHora} onChange={e => patch({ valoresFormador: data.valoresFormador.map((v, j) => (j === i ? { ...v, valorHora: e.target.value } : v)) })} />
              <Botao variante="fantasma" onClick={() => patch({ valoresFormador: data.valoresFormador.filter((_, j) => j !== i) })}>Remover</Botao>
            </div>
          ))}
        </div>
        <Botao className="mt-3" variante="secundario" tamanho="sm" onClick={() => patch({ valoresFormador: [...data.valoresFormador, { nome: "", valorHora: "" }] })}>Acrescentar formador</Botao>
      </Cartao>

      <Cartao titulo="Turmas deste curso" subtitulo="No site, o visitante escolhe o local e depois o horário das turmas abertas.">
        {turmas.length === 0 ? <Vazio compacto titulo="Ainda não há turmas deste curso." descricao="Quando houver turmas abertas, aparecem aqui e na página do curso." /> : (
          <ul className="m-0 list-none divide-y divide-linha-suave p-0">
            {turmas.map(t => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="block font-semibold">{[t.local, t.horario].filter(Boolean).join(" · ") || t.nome}</span>
                  <span className="num block text-xs text-tinta-suave">{t.nome} · início {fmtData(t.inicio)} · {Math.max(0, t.vagas - t.inscritos)} vagas livres</span>
                </span>
                <Estado tom={t.fechada ? "neutro" : "sucesso"} ponto>{t.fechada ? "Fechada" : "Aberta"}</Estado>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Modal
        aberto={Boolean(novoLocal)}
        onFechar={() => setNovoLocal(null)}
        titulo="Novo local"
        largura="sm"
        rodape={(
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setNovoLocal(null)}>Cancelar</Botao>
            <Botao variante="primario" aCarregar={aCriar} disabled={!novoLocal?.nome.trim()} onClick={() => void criarLocal()}>Criar e associar</Botao>
          </div>
        )}
      >
        <div className="space-y-3">
          <Campo rotulo="Nome" obrigatorio>{p => <Entrada {...p} autoFocus value={novoLocal?.nome ?? ""} onChange={e => setNovoLocal(x => (x ? { ...x, nome: e.target.value } : x))} />}</Campo>
          <Campo rotulo="Morada ou plataforma" ajuda="Opcional. Pode completar em Edição de cursos › Locais.">{p => <Entrada {...p} value={novoLocal?.morada ?? ""} onChange={e => setNovoLocal(x => (x ? { ...x, morada: e.target.value } : x))} />}</Campo>
        </div>
      </Modal>
    </div>
  );
}

function EntidadeResponsavel({ f }: { f: FichaCurso }) {
  const { dados, recarregar } = useRecurso("dtp:entidades:gold", () => apiDtpEntidades());
  const entidades = dados?.entidades ?? [];
  const [nova, setNova] = useState<string | null>(null);

  async function criar() {
    if (!nova?.trim()) return;
    try {
      const r = await apiCreateDtpEntidade(nova.trim());
      recarregar();
      await f.mudarEntidade(r.entidade.id);
      setNova(null);
    } catch (e) {
      toastError(e, "Não foi possível criar a entidade.");
    }
  }

  return (
    <div className="mt-4 grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto]">
      <Campo rotulo="Entidade responsável" ajuda="As turmas deste curso usam a estrutura de dossiê dessa entidade.">
        {p => (
          <Selecao {...p} vazio="Sem entidade responsável" opcoes={entidades.map(e => ({ valor: String(e.id), rotulo: e.nome }))}
            value={f.entidadeId == null ? "" : String(f.entidadeId)} onChange={e => void f.mudarEntidade(e.target.value ? Number(e.target.value) : null)} />
        )}
      </Campo>
      {nova == null ? <Botao variante="secundario" onClick={() => setNova("")}>Nova entidade</Botao> : (
        <div className="flex gap-2">
          <Entrada aria-label="Nome da nova entidade" autoFocus value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void criar(); }} />
          <Botao variante="primario" onClick={() => void criar()}>Criar</Botao>
        </div>
      )}
    </div>
  );
}
