// Cabeçalho da grelha de avaliação da turma (instruções, escala, estado da gravação) e os avisos de grelha vazia.
import { textoFormulaCcp, type EstruturaCcp } from "./avaliacaoCcp";
import { formatNota, type AvaliacaoCurso } from "./avaliacaoCurso";

type Unidade = { singular: string; plural: string };
export type EstadoGravacao = "idle" | "save" | "ok" | "erro";

function instrucoes(cfg: AvaliacaoCurso, ccp: EstruturaCcp | null, faltaParams: boolean, grelhaMomentos: boolean, unidade: Unidade) {
  if (faltaParams) return "Defina os parâmetros na ficha do curso (separador Avaliação) para lançar notas.";
  if (ccp) return `Em cada folha, abra um bloco de cada vez e escreva a nota nas células com rebordo. Cole um intervalo copiado do Excel, ou arraste o quadrado do canto para repetir o valor. As cinzentas calculam a fórmula. A avaliação final vai buscar essas notas. ${textoFormulaCcp(ccp)}.`;
  if (grelhaMomentos) return "Grelha do CCP: a mesma observação na simulação inicial e na final. A nota do certificado é a média das duas.";
  if (cfg.modo === "modulos") return `Por ${unidade.singular}: preencha todos os parâmetros de cada ${unidade.singular} para cada formando. Arraste o quadrado da seleção para copiar um valor, como no Excel.`;
  return "Avaliação final: cada parâmetro uma vez por formando. Arraste o quadrado da seleção para copiar um valor, como no Excel.";
}

export function CabecalhoAvaliacao({ cfg, ccp, faltaParams, grelhaMomentos, unidade, accentSoft, gravando }: {
  cfg: AvaliacaoCurso;
  ccp: EstruturaCcp | null;
  faltaParams: boolean;
  grelhaMomentos: boolean;
  unidade: Unidade;
  accentSoft: string;
  gravando: EstadoGravacao;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-base font-bold text-slate-800">Avaliação da turma</p>
        <p className="text-xs text-slate-500 mt-0.5">{instrucoes(cfg, ccp, faltaParams, grelhaMomentos, unidade)}</p>
        {!faltaParams && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${accentSoft}`}>
              Escala {cfg.escalaMin} a {cfg.escalaMax} {cfg.unidade}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
              Aprovação ≥ {formatNota(cfg.minimoAprovacao, cfg.unidade)}
            </span>
            {!ccp && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                {cfg.pesosEquitativos ? "Pesos equitativos" : "Pesos individuais"}
              </span>
            )}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400 flex-shrink-0" aria-live="polite">
        {gravando === "save" ? "A gravar…" : gravando === "ok" ? "Gravado" : gravando === "erro" ? "Não gravou" : ""}
      </p>
    </div>
  );
}

/** Aviso quando a grelha não pode ser mostrada (sem parâmetros, sem módulos ou sem formandos). */
export function AvisoGrelhaVazia({ faltaParams, faltaModulos, semFormandos, unidade }: {
  faltaParams: boolean;
  faltaModulos: boolean;
  semFormandos: boolean;
  unidade: Unidade;
}) {
  const texto = faltaParams
    ? "Ainda não há parâmetros de avaliação neste curso."
    : faltaModulos
      ? `A avaliação é por ${unidade.plural}, mas o programa do curso ainda não tem ${unidade.plural}. Adicione-os no separador Programa da ficha.`
      : semFormandos
        ? "Ainda não há formandos nesta turma."
        : "";
  if (!texto) return null;
  return (
    <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">{texto}</p>
  );
}
