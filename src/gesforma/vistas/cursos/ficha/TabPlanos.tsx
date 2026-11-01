// Planos de sessão da ficha do curso, organizados por módulo: cada módulo tem os seus planos (Plano 1, Plano 2…) e um
// plano pode ser de mais do que um módulo. No cronograma da turma cada sessão marca-se com um plano.
import { useMemo, useState, type ReactNode } from "react";
import { MultiSearchSelect } from "../../../../partilhado/FormKit";
import { AreaTexto, Botao, Campo, Cartao, Entrada, Vazio } from "../../../../partilhado/ui";
import type { MomentoField, MomentoKey } from "../../../../partilhado/TurmaExtras";
import { distribuirTempo, minutosDeTempo, textoDeMinutos } from "../../../../partilhado/duracaoSessao";
import { chaveModuloPlano } from "../../../../partilhado/planosModulo";
import { opcoesDoPrograma } from "../../../cursoPrograma";
import { codigosDoPlano, novoIdPlano, novoPlanoCurso } from "../../../planosCurso";
import type { PlanoLinha } from "./modelo";
import type { FichaCurso } from "./useFichaCurso";

const MOMENTOS: { id: MomentoKey; rotulo: string }[] = [
  { id: "introducao", rotulo: "Introdução" },
  { id: "desenvolvimento", rotulo: "Desenvolvimento" },
  { id: "conclusao", rotulo: "Conclusão" },
];
const CAMPOS_MOMENTO: { id: keyof MomentoField; rotulo: string }[] = [
  { id: "conteudo", rotulo: "Conteúdo programático" },
  { id: "atividades", rotulo: "Atividades" },
  { id: "metodos", rotulo: "Métodos / técnicas pedagógicas" },
  { id: "avaliacao", rotulo: "Avaliação" },
  { id: "recursos", rotulo: "Recursos didáticos" },
  { id: "materiais", rotulo: "Materiais e equipamentos" },
];

const preenchidos = (o: Record<string, string>) => CAMPOS_MOMENTO.filter(c => String(o[c.id] ?? "").trim()).length;

/** Horas e minutos em dois campos numéricos; devolve minutos. */
function HorasMinutos({ minutos, onMudar, rotulo }: { minutos: number; onMudar: (min: number) => void; rotulo: string }) {
  const h = Math.floor(minutos / 60), m = minutos % 60;
  const num = (v: string) => Math.max(0, Math.floor(Number(v.replace(/\D/g, "")) || 0));
  return (
    <span className="inline-flex items-center gap-1">
      <Entrada aria-label={`${rotulo}: horas`} type="number" min={0} max={23} inputMode="numeric" className="w-16" value={minutos ? String(h) : ""} placeholder="0"
        onChange={e => onMudar(Math.min(23, num(e.target.value)) * 60 + m)} />
      <span className="text-xs font-semibold text-tinta-suave">h</span>
      <Entrada aria-label={`${rotulo}: minutos`} type="number" min={0} max={59} step={5} inputMode="numeric" className="w-16" value={minutos ? String(m).padStart(2, "0") : ""} placeholder="00"
        onChange={e => onMudar(h * 60 + Math.min(59, num(e.target.value)))} />
      <span className="text-xs font-semibold text-tinta-suave">min</span>
    </span>
  );
}

