import { useState } from "react";
import type { TurmaPercurso } from "../partilhado/api";
import { CronogramaModal } from "./CronogramaFolha";
import { fmtDataCalendario as fmtData } from "../partilhado/horaLisboa";

/** Peças do percurso da ligação pessoal (cartão de turma, campo de ficheiro, textos). */

function textoVagas(n: number) {
  if (n <= 0) return "Sem vagas restantes";
  return n === 1 ? "1 vaga restante" : `${n} vagas restantes`;
}

export function CartaoTurma({
  turma, curso, escolhida, busy, onEscolher,
}: {
  turma: TurmaPercurso;
  curso: string;
  escolhida: boolean;
  busy: boolean;
  onEscolher: () => void;
}) {
  const [cronograma, setCronograma] = useState(false);
  const temPlano = (turma.plano ?? []).some(s => s.data);
  const anel = escolhida
    ? "bg-[#fff6e4] ring-[#ffa900] shadow-[0_0_0_3px_rgba(255,169,0,0.18)]"
    : "bg-white ring-[#e7e1d6]";
  return (
    <li className={`rounded-xl ring-2 ${anel} ${busy ? "opacity-60" : ""}`}>
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-pressed={escolhida}
        aria-label={`${turma.local}, ${turma.horario}, início ${fmtData(turma.dataInicio)}`}
        onClick={() => { if (!busy) onEscolher(); }}
        onKeyDown={e => {
          if (busy) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEscolher(); }
        }}
        className={`cursor-pointer rounded-t-xl px-4 pt-3 outline-none ${escolhida ? "" : "hover:bg-[#faf8f4]"} focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ffa900]`}
      >
        <span className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${escolhida ? "border-[#ffa900] bg-[#ffa900] text-[#1b2330]" : "border-[#d4cbbd] bg-white"}`} aria-hidden>
            {escolhida && (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.2 7.2a1 1 0 01-1.4 0L3.3 9.1a1 1 0 011.4-1.4l3.1 3.1 6.5-6.5a1 1 0 011.4 0z" clipRule="evenodd" />
              </svg>
            )}
          </span>
          <span className="min-w-0 flex-1 pb-3">
            <span className="flex items-start justify-between gap-3">
              {/* O código interno da turma não aparece ao público. */}
              <span className="block text-sm font-semibold">{[turma.local, turma.horario].filter(Boolean).join(" · ") || "Turma"}</span>
              {escolhida && <span className="shrink-0 text-xs font-semibold text-[#9a6700]">Seleccionada</span>}
            </span>
            <span className="mt-1 block text-xs text-[#8a8172]">Início {fmtData(turma.dataInicio)} · {textoVagas(turma.livres > 0 ? turma.vagasMostradas ?? turma.livres : 0)}</span>
          </span>
        </span>
      </div>
      <div className="border-t border-[#efeae1] px-4 py-2.5">
        <button
          type="button"
          disabled={!temPlano}
          onClick={() => setCronograma(true)}
          className="rounded-lg border border-[#e7e1d6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1b2330] hover:bg-[#fffaf2] disabled:opacity-40"
        >
          {temPlano ? "Ver cronograma" : "Sem cronograma"}
        </button>
      </div>
      <CronogramaModal turma={turma} curso={curso} open={cronograma} onClose={() => setCronograma(false)} />
    </li>
  );
}

export function textoTurmas(criterios: { local: string; horario: string; inicio: string }) {
  const partes = [criterios.local, criterios.horario, criterios.inicio ? fmtData(criterios.inicio) : ""].filter(Boolean);
  if (!partes.length) return "Escolha o cronograma. Só aparecem turmas deste curso que ainda tenham lugar, já com a tolerância de vagas.";
  return `Só aparecem turmas de ${partes.join(" · ")} que ainda tenham lugar, já com a tolerância de vagas.`;
}

export function CampoFicheiro({ onFile }: { onFile: (f: File | null) => void }) {
  return (
    <label className="block rounded-xl border border-dashed border-[#d9c9a3] bg-white px-4 py-4">
      <span className="block text-xs font-semibold uppercase tracking-wide text-[#8a8172]">Ficheiro PDF, JPG ou PNG</span>
      <input
        className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#1b2330] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
        type="file"
        accept=".pdf,image/jpeg,image/png,application/pdf"
        onChange={e => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
