// Registo manual de um pagamento (em mão, transferência já vista no banco, ou oferta).
import { useEffect, useState } from "react";
import { apiEstadoConfiguracoes } from "../../../../partilhado/api/configuracoes";
import { apiRegistarPagamento } from "../../../../partilhado/api/pagamentos";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { numeroPt } from "../../../../partilhado/ui/formatos";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { Botao, Caixa, Campo, Entrada, Modal, Selecao } from "../../../../partilhado/ui";

const VAZIO = { nome: "", email: "", curso: "", valor: "", metodo: "", recebido: true };

const novaChave = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, "");

export function RegistarPagamento({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [f, setF] = useState(VAZIO);
  // Chave do pedido, nova a cada abertura: um duplo clique ou um reenvio não regista o pagamento duas vezes.
  const [chave, setChave] = useState(novaChave);
  const cursos = useOpcoes("cursos", { regime: "gold" });
  const { dados: estado } = useRecurso(aberto ? "configuracoes:estado" : null, apiEstadoConfiguracoes);
  const metodos = (estado?.pagamentos.metodos ?? []).map(m => ({ valor: m, rotulo: m }));
  const registar = useAccao(apiRegistarPagamento, { ok: "Pagamento registado.", invalidar: ["pagamentos:", "painel:"] });
  useEffect(() => { if (aberto) { setF(VAZIO); setChave(novaChave()); } }, [aberto]);

  const oferta = /oferta/i.test(f.metodo);
  const valor = oferta ? 0 : numeroPt(f.valor);
  const valido = f.nome.trim().length > 1 && f.metodo && (oferta || (Number.isFinite(valor) && valor > 0));

  async function gravar() {
    const r = await registar.correr({
      nome: f.nome.trim(), email: f.email.trim() || undefined, curso: f.curso, valor, metodo: f.metodo,
      estado: oferta || f.recebido ? "Pago" : "Pendente", chave,
    });
    if (r) onFechar();
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Registar pagamento"
      rodape={(
        <>
          <Botao onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" disabled={!valido} aCarregar={registar.aCorrer} onClick={() => void gravar()}>Registar</Botao>
        </>
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo rotulo="Nome" obrigatorio className="sm:col-span-2">
          {a => <Entrada {...a} value={f.nome} maxLength={160} onChange={e => setF({ ...f, nome: e.target.value })} data-autofocus />}
        </Campo>
        <Campo rotulo="Email" ajuda="Com email, a pessoa recebe a confirmação.">
          {a => <Entrada {...a} type="email" value={f.email} maxLength={254} onChange={e => setF({ ...f, email: e.target.value })} />}
        </Campo>
        <Campo rotulo="Curso">
          {a => <Selecao {...a} opcoes={cursos.selecao} vazio="Sem curso" value={f.curso} onChange={e => setF({ ...f, curso: e.target.value })} />}
        </Campo>
        <Campo rotulo="Método" obrigatorio>
          {a => <Selecao {...a} opcoes={metodos} vazio="Escolha o método" value={f.metodo} onChange={e => setF({ ...f, metodo: e.target.value })} />}
        </Campo>
        <Campo rotulo="Valor (€)" obrigatorio={!oferta} ajuda={oferta ? "Oferta regista 0 € e fica paga." : undefined}>
          {a => <Entrada {...a} inputMode="decimal" disabled={oferta} value={oferta ? "0" : f.valor} onChange={e => setF({ ...f, valor: e.target.value.replace(/[^\d.,]/g, "") })} />}
        </Campo>
        {!oferta && (
          <Caixa className="sm:col-span-2" rotulo="Já foi recebido" ajuda="Desligado: fica «por receber» até alguém confirmar."
            checked={f.recebido} onChange={e => setF({ ...f, recebido: e.target.checked })} />
        )}
      </div>
    </Modal>
  );
}
