// Lançar uma resposta recebida em papel: o questionário tal como o formando o vê.
import { useEffect, useState } from "react";
import { apiLancarResposta, type Pergunta, type Regime } from "../../../partilhado/api/inqueritos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { AreaTexto, Botao, Campo, Entrada, Modal, Selecao, cx } from "../../../partilhado/ui";

export function LancarResposta({ aberto, onFechar, inqueritoId, titulo, perguntas, regime }: {
  aberto: boolean;
  onFechar: () => void;
  inqueritoId: number;
  titulo: string;
  perguntas: Pergunta[];
  regime: Regime;
}) {
  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [turma, setTurma] = useState("");
  const [formando, setFormando] = useState("");
  const turmas = useOpcoes("turmas", { regime });
  const gravar = useAccao(apiLancarResposta, { ok: "Resposta gravada.", invalidar: ["inqueritos:"] });
  useEffect(() => { if (aberto) { setRespostas({}); setFormando(""); } }, [aberto]);

  const preenchidas = Object.values(respostas).filter(v => v !== "" && v != null).length;
  const definir = (id: number, v: unknown) => setRespostas(x => ({ ...x, [String(id)]: v }));

  async function submeter() {
    const ok = await gravar.correr(inqueritoId, { turma: turma.trim(), formando: formando.trim(), respostas });
    if (ok) { setRespostas({}); setFormando(""); }
  }

  const opcao = (ativo: boolean) => cx(
    "rounded-controlo border px-3 py-1.5 text-sm font-medium",
    ativo ? "border-tinta bg-tinta text-white" : "border-linha-forte bg-superficie text-tinta hover:bg-fundo",
  );

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={titulo || "Inquérito"}
      largura="lg"
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>Fechar</Botao>
          <Botao variante="primario" disabled={!preenchidas} aCarregar={gravar.aCorrer} onClick={() => void submeter()}>Gravar resposta</Botao>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Turma" ajuda="Conta para a taxa de resposta dessa turma.">
            {p => <Selecao {...p} value={turma} vazio="Sem turma" opcoes={turmas.selecao} onChange={e => setTurma(e.target.value)} />}
          </Campo>
          <Campo rotulo="Formando (opcional)">
            {p => <Entrada {...p} value={formando} maxLength={160} onChange={e => setFormando(e.target.value)} />}
          </Campo>
        </div>
        {perguntas.map((q, i) => {
          const valor = respostas[String(q.id)];
          return (
            <fieldset key={q.id} className="space-y-2">
              <legend className="text-sm font-semibold text-tinta">{i + 1}. {q.texto}</legend>
              {q.tipo === "escala" && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" aria-pressed={valor === n} onClick={() => definir(q.id, n)} className={cx(opcao(valor === n), "h-9 w-9 rounded-full px-0")}>{n}</button>
                  ))}
                </div>
              )}
              {q.tipo === "simnao" && (
                <div className="flex gap-2">
                  {["Sim", "Não"].map(o => <button key={o} type="button" aria-pressed={valor === o} onClick={() => definir(q.id, o)} className={opcao(valor === o)}>{o}</button>)}
                </div>
              )}
              {q.tipo === "multipla" && (
                <div className="flex flex-wrap gap-2">
                  {(q.opcoes ?? []).filter(Boolean).map(o => <button key={o} type="button" aria-pressed={valor === o} onClick={() => definir(q.id, o)} className={opcao(valor === o)}>{o}</button>)}
                </div>
              )}
              {q.tipo === "texto" && (
                <AreaTexto aria-label={q.texto} rows={3} maxLength={2000} value={typeof valor === "string" ? valor : ""} onChange={e => definir(q.id, e.target.value)} />
              )}
            </fieldset>
          );
        })}
      </div>
    </Modal>
  );
}
