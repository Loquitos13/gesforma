import { useEffect, useMemo, useState } from "react";
import { apiCursoFicha, type Regime } from "../partilhado/api";
import { idCursoPorNome } from "../partilhado/cursoLocais";
import { useLists } from "../partilhado/ListsContext";
import { avaliacaoCcp, avaliacaoPadrao, cursoECcp, parseAvaliacaoCurso, type AvaliacaoCurso } from "../partilhado/avaliacaoNota";

export * from "../partilhado/avaliacaoNota";

export function useAvaliacaoCurso(regime: Regime, cursoNome: string | undefined) {
  const { cursosGold, cursosFin } = useLists();
  const [cfg, setCfg] = useState<AvaliacaoCurso>(avaliacaoPadrao);

  const cursoId = useMemo(() => {
    if (!cursoNome) return null;
    return idCursoPorNome(regime, cursoNome, cursosGold, cursosFin);
  }, [cursoNome, cursosFin, cursosGold, regime]);

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

