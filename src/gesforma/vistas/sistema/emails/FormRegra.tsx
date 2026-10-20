// Criar ou editar uma regra: gatilho, atraso, modelo e curso, com a pré-visualização do modelo escolhido.
import { useState } from "react";
import { apiAlterarRegra, apiCriarRegra, apiPrevisualizarEmail, type OpcoesEmail, type RegraEmail } from "../../../../partilhado/api/emails";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { Botao, Caixa, Campo, Entrada, Modal, Selecao } from "../../../../partilhado/ui";
import { MolduraEmail } from "./Previsualizacao";

export function FormRegra({ regra, opcoes, onFechar }: { regra: RegraEmail | null; opcoes: OpcoesEmail; onFechar: () => void }) {
  const [f, setF] = useState({
    nome: regra?.nome ?? "",
    gatilho: regra?.gatilho ?? "",
    templateTipo: regra?.template ?? "",
    atraso: regra?.atraso ?? opcoes.atrasos[0] ?? "",
    curso: regra?.curso ?? "",
    ativo: regra?.ativo ?? true,
  });
  const cursos = useOpcoes("cursos");
  const criar = useAccao(apiCriarRegra, { ok: "Regra criada.", invalidar: ["emails:"] });
  const alterar = useAccao(apiAlterarRegra, { ok: "Regra gravada.", invalidar: ["emails:"] });
  const { dados: prev, aCarregar } = useRecurso(
    f.templateTipo ? `emails:prev:${f.templateTipo}:${f.curso}` : null,
    signal => apiPrevisualizarEmail({ tipo: f.templateTipo, curso: f.curso || null }, signal),
  );
  const gatilho = opcoes.gatilhos.find(g => g.valor === f.gatilho);
  const valido = f.nome.trim().length > 1 && f.gatilho && f.templateTipo;

  async function gravar() {
    const corpo = { ...f, nome: f.nome.trim(), curso: f.curso || null };
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
          <Campo rotulo="Nome da regra" obrigatorio>{a => <Entrada {...a} value={f.nome} maxLength={160} onChange={e => setF({ ...f, nome: e.target.value })} data-autofocus />}</Campo>
          <Campo rotulo="Quando" obrigatorio ajuda={gatilho?.descricao}>
            {a => <Selecao {...a} vazio="Escolha o momento" opcoes={opcoes.gatilhos.map(g => ({ valor: g.valor, rotulo: g.valor }))} value={f.gatilho} onChange={e => setF({ ...f, gatilho: e.target.value })} />}
          </Campo>
          <Campo rotulo="Atraso" ajuda="Os envios com atraso saem na volta diária seguinte (07:00 UTC, ≈ 08:00 em Lisboa no verão): um atraso de horas pode chegar só no dia seguinte.">
            {a => <Selecao {...a} opcoes={opcoes.atrasos.map(v => ({ valor: v, rotulo: v }))} value={f.atraso} onChange={e => setF({ ...f, atraso: e.target.value })} />}
          </Campo>
          <Campo rotulo="Modelo" obrigatorio>
            {a => <Selecao {...a} vazio="Escolha o modelo" opcoes={opcoes.modelos.map(m => ({ valor: m.tipo, rotulo: m.nome }))} value={f.templateTipo} onChange={e => setF({ ...f, templateTipo: e.target.value })} />}
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
