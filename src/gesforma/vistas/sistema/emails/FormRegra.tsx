// Criar ou editar uma regra: gatilho, atraso, modelo e curso, com a pré-visualização do modelo escolhido.
import { useState } from "react";
import { apiAlterarRegra, apiCriarRegra, apiPrevisualizarEmail, type OpcoesEmail, type RegraEmail } from "../../../../partilhado/api/emails";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { ROTULO_AREA_EMAIL, eAreaEmail, type AreaEmail } from "../../../../partilhado/emailAreas";
import { GRUPOS_EQUIPA, ROTULO_GRUPO, eAvisoEquipa, gruposPorOmissao, type GrupoEquipa } from "../../../../partilhado/equipasAviso";
import { Botao, Caixa, Campo, Entrada, Modal, Selecao } from "../../../../partilhado/ui";
import { MolduraEmail } from "./Previsualizacao";

export function FormRegra({ regra, opcoes, onFechar }: { regra: RegraEmail | null; opcoes: OpcoesEmail; onFechar: () => void }) {
  const areas = opcoes.areas ?? [];
  const [f, setF] = useState({
    area: (regra?.area ?? areas[0] ?? "gold") as AreaEmail,
    nome: regra?.nome ?? "",
    gatilho: regra?.gatilho ?? "",
    templateTipo: regra?.template ?? "",
    atraso: regra?.atraso ?? opcoes.atrasos[0] ?? "",
    curso: regra?.curso ?? "",
    ativo: regra?.ativo ?? true,
    dias: regra?.dias == null ? "" : String(regra.dias),
    destinatarios: (regra?.destinatarios ?? null) as GrupoEquipa[] | null,
  });
  const cursos = useOpcoes("cursos");
  const criar = useAccao(apiCriarRegra, { ok: "Regra criada.", invalidar: ["emails:"] });
  const alterar = useAccao(apiAlterarRegra, { ok: "Regra gravada.", invalidar: ["emails:"] });
  const { dados: prev, aCarregar } = useRecurso(
    f.templateTipo ? `emails:prev:${f.area}:${f.templateTipo}:${f.curso}` : null,
    signal => apiPrevisualizarEmail({ tipo: f.templateTipo, area: f.area, curso: f.curso || null }, signal),
  );
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
      ...f, nome: f.nome.trim(), curso: f.curso || null, dias: prazo && f.dias.trim() !== "" ? Math.max(0, Math.min(365, Number(f.dias) || 0)) : null,
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
          <Campo rotulo="Só para o curso" ajuda="Vazio: aplica-se a todos os cursos.">
            {a => <Selecao {...a} vazio="Todos os cursos" opcoes={cursos.selecao} value={f.curso} onChange={e => setF({ ...f, curso: e.target.value })} />}
          </Campo>
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
