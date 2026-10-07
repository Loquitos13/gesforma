type SessaoOcupacao = {
  id?: string;
  data?: string;
  horaInicio?: string;
  horaFim?: string;
  formadores?: string[];
  formador?: string;
  modalidade?: string;
};

export type BlocoOcupacao = { chave: string; nome: string; cronograma: SessaoOcupacao[] };

function nomes(s: SessaoOcupacao) {
  if (s.formadores?.length) return s.formadores.map(f => f.trim()).filter(Boolean);
  return s.formador?.trim() ? [s.formador.trim()] : [];
}

function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function faixa(inicio: string, fim: string): [number, number] | null {
  const s = minutos(inicio);
  const e = minutos(fim);
  if (s == null || e == null) return null;
  if (e <= s) return [s, 24 * 60];
  return [s, e];
}

function cruzam(a0: string, a1: string, b0: string, b1: string) {
  const a = faixa(a0, a1);
  const b = faixa(b0, b1);
  if (!a || !b) return false;
  return a[0] < b[1] && b[0] < a[1];
}

function ocupacoes(bloco: BlocoOcupacao) {
  return bloco.cronograma.map((s, i) => ({
    s,
    id: `${bloco.chave}:${s.id || i}`,
    turma: bloco.nome,
  }));
}

function pares(blocos: BlocoOcupacao[]) {
  const lista = blocos.flatMap(ocupacoes);
  const out = new Map<string, { nome: string; onde: string; mesma: boolean }>();
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i]!;
      const b = lista[j]!;
      if (a.id === b.id) continue;
      if ((a.s.modalidade ?? "presencial") === "auto" || (b.s.modalidade ?? "presencial") === "auto") continue;
      if (!a.s.data || a.s.data !== b.s.data) continue;
      if (!cruzam(a.s.horaInicio ?? "", a.s.horaFim ?? "", b.s.horaInicio ?? "", b.s.horaFim ?? "")) continue;
      const fb = new Set(nomes(b.s).map(n => n.toLowerCase()));
      for (const nome of nomes(a.s)) {
        if (!fb.has(nome.toLowerCase())) continue;
        const ids = [a.id, b.id].sort().join("|");
        const mesma = a.turma === b.turma;
        out.set(`${nome.toLowerCase()}|${ids}`, { nome, onde: mesma ? a.turma : `${a.turma} e ${b.turma}`, mesma });
      }
    }
  }
  return out;
}

/** Null quando o cronograma novo não cria cruzamentos que o anterior já não tivesse. */
export function textoSobreposicaoNova(antes: BlocoOcupacao, depois: BlocoOcupacao, outras: BlocoOcupacao[]) {
  const ja = pares([antes, ...outras]);
  const agora = pares([depois, ...outras]);
  for (const [chave, info] of agora) {
    if (ja.has(chave)) continue;
    return info.mesma
      ? `${info.nome} já tem outra sessão nesse horário nesta turma.`
      : `${info.nome} já tem sessão nesse horário em ${info.onde}.`;
  }
  return null;
}
