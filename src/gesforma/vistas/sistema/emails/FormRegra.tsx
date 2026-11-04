// Criar ou editar uma regra: gatilho, atraso, modelo e curso, com a pré-visualização do modelo escolhido.
import { useRef, useState } from "react";
import { apiAlterarRegra, apiAnexarRegra, apiCriarRegra, apiPrevisualizarEmail, apiTirarAnexoRegra, type OpcoesEmail, type RegraEmail } from "../../../../partilhado/api/emails";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { invalidar, useRecurso } from "../../../../partilhado/dados/useRecurso";
import { toastError } from "../../../../partilhado/toastBus";
import { ROTULO_AREA_EMAIL, eAreaEmail, type AreaEmail } from "../../../../partilhado/emailAreas";
import { GRUPOS_EQUIPA, ROTULO_GRUPO, eAvisoEquipa, gruposPorOmissao, type GrupoEquipa } from "../../../../partilhado/equipasAviso";
import { Botao, Caixa, Campo, Chip, Entrada, Modal, Selecao } from "../../../../partilhado/ui";
import { MolduraEmail } from "./Previsualizacao";

export function FormRegra({ regra, opcoes, onFechar }: { regra: RegraEmail | null; opcoes: OpcoesEmail; onFechar: () => void }) {
  const areas = opcoes.areas ?? [];
  const [f, setF] = useState({
    area: (regra?.area ?? areas[0] ?? "gold") as AreaEmail,
    nome: regra?.nome ?? "",
    gatilho: regra?.gatilho ?? "",
    templateTipo: regra?.template ?? "",
    atraso: regra?.atraso ?? opcoes.atrasos[0] ?? "",
    cursos: regra?.cursos ?? (regra?.curso ? [regra.curso] : []),
    ativo: regra?.ativo ?? true,
    dias: regra?.dias == null ? "" : String(regra.dias),
    destinatarios: (regra?.destinatarios ?? null) as GrupoEquipa[] | null,
  });
  const cursos = useOpcoes("cursos");
  const criar = useAccao(apiCriarRegra, { ok: "Regra criada.", invalidar: ["emails:"] });
  const alterar = useAccao(apiAlterarRegra, { ok: "Regra gravada.", invalidar: ["emails:"] });
  const { dados: prev, aCarregar } = useRecurso(
    f.templateTipo ? `emails:prev:${f.area}:${f.templateTipo}:${f.cursos[0] ?? ""}` : null,
    signal => apiPrevisualizarEmail({ tipo: f.templateTipo, area: f.area, curso: f.cursos[0] ?? null }, signal),
  );
  // Documentos anexados à regra (seguem com cada email). Numa regra nova, depois de a gravar.
  const [anexos, setAnexos] = useState(regra?.anexos ?? []);
  const [aAnexar, setAAnexar] = useState(false);
  const ficheiroRef = useRef<HTMLInputElement>(null);
  async function anexar(ficheiro: File | undefined) {
    if (!regra || !ficheiro) return;
    if (ficheiro.size > 8 * 1024 * 1024) { toastError(new Error("O ficheiro tem mais de 8 MB.")); return; }
    setAAnexar(true);
    try {
      const r = await apiAnexarRegra(regra.id, ficheiro);
      setAnexos(a => [...a, { id: r.id, nome: ficheiro.name, mime: ficheiro.type, tamanho: ficheiro.size }]);
      invalidar("emails:");
    } catch (err) {
      toastError(err, "Não foi possível anexar.");
    } finally {
      setAAnexar(false);
      if (ficheiroRef.current) ficheiroRef.current.value = "";
    }
  }
  async function tirar(anexoId: number) {
    if (!regra) return;
    try {
      await apiTirarAnexoRegra(regra.id, anexoId);
      setAnexos(a => a.filter(x => x.id !== anexoId));
      invalidar("emails:");
    } catch (err) {
      toastError(err, "Não foi possível tirar o anexo.");
    }
  }
  const gatilho = opcoes.gatilhos.find(g => g.valor === f.gatilho);
  // Regras com prazo: em vez do atraso, os dias antes (ou depois) da data de referência.
  const prazo = gatilho ? opcoes.prazos?.[gatilho.evento] : undefined;
  // Avisos internos: a quem vai (as equipas; nunca a administração). Sem escolha, as da área.
  const aviso = gatilho ? eAvisoEquipa(gatilho.evento) : false;
  const grupos = f.destinatarios ?? (gatilho ? gruposPorOmissao(gatilho.evento, f.area) : []);
  const alternar = (g: GrupoEquipa, sim: boolean) => setF({ ...f, destinatarios: sim ? [...new Set([...grupos, g])] : grupos.filter(x => x !== g) });
  const valido = f.nome.trim().length > 1 && f.gatilho && f.templateTipo && (!aviso || grupos.length > 0);

  async function gravar() {
    const corpo = {
      ...f, nome: f.nome.trim(), curso: null, cursos: f.cursos, dias: prazo && f.dias.trim() !== "" ? Math.max(0, Math.min(365, Number(f.dias) || 0)) : null,
      destinatarios: aviso ? grupos : null,
    };
    const r = regra ? await alterar.correr(regra.id, corpo) : await criar.correr(corpo);
    if (r) onFechar();
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      largura="lg"
      titulo={regra ? `Editar regra · ${regra.nome}` : "Nova regra"}
      rodape={(
        <>
          <Botao onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" disabled={!valido} aCarregar={criar.aCorrer || alterar.aCorrer} onClick={() => void gravar()}>Gravar</Botao>
        </>
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          {areas.length > 1 && (
            <Campo rotulo="Área" ajuda={regra ? "A área de uma regra não muda: crie outra na área certa." : "A regra trata as pessoas desta área (Gold ou Financiada) com os emails dela."}>
              {a => <Selecao {...a} disabled={Boolean(regra)} value={f.area} opcoes={areas.map(x => ({ valor: x, rotulo: ROTULO_AREA_EMAIL[x] }))}
                onChange={e => { if (eAreaEmail(e.target.value)) setF({ ...f, area: e.target.value, templateTipo: "" }); }} />}
            </Campo>
          )}
          <Campo rotulo="Nome da regra" obrigatorio>{a => <Entrada {...a} value={f.nome} maxLength={160} onChange={e => setF({ ...f, nome: e.target.value })} data-autofocus />}</Campo>
          <Campo rotulo="Quando" obrigatorio ajuda={gatilho?.descricao}>
            {a => <Selecao {...a} vazio="Escolha o momento" opcoes={opcoes.gatilhos.map(g => ({ valor: g.valor, rotulo: g.valor }))} value={f.gatilho} onChange={e => setF({ ...f, gatilho: e.target.value, destinatarios: null })} />}
          </Campo>
          {prazo ? (
            <Campo rotulo={`Dias ${prazo.sentido} ${prazo.referencia}`} ajuda={`Vazio: ${prazo.dias} ${prazo.dias === 1 ? "dia" : "dias"}. O envio sai na volta diária dos emails; cada pessoa recebe esta regra uma só vez.`}>
              {a => <Entrada {...a} type="number" min={0} max={365} placeholder={String(prazo.dias)} value={f.dias} onChange={e => setF({ ...f, dias: e.target.value })} />}
            </Campo>
          ) : (
            <Campo rotulo="Atraso" ajuda="Os envios com atraso saem na volta diária seguinte (07:00 UTC, ≈ 08:00 em Lisboa no verão): um atraso de horas pode chegar só no dia seguinte.">
              {a => <Selecao {...a} opcoes={opcoes.atrasos.map(v => ({ valor: v, rotulo: v }))} value={f.atraso} onChange={e => setF({ ...f, atraso: e.target.value })} />}
            </Campo>
          )}
          {aviso && (
            <fieldset className="m-0 space-y-1.5 border-0 p-0">
              <legend className="mb-1 text-[13px] font-medium text-tinta">Enviar para</legend>
              {GRUPOS_EQUIPA.map(g => (
                <Caixa key={g} rotulo={ROTULO_GRUPO[g]} checked={grupos.includes(g)} onChange={e => alternar(g, e.target.checked)} />
              ))}
              <p className="m-0 text-xs text-tinta-suave">Cada utilizador activo destas equipas recebe o aviso no seu email. A administração não recebe.</p>
            </fieldset>
          )}
          <Campo rotulo="Modelo" obrigatorio>
            {a => <Selecao {...a} vazio="Escolha o modelo" opcoes={opcoes.modelos.filter(m => m.area === f.area).map(m => ({ valor: m.tipo, rotulo: m.nome }))} value={f.templateTipo} onChange={e => setF({ ...f, templateTipo: e.target.value })} />}
          </Campo>
          <Campo rotulo="Só para os cursos" ajuda="Um ou vários. Vazio: aplica-se a todos os cursos.">
            {a => <Selecao {...a} vazio={f.cursos.length ? "Acrescentar outro curso" : "Todos os cursos"}
              opcoes={cursos.selecao.filter(o => !f.cursos.includes(o.valor))} value=""
              onChange={e => { const c = e.target.value; if (c) setF({ ...f, cursos: [...f.cursos, c] }); }} />}
          </Campo>
          {f.cursos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 -mt-1">
              {f.cursos.map(c => <Chip key={c} onRemover={() => setF({ ...f, cursos: f.cursos.filter(x => x !== c) })}>{c}</Chip>)}
            </div>
          )}
          <div className="space-y-1.5">
            <p className="m-0 text-[13px] font-medium text-tinta">Anexos</p>
            {regra ? (
              <>
                {anexos.length > 0 && (
                  <ul className="m-0 list-none space-y-1 p-0">
                    {anexos.map(a => (
                      <li key={a.id} className="flex items-center justify-between gap-2 rounded-controlo border border-linha px-2.5 py-1.5 text-[13px]">
                        <span className="min-w-0 truncate">📎 {a.nome}</span>
                        <Botao tamanho="sm" variante="fantasma" onClick={() => void tirar(a.id)}>Tirar</Botao>
                      </li>
                    ))}
                  </ul>
                )}
                <input ref={ficheiroRef} type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                  onChange={e => void anexar(e.target.files?.[0])} />
                <Botao tamanho="sm" aCarregar={aAnexar} disabled={anexos.length >= 5} onClick={() => ficheiroRef.current?.click()}>Anexar documento</Botao>
                <p className="m-0 text-xs text-tinta-suave">Seguem com cada email desta regra. PDF, imagem, Word ou Excel; até 8 MB e 5 documentos.</p>
              </>
            ) : <p className="m-0 text-xs text-tinta-suave">Grave a regra para lhe anexar documentos.</p>}
          </div>
          <Caixa rotulo="Regra activa" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} />
        </div>
        <div>
          <p className="m-0 mb-2 text-[13px] font-medium text-tinta">Pré-visualização</p>
          {f.templateTipo
            ? <MolduraEmail assunto={prev?.assunto} de={prev?.de} para={prev?.para} html={prev?.html} aCarregar={aCarregar} />
            : <p className="m-0 text-[13px] text-tinta-suave">Escolha o modelo para ver o email.</p>}
        </div>
      </div>
    </Modal>
  );
}