/** Duração da sessão e o que falta distribuir pelo tempo dos momentos (que tem de somar a duração). */
function TempoDoPlano({ linha, nome, onMudar }: { linha: PlanoLinha; nome: string; onMudar: (p: Partial<PlanoLinha>) => void }) {
  const tempos = Object.fromEntries(MOMENTOS.map(m => [m.id, minutosDeTempo(linha.momentos[m.id].tempo)])) as Record<MomentoKey, number>;
  const soma = MOMENTOS.reduce((a, m) => a + tempos[m.id], 0);
  const comTempos = (t: Record<MomentoKey, number>) => Object.fromEntries(MOMENTOS.map(m => [m.id, { ...linha.momentos[m.id], tempo: textoDeMinutos(t[m.id]) }])) as PlanoLinha["momentos"];
  const mudarDuracao = (duracaoMin: number) => {
    // Momentos ainda vazios, ou repartidos pela duração anterior: repartem-se de novo pela nova.
    const auto = !soma || soma === linha.duracaoMin;
    onMudar(auto ? { duracaoMin, momentos: comTempos(distribuirTempo(duracaoMin)) } : { duracaoMin });
  };
  const falta = linha.duracaoMin - soma;
  return (
    <div className="space-y-2 rounded-controlo border border-linha-suave bg-fundo/40 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold">Duração da sessão</span>
        <HorasMinutos rotulo={`${nome}: duração`} minutos={linha.duracaoMin} onMudar={mudarDuracao} />
        <span className="text-xs text-tinta-suave">A sessão marcada com este plano no cronograma dura este tempo; reparte-se pelo tempo de cada momento (abaixo).</span>
      </div>
      {linha.duracaoMin > 0 && (
        <p className={`m-0 flex flex-wrap items-center gap-2 text-xs ${falta === 0 ? "text-tinta-suave" : "text-red-700"}`}>
          {falta === 0
            ? `Os momentos somam ${textoDeMinutos(soma)}: o tempo da sessão está todo distribuído.`
            : falta > 0
              ? `Faltam distribuir ${textoDeMinutos(falta)} pelos momentos (somam ${textoDeMinutos(soma) || "0 min"} de ${textoDeMinutos(linha.duracaoMin)}).`
              : `Os momentos passam ${textoDeMinutos(-falta)} da duração da sessão (${textoDeMinutos(soma)} de ${textoDeMinutos(linha.duracaoMin)}).`}
          {falta !== 0 && (
            <button type="button" className="font-semibold text-ligacao hover:underline" onClick={() => onMudar({ momentos: comTempos(distribuirTempo(linha.duracaoMin)) })}>
              Distribuir automaticamente
            </button>
          )}
        </p>
      )}
    </div>
  );
}

