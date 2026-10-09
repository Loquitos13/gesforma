/** Uma edição comercial: o preço pode ser do par local+horário, só do local, ou só do horário. */
export type RegraPreco = {
  curso: string;
  local?: string;
  horario?: string;
  inicio?: string;
  preco: number;
  status?: string;
};

export type EscolhaPreco = {
  curso: string;
  local?: string;
  horario?: string;
  inicio?: string;
};

function texto(s: string | undefined | null) {
  return (s ?? "").trim().toLowerCase();
}

function dataDe(s: string | undefined | null) {
  const v = (s ?? "").trim();
  if (!v || v === "-") return "";
  return v.slice(0, 10);
}

function activa(r: RegraPreco) {
  const st = texto(r.status);
  return st !== "inactivo" && st !== "inativo";
}

/** Um único preço entre as regras. Zero quando a lista está vazia ou os valores divergem. */
function precoUnico(regras: RegraPreco[]) {
  const precos = [...new Set(regras.map(r => Number(r.preco)).filter(p => p > 0))];
  return precos.length === 1 ? precos[0] : 0;
}

function precoDoCurso(cursos: { nome: string; preco: number }[], nome: string) {
  const alvo = texto(nome);
  if (!alvo) return 0;
  const curso = cursos.find(c => texto(c.nome) === alvo);
  return curso && Number(curso.preco) > 0 ? Number(curso.preco) : 0;
}

/**
 * Preço da inscrição segundo o que a pessoa escolheu.
 * O par local + horário ganha, se essa edição tiver um preço.
 * Se não houver par, vale o preço do local, depois o do horário, e por fim o do curso.
 * É um valor só, não a soma dos três.
 */
export function precoDaInscricao(
  cursos: { nome: string; preco: number }[],
  regras: RegraPreco[],
  escolha: EscolhaPreco,
) {
  const curso = texto(escolha.curso);
  const local = texto(escolha.local);
  const horario = texto(escolha.horario);
  const inicio = dataDe(escolha.inicio);
  const base = precoDoCurso(cursos, escolha.curso);
  const doCurso = regras.filter(r => texto(r.curso) === curso && activa(r) && Number(r.preco) > 0);

  if (local && horario) {
    const ambos = doCurso.filter(r => texto(r.local) === local && texto(r.horario) === horario);
    if (inicio) {
      const naData = precoUnico(ambos.filter(r => dataDe(r.inicio) === inicio));
      if (naData) return naData;
    }
    const par = precoUnico(ambos);
    if (par) return par;
  }

  if (local) {
    const soLocal = precoUnico(doCurso.filter(r => texto(r.local) === local && !texto(r.horario)));
    if (soLocal) return soLocal;
    if (!horario) {
      const doLocal = precoUnico(doCurso.filter(r => texto(r.local) === local));
      if (doLocal) return doLocal;
    }
  }

  if (horario) {
    const soHorario = precoUnico(doCurso.filter(r => texto(r.horario) === horario && !texto(r.local)));
    if (soHorario) return soHorario;
    if (!local) {
      const doHorario = precoUnico(doCurso.filter(r => texto(r.horario) === horario));
      if (doHorario) return doHorario;
    }
  }

  if (local && horario) {
    const doLocal = precoUnico(doCurso.filter(r => texto(r.local) === local));
    if (doLocal) return doLocal;
    const doHorario = precoUnico(doCurso.filter(r => texto(r.horario) === horario));
    if (doHorario) return doHorario;
  }

  return base;
}
