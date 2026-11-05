// Mensagens e menu do assistente de WhatsApp: a administração e as coordenações mudam os textos, o nome, a ordem e a
// visibilidade das opções do menu e acrescentam perguntas frequentes (opção com uma resposta fixa).
import { useState } from "react";
import {
  apiGravarWhatsappAssistente, apiWhatsappAssistente, type AssistenteWhatsapp, type ItemMenuAssistente,
} from "../../../partilhado/api/configuracoes";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { AreaTexto, Botao, Campo, Entrada, Modal, cx } from "../../../partilhado/ui";

const TEXTOS: { id: string; rotulo: string; ajuda?: string }[] = [
  { id: "boasVindas", rotulo: "Boas-vindas (por cima do menu)" },
  { id: "pedidoRegistado", rotulo: "Estado do pedido: já tem pré-inscrição" },
  { id: "semPedido", rotulo: "Estado do pedido: sem pré-inscrição", ajuda: "A seguir vem «Escreva N para se pré-inscrever…»." },
  { id: "falarEquipa", rotulo: "Falar com a equipa", ajuda: "A seguir vem «Para voltar ao assistente automático, escreva menu»." },
  { id: "ficheiro", rotulo: "Quando a pessoa envia um ficheiro" },
  { id: "notaPreco", rotulo: "Lista de cursos: nota sobre o preço (Gold)" },
  { id: "fimGold", rotulo: "Fim da pré-inscrição Gold" },
  { id: "fimFin", rotulo: "Fim da pré-inscrição Financiada" },
];

const ORIGEM: Record<string, string> = {
  preinscricao: "Pré-inscrição", estado: "Estado do pedido", cursos: "Lista de cursos", equipa: "Falar com a equipa", faq: "Pergunta frequente",
};

export function BotaoAssistenteWhatsapp() {
  const [aberto, setAberto] = useState(false);
  const [a, setA] = useState<AssistenteWhatsapp | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  async function abrir() {
    setAberto(true);
    setA(null);
    try { setA((await apiWhatsappAssistente()).assistente); } catch (e) { toastError(e); setAberto(false); }
  }
  async function guardar() {
    if (!a) return;
    setAGuardar(true);
    try {
      setA((await apiGravarWhatsappAssistente(a)).assistente);
      toastOk("Mensagens do assistente guardadas.");
      setAberto(false);
    } catch (e) { toastError(e); } finally { setAGuardar(false); }
  }
  const mudarItem = (i: number, p: Partial<ItemMenuAssistente>) => a && setA({ ...a, menu: a.menu.map((x, j) => j === i ? { ...x, ...p } : x) });
  function mover(i: number, d: -1 | 1) {
    if (!a) return;
    const m = [...a.menu];
    const j = i + d;
    if (j < 0 || j >= m.length) return;
    [m[i], m[j]] = [m[j]!, m[i]!];
    setA({ ...a, menu: m });
  }
  let numero = 0;

  return (
    <>
      <Botao onClick={() => void abrir()}>Mensagens do assistente</Botao>
      <Modal aberto={aberto} onFechar={() => setAberto(false)} largura="lg" titulo="Mensagens do assistente"
        subtitulo="O que o assistente responde no WhatsApp e as opções do menu. Vale para as próximas mensagens."
        rodape={<><Botao onClick={() => setAberto(false)}>Cancelar</Botao><Botao variante="primario" disabled={!a} aCarregar={aGuardar} onClick={() => void guardar()}>Guardar</Botao></>}>
        {!a ? <p className="m-0 text-sm text-tinta-suave">A carregar…</p> : (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="m-0 text-sm font-semibold text-tinta">Menu</h3>
              <p className="m-0 text-xs text-tinta-suave">A pessoa escolhe pelo número (pela ordem das opções visíveis) ou tocando na lista. Até 10 opções; nome até 24 caracteres.</p>
              <ul className="m-0 list-none space-y-2 p-0">
                {a.menu.map((it, i) => {
                  if (it.ativo) numero += 1;
                  return (
                    <li key={i} className={cx("rounded-controlo border border-linha p-3 space-y-2", !it.ativo && "opacity-70")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="num w-6 text-sm font-semibold text-tinta">{it.ativo ? numero : "—"}</span>
                        <span className="text-xs text-tinta-suave">{ORIGEM[it.acao]}</span>
                        <span className="flex-1" />
                        <label className="inline-flex items-center gap-1.5 text-xs">
                          <input type="checkbox" checked={it.ativo} onChange={e => mudarItem(i, { ativo: e.target.checked })} /> Visível
                        </label>
                        <Botao tamanho="sm" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">↑</Botao>
                        <Botao tamanho="sm" disabled={i === a.menu.length - 1} onClick={() => mover(i, 1)} aria-label="Descer">↓</Botao>
                        {it.acao === "faq" && (
                          <Botao tamanho="sm" variante="perigo" onClick={() => setA({ ...a, menu: a.menu.filter((_, j) => j !== i) })}>Apagar</Botao>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Campo rotulo="Nome">{p => <Entrada {...p} maxLength={24} value={it.titulo} onChange={e => mudarItem(i, { titulo: e.target.value })} />}</Campo>
                        <Campo rotulo="Descrição (opcional)">{p => <Entrada {...p} maxLength={72} value={it.descricao ?? ""} onChange={e => mudarItem(i, { descricao: e.target.value })} />}</Campo>
                      </div>
                      {it.acao === "faq" && (
                        <Campo rotulo="Resposta">{p => <AreaTexto {...p} rows={3} maxLength={1000} value={it.resposta ?? ""} onChange={e => mudarItem(i, { resposta: e.target.value })} />}</Campo>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Botao tamanho="sm" disabled={a.menu.length >= 10}
                onClick={() => setA({ ...a, menu: [...a.menu, { acao: "faq", titulo: "", ativo: true, resposta: "" }] })}>
                Acrescentar pergunta frequente
              </Botao>
            </section>
            <section className="space-y-3">
              <h3 className="m-0 text-sm font-semibold text-tinta">Textos</h3>
              <p className="m-0 text-xs text-tinta-suave">*negrito* e _itálico_ como no WhatsApp. Em branco volta ao texto de origem.</p>
              {TEXTOS.map(t => (
                <Campo key={t.id} rotulo={t.rotulo} ajuda={t.ajuda}>
                  {p => <AreaTexto {...p} rows={2} maxLength={1000} value={a.textos[t.id] ?? ""} onChange={e => setA({ ...a, textos: { ...a.textos, [t.id]: e.target.value } })} />}
                </Campo>
              ))}
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
