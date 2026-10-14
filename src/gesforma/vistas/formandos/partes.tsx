import type { SituacaoPagamento } from "../../../partilhado/api/formandos";
import { cx, num, type Tom } from "../../../partilhado/ui";

/** Rótulo e tom de cada situação de pagamento (Gold). */
export const PAGAMENTO: Record<SituacaoPagamento, { rotulo: string; tom: Tom }> = {
  pago: { rotulo: "Pago", tom: "sucesso" },
  por_pagar: { rotulo: "Por pagar", tom: "aviso" },
  oferta: { rotulo: "Oferta", tom: "info" },
  isento: { rotulo: "Sem valor", tom: "neutro" },
};

/** Estado de um documento da ficha. */
export const ESTADO_DOC: Record<string, { rotulo: string; tom: Tom }> = {
  validado: { rotulo: "Validado", tom: "sucesso" },
  pendente: { rotulo: "A validar", tom: "aviso" },
  recusado: { rotulo: "Recusado", tom: "perigo" },
  em_falta: { rotulo: "Em falta", tom: "neutro" },
};

/** Documentos validados sobre os obrigatórios, com barra. */
export function BarraDocs({ validados, total, recusados = 0 }: { validados: number; total: number; recusados?: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((validados / total) * 100)) : 0;
  const completo = total > 0 && validados >= total;
  return (
    <div className="min-w-[110px]">
      <p className="num m-0 text-[13px] text-tinta">
        {num(validados)}/{num(total)}
        {recusados > 0 && <span className="text-perigo"> · {num(recusados)} recusado{recusados > 1 ? "s" : ""}</span>}
      </p>
      <div className="mt-1 h-1.5 rounded-full bg-linha-suave overflow-hidden" aria-hidden="true">
        <span className={cx("block h-full rounded-full", completo ? "bg-sucesso" : "bg-aviso")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Percurso da ficha (inscrição → … → certificado), em passos. */
export function Percurso({ passos }: { passos: { id: string; rotulo: string; feito: boolean }[] }) {
  const atual = passos.findIndex(p => !p.feito);
  return (
    <ol className="m-0 p-0 list-none grid gap-2" style={{ gridTemplateColumns: `repeat(${passos.length}, minmax(0, 1fr))` }} aria-label="Percurso do formando">
      {passos.map((p, i) => {
        const eAtual = i === atual;
        return (
          <li key={p.id} className="min-w-0">
            <span
              aria-hidden="true"
              className={cx("block h-1.5 rounded-full", p.feito ? "bg-sucesso" : eAtual ? "bg-acao" : "bg-linha-suave")}
            />
            <span className={cx("mt-1.5 block text-xs truncate", p.feito ? "text-tinta" : eAtual ? "text-tinta font-semibold" : "text-tinta-suave")}>
              {p.rotulo}
              <span className="sr-only">{p.feito ? " (feito)" : eAtual ? " (passo actual)" : " (por fazer)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
