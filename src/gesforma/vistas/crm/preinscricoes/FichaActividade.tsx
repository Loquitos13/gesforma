import { useState } from "react";
import { AreaTexto, Botao, Campo, Chip, Entrada, Selecao, Vazio, cx } from "../../../../partilhado/ui";
import { apiEditarLead, apiFixarNota, apiNota, type DossieLead } from "../../../../partilhado/api/crm";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../../partilhado/dados/useOpcoes";
import { MODELOS_NOTA, relativo } from "./util";

const FILTROS = [
  { id: "todos", rotulo: "Tudo" },
  { id: "contacto", rotulo: "Contactos" },
  { id: "nota", rotulo: "Notas" },
  { id: "estado", rotulo: "Etapas" },
  { id: "seguimento", rotulo: "Seguimento" },
  { id: "campo", rotulo: "Documentos e dados" },
];

const PONTO: Record<string, string> = {
  criacao: "bg-tinta-fraca", contacto: "bg-ligacao", nota: "bg-acao", estado: "bg-tinta",
  seguimento: "bg-sucesso", campo: "bg-aviso", proposta: "bg-sucesso",
};

function emDias(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.toISOString().slice(0, 10)}T09:00`;
}

/** Registar contactos e notas; histórico do pedido. */
export function FichaActividade({ d, onMudou }: { d: DossieLead; onMudou: () => void }) {
  const id = d.lead.id;
  const [nota, setNota] = useState("");
  const [meio, setMeio] = useState(d.lead.meioContacto || "Telefone");
  const [resultado, setResultado] = useState("");
  const [proximo, setProximo] = useState(d.lead.proximoContacto ? d.lead.proximoContacto.slice(0, 16).replace(" ", "T") : "");
  const [filtro, setFiltro] = useState("todos");
  const meios = useOpcoes("lista", { lista: "meios_contacto" });
  const resultados = useOpcoes("lista", { lista: "resultados_contacto" });
  const gravarNota = useAccao(apiNota, { ok: "Actividade registada." });
  const gravarSeguimento = useAccao(apiEditarLead, { ok: "Próximo contacto agendado." });
  const fixar = useAccao(apiFixarNota);

  async function gravar() {
    const r = await gravarNota.correr(id, nota.trim(), meio, resultado);
    if (!r) return;
    setNota("");
    setResultado("");
    const novo = proximo ? proximo.replace("T", " ").slice(0, 16) : "";
    if (novo && novo !== d.lead.proximoContacto) await gravarSeguimento.correr(id, { proximoContacto: novo });
    onMudou();
  }

  const eventos = d.eventos.filter(e => filtro === "todos" || e.tipo === filtro || (filtro === "contacto" && e.tipo === "criacao"));
  const fixadas = d.notas.filter(n => n.fixada);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Registar contacto" className="flex flex-col gap-2 rounded-cartao border border-linha p-3">
        <div className="flex flex-wrap gap-1.5">
          {MODELOS_NOTA.map(m => (
            <Chip key={m.rotulo} onClick={() => { setNota(m.texto); setResultado(m.resultado); }}>{m.rotulo}</Chip>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo rotulo="Meio">{p => <Selecao {...p} value={meio} onChange={e => setMeio(e.target.value)} opcoes={meios.selecao} vazio="—" />}</Campo>
          <Campo rotulo="Resultado">{p => <Selecao {...p} value={resultado} onChange={e => setResultado(e.target.value)} opcoes={resultados.selecao} vazio="—" />}</Campo>
        </div>
        <Campo rotulo="Nota">{p => <AreaTexto {...p} rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="O que ficou combinado?" />}</Campo>
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Próximo contacto" className="flex-1 min-w-[200px]">
            {p => <Entrada {...p} type="datetime-local" value={proximo} onChange={e => setProximo(e.target.value)} />}
          </Campo>
          <Botao variante="secundario" tamanho="sm" onClick={() => setProximo(emDias(1))}>+1 dia</Botao>
          <Botao variante="secundario" tamanho="sm" onClick={() => setProximo(emDias(3))}>+3 dias</Botao>
        </div>
        <Botao variante="primario" aCarregar={gravarNota.aCorrer || gravarSeguimento.aCorrer} disabled={!nota.trim() && !resultado} onClick={() => void gravar()}>
          Gravar actividade
        </Botao>
      </section>

      {fixadas.map(n => (
        <div key={n.id} className="rounded-cartao border border-acao/40 bg-acao-suave px-3 py-2">
          <div className="flex items-start gap-2">
            <p className="m-0 flex-1 text-xs font-semibold text-acao-texto">Fixada · {n.actorName ?? "Sistema"} · {relativo(n.createdAt)}</p>
            <Botao variante="ligacao" tamanho="sm" onClick={() => void fixar.correr(id, n.id, false).then(r => r && onMudou())}>Desafixar</Botao>
          </div>
          <p className="m-0 whitespace-pre-wrap text-sm">{n.nota}</p>
        </div>
      ))}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar histórico">
        {FILTROS.map(f => <Chip key={f.id} ativo={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.rotulo}</Chip>)}
      </div>

      {eventos.length === 0 ? <Vazio compacto titulo="Ainda sem actividade." /> : (
        <ol className="m-0 flex list-none flex-col gap-3 border-l border-linha p-0 pl-4">
          {eventos.map(e => (
            <li key={e.id} className="relative">
              <span aria-hidden="true" className={cx("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-superficie", PONTO[e.tipo] ?? "bg-tinta-fraca")} />
              <p className="m-0 text-xs text-tinta-suave">{relativo(e.createdAt)}{e.actorName ? ` · ${e.actorName}` : ""}</p>
              <p className="m-0 text-sm font-semibold">{e.titulo}</p>
              {e.detalhe && <p className="m-0 whitespace-pre-wrap break-words text-xs text-tinta-suave">{e.detalhe}</p>}
            </li>
          ))}
        </ol>
      )}

      {d.notas.some(n => !n.fixada) && (
        <details>
          <summary className="cursor-pointer text-[13px] font-semibold text-ligacao">Notas ({d.notas.length})</summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
            {d.notas.map(n => (
              <li key={n.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">{n.nota}</span>
                <Botao variante="ligacao" tamanho="sm" onClick={() => void fixar.correr(id, n.id, !n.fixada).then(r => r && onMudou())}>{n.fixada ? "Desafixar" : "Fixar"}</Botao>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
