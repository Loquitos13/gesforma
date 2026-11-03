/**
 * Copiar o cronograma de outra turma: as sessões passam para a nova data de início com os mesmos intervalos entre
 * dias e as mesmas horas, módulos, formadores, metodologia e plano marcado. Depois ficam editáveis como as outras.
 * Começos e fechos de sessão (iniciadaEm/fechadaEm) nunca se copiam.
 */
// Sem dependências: o servidor também a usa (rota «copiar cronograma»).
type SessaoCronograma = {
  id: string; data: string; horaInicio: string; horaFim: string; modulos: string[]; formadores: string[];
  modalidade?: string; iniciadaEm?: string; fechadaEm?: string; [k: string]: unknown;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const FIM_CRONOGRAMA_ID = "fim-cronograma";
const sessaoModalidade = (s: { modalidade?: string }) => s.modalidade ?? "presencial";
const isSessaoLectiva = (s: { modalidade?: string }) => ["presencial", "sincrona"].includes(sessaoModalidade(s));
// Datas em UTC: os dias não mudam com a hora de verão.
const dia = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const addDays = (iso: string, n: number) => new Date(dia(iso) + n * 86_400_000).toISOString().slice(0, 10);
const diasEntre = (de: string, ate: string) => Math.round((dia(ate) - dia(de)) / 86_400_000);
const sid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** O dia de referência da origem: a primeira sessão lectiva (sem ela, o primeiro evento que não é a matrícula). */
export function inicioDoCronograma(sessoes: SessaoCronograma[]) {
  const comData = sessoes.filter(s => ISO.test(s.data) && s.id !== FIM_CRONOGRAMA_ID);
  const lectivas = comData.filter(isSessaoLectiva).map(s => s.data).sort();
  const eventos = comData.filter(s => sessaoModalidade(s) !== "matricula").map(s => s.data).sort();
  return lectivas[0] ?? eventos[0] ?? "";
}

export function copiarCronograma<T extends SessaoCronograma>(origem: T[], novoInicio: string): T[] {
  const base = inicioDoCronograma(origem);
  if (!base || !ISO.test(novoInicio)) return [];
  const desvio = diasEntre(base, novoInicio);
  return origem
    .filter(s => ISO.test(s.data))
    .map(s => {
      const { iniciadaEm: _i, fechadaEm: _f, ...resto } = s;
      const fixo = s.id === FIM_CRONOGRAMA_ID || sessaoModalidade(s) === "matricula";
      return {
        ...(resto as T),
        id: fixo ? s.id : sid("c"),
        data: addDays(s.data, desvio),
        modulos: [...(s.modulos ?? [])],
        formadores: [...(s.formadores ?? [])],
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio));
}