function Recolhivel({ titulo, resumo, children }: { titulo: string; resumo: string; children: ReactNode }) {
  return (
    <details className="group rounded-controlo border border-linha-suave bg-fundo/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[13px] font-semibold text-tinta">
        <span aria-hidden="true" className="text-tinta-suave transition-transform group-open:rotate-90">›</span>
        {titulo}
        <span className="ml-auto text-xs font-normal text-tinta-suave">{resumo}</span>
      </summary>
      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}


type Grupo = { chave: string; titulo: string; modulos: string[]; planos: PlanoLinha[] };

const chaveGrupo = (modulos: string[]) => modulos.map(chaveModuloPlano).sort().join("+");

/**
 * Os grupos pela ordem do programa: cada módulo com os seus planos; os planos de vários módulos logo a seguir ao
 * primeiro deles; no fim, os planos sem módulo (ou de um módulo que já não está no programa).
 */
function gruposDosPlanos(planos: PlanoLinha[], programa: string[]): Grupo[] {
  const porChave = new Map<string, PlanoLinha[]>();
  for (const p of [...planos].sort((a, b) => a.ordem - b.ordem)) {
    const k = chaveGrupo(p.modulos);
    porChave.set(k, [...(porChave.get(k) ?? []), p]);
  }
  const ordemPrograma = new Map(programa.map((m, i) => [chaveModuloPlano(m), i]));
  const out: Grupo[] = [];
  const usados = new Set<string>();
  programa.forEach(m => {
    const k = chaveModuloPlano(m);
    out.push({ chave: k, titulo: m, modulos: [m], planos: porChave.get(k) ?? [] });
    usados.add(k);
    // Planos de vários módulos cujo primeiro módulo (no programa) é este.
    for (const [kk, lista] of porChave) {
      if (usados.has(kk) || !kk.includes("+")) continue;
      const primeiro = kk.split("+").sort((a, b) => (ordemPrograma.get(a) ?? 999) - (ordemPrograma.get(b) ?? 999))[0];
      if (primeiro !== k) continue;
      out.push({ chave: kk, titulo: codigosDoPlano(lista[0]!), modulos: lista[0]!.modulos, planos: lista });
      usados.add(kk);
    }
  });
  for (const [kk, lista] of porChave) {
    if (usados.has(kk)) continue;
    out.push({ chave: kk, titulo: kk ? codigosDoPlano(lista[0]!) : "Sem módulo", modulos: lista[0]!.modulos, planos: lista });
  }
  return out;
}

/** A ordem dos planos (a do cronograma «por agendar») segue os módulos: grupo a grupo, plano a plano. */
function ordenar(planos: PlanoLinha[], programa: string[]): PlanoLinha[] {
  return gruposDosPlanos(planos, programa).flatMap(g => g.planos).map((p, i) => ({ ...p, ordem: i + 1 }));
}

export function TabPlanos({ f }: { f: FichaCurso }) {
  const { data, patch } = f;
  const programa = useMemo(() => opcoesDoPrograma(data.organizacaoPrograma, data.topicosPrograma), [data.organizacaoPrograma, data.topicosPrograma]);
  const nomesPrograma = programa.map(o => o.value);
  const unidade = data.organizacaoPrograma === "livre" ? "tema" : "módulo";
  const grupos = gruposDosPlanos(data.planosSessao, nomesPrograma);
  const gravar = (lista: PlanoLinha[]) => patch({ planosSessao: ordenar(lista, nomesPrograma) });
  const mudar = (id: string, p: Partial<PlanoLinha>) => gravar(data.planosSessao.map(x => (x.id === id ? { ...x, ...p } : x)));
  const mudarMomento = (linha: PlanoLinha, m: MomentoKey, campo: keyof MomentoField, valor: string) =>
    mudar(linha.id, { momentos: { ...linha.momentos, [m]: { ...linha.momentos[m], [campo]: valor } } });
  // Cada plano recolhe-se: abrem-se só os que se estão a escrever; os vazios começam abertos.
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(data.planosSessao.filter(p => !p.objetivosGerais.trim()).map(p => p.id)));
  const abrir = (id: string) => setAbertos(prev => new Set(prev).add(id));
  const acrescentar = (modulos: string[]) => {
    const novo = novoPlanoCurso(data.planosSessao.length + 1, modulos);
    gravar([...data.planosSessao, novo]);
    abrir(novo.id);
  };

  return (
    <Cartao titulo="Planos de sessão por módulo"
      subtitulo={`Cada ${unidade} tem os seus planos (Plano 1, Plano 2…); um plano pode ser de mais do que um ${unidade}. Nas turmas criadas daqui em diante, os planos ficam «por agendar» no cronograma: ao clicar num dia escolhe-se o plano, e a sessão fica com a duração, os ${unidade}s, o plano e o sumário, já aprovado. As turmas que já existem não mudam.`}>
      <div className="space-y-4">
        {data.planosSessao.length > 1 && (
          <div className="flex justify-end gap-3 text-xs">
            <button type="button" className="font-semibold text-ligacao hover:underline" onClick={() => setAbertos(new Set(data.planosSessao.map(p => p.id)))}>Abrir todos</button>
            <button type="button" className="font-semibold text-ligacao hover:underline" onClick={() => setAbertos(new Set())}>Recolher todos</button>
          </div>
        )}
        {!grupos.length && <Vazio compacto titulo="Ainda sem planos." descricao={`Defina o programa (separador Programa) para acrescentar planos a cada ${unidade}.`} />}
        {grupos.map(g => {
          const total = g.planos.reduce((a, p) => a + p.duracaoMin, 0);
          return (
            <section key={g.chave || "sem"} className="rounded-controlo border border-linha bg-fundo/30">
              <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="m-0 text-[14px] font-semibold text-tinta">{g.titulo}</p>
                  <p className="m-0 text-xs text-tinta-suave">
                    {g.planos.length ? `${g.planos.length} ${g.planos.length === 1 ? "plano" : "planos"}${total ? ` · ${textoDeMinutos(total)}` : ""}` : "Sem planos"}
                  </p>
                </div>
                <Botao tamanho="sm" variante="secundario" onClick={() => acrescentar(g.modulos)}>Acrescentar plano</Botao>
              </header>
              {g.planos.length > 0 && (
                <div className="space-y-2 px-3 pb-3">
                  {g.planos.map((linha, k) => {
                    const nome = `${g.chave ? codigosDoPlano(linha) : "Sem módulo"} · Plano ${k + 1}`;
                    return (
                      <details key={linha.id} open={abertos.has(linha.id)}
                        onToggle={e => { const aberto = (e.currentTarget as HTMLDetailsElement).open; setAbertos(prev => { const n = new Set(prev); if (aberto) n.add(linha.id); else n.delete(linha.id); return n; }); }}
                        className="group/plano rounded-controlo border border-linha bg-white">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
                          <p className="m-0 min-w-0 text-[13px] font-semibold">
                            <span aria-hidden="true" className="mr-1.5 inline-block text-tinta-suave transition-transform group-open/plano:rotate-90">›</span>
                            Plano {k + 1}
                            <span className="font-normal text-tinta-suave">{linha.duracaoMin ? ` · ${textoDeMinutos(linha.duracaoMin)}` : " · duração por definir"}</span>
                            {!abertos.has(linha.id) && linha.objetivosGerais.trim() && (
                              <span className="mt-0.5 block truncate text-xs font-normal text-tinta-suave">{linha.objetivosGerais.trim()}</span>
                            )}
                          </p>
                          <span className="flex shrink-0 gap-1">
                            <Botao tamanho="sm" variante="fantasma" onClick={e => {
                              e.preventDefault();
                              const copia = { ...linha, id: novoIdPlano() };
                              const i = data.planosSessao.findIndex(x => x.id === linha.id);
                              gravar([...data.planosSessao.slice(0, i + 1), copia, ...data.planosSessao.slice(i + 1)].map((x, j) => ({ ...x, ordem: j + 1 })));
                              abrir(copia.id);
                            }}>Duplicar</Botao>
                            <Botao tamanho="sm" variante="fantasma" onClick={e => { e.preventDefault(); gravar(data.planosSessao.filter(x => x.id !== linha.id)); }}>Remover</Botao>
                          </span>
                        </summary>
                        <div className="space-y-2 border-t border-linha-suave p-3">
                          {programa.length > 0 && (
                            <Campo rotulo={unidade === "tema" ? "Temas" : "Módulos"} ajuda={`O plano pertence a estes ${unidade}s (mude aqui para o passar para outro ${unidade} ou juntar mais do que um).`}>
                              {() => (
                                <MultiSearchSelect values={linha.modulos} onChange={v => mudar(linha.id, { modulos: v })} options={programa}
                                  placeholder={`Pesquisar ${unidade}…`} noneLabel={`Sem ${unidade}`} unitSingular={unidade} unitPlural={`${unidade}s`} />
                              )}
                            </Campo>
                          )}
                          <TempoDoPlano linha={linha} nome={nome} onMudar={p => mudar(linha.id, p)} />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <AreaTexto aria-label={`${nome}: objetivos gerais`} rows={2} placeholder="Objetivos gerais" value={linha.objetivosGerais} onChange={e => mudar(linha.id, { objetivosGerais: e.target.value })} />
                            <AreaTexto aria-label={`${nome}: objetivos específicos`} rows={2} placeholder="Objetivos específicos" value={linha.objetivosEspecificos} onChange={e => mudar(linha.id, { objetivosEspecificos: e.target.value })} />
                          </div>
                          {MOMENTOS.map(m => (
                            <Recolhivel key={m.id} titulo={m.rotulo}
                              resumo={[textoDeMinutos(minutosDeTempo(linha.momentos[m.id].tempo)), `${preenchidos(linha.momentos[m.id])} de ${CAMPOS_MOMENTO.length} campos`].filter(Boolean).join(" · ")}>
                              {CAMPOS_MOMENTO.map(c => (
                                <AreaTexto key={c.id} aria-label={`${nome}, ${m.rotulo}: ${c.rotulo}`} rows={2} placeholder={c.rotulo}
                                  value={linha.momentos[m.id][c.id]} onChange={e => mudarMomento(linha, m.id, c.id, e.target.value)} />
                              ))}
                              <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-tinta-suave">
                                Tempo
                                <HorasMinutos rotulo={`${nome}, ${m.rotulo}: tempo`} minutos={minutosDeTempo(linha.momentos[m.id].tempo)}
                                  onMudar={v => mudarMomento(linha, m.id, "tempo", textoDeMinutos(v))} />
                              </label>
                            </Recolhivel>
                          ))}
                          <Recolhivel titulo="Sumário padrão" resumo={linha.sumario.conteudos.trim() || linha.sumario.atividades.trim() ? "Preenchido" : "Opcional"}>
                            <AreaTexto aria-label={`${nome}: sumário, conteúdos`} rows={3} placeholder="Conteúdos abordados" value={linha.sumario.conteudos}
                              onChange={e => mudar(linha.id, { sumario: { ...linha.sumario, conteudos: e.target.value } })} />
                            <AreaTexto aria-label={`${nome}: sumário, atividades`} rows={3} placeholder="Atividades realizadas" value={linha.sumario.atividades}
                              onChange={e => mudar(linha.id, { sumario: { ...linha.sumario, atividades: e.target.value } })} />
                            <p className="m-0 text-xs text-tinta-suave sm:col-span-2">Gold: fica como sumário da sessão; o formador só tem de o assinar (ou acrescentar as observações).</p>
                          </Recolhivel>
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {!programa.length && (
          <Botao variante="secundario" tamanho="sm" onClick={() => acrescentar([])}>Acrescentar plano</Botao>
        )}
      </div>
    </Cartao>
  );
}
