import { useEffect, useState } from "react";
import { apiCursoFicha, type Regime } from "../partilhado/api";
import { useCursoId } from "../partilhado/dados/comuns";
import { avaliacaoCcp, avaliacaoPadrao, cursoECcp, parseAvaliacaoCurso, type AvaliacaoCurso } from "../partilhado/avaliacaoNota";

export * from "../partilhado/avaliacaoNota";

export function useAvaliacaoCurso(regime: Regime, cursoNome: string | undefined) {
  const [cfg, setCfg] = useState<AvaliacaoCurso>(avaliacaoPadrao);
  const cursoId = useCursoId(regime, cursoNome);

  useEffect(() => {
    const ccp = cursoECcp(cursoNome);
    if (cursoId == null) { setCfg(ccp ? avaliacaoCcp() : avaliacaoPadrao()); return; }
    let alive = true;
    apiCursoFicha(regime, cursoId)
      .then(r => {
        if (!alive) return;
        const parsed = parseAvaliacaoCurso(r.ficha?.payload);
        setCfg(ccp && parsed.estrutura !== "ccp" ? avaliacaoCcp() : parsed);
      })
      .catch(() => { if (alive) setCfg(ccp ? avaliacaoCcp() : avaliacaoPadrao()); });
    return () => { alive = false; };
  }, [cursoId, cursoNome, regime]);

  return cfg;
}
