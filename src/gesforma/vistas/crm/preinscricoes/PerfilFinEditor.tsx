import { useEffect, useMemo, useState } from "react";
import { apiGravarDadosFin, type PerfilFinLead } from "../../../../partilhado/api/crm";
import { GENEROS_FIN, HABILITACOES_FIN, rotuloPais } from "../../../../partilhado/dadosPessoaisFin";
import { LISTA_PAISES } from "../../../../partilhado/execucaoFisica";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { Botao, Campo, Entrada, Selecao } from "../../../../partilhado/ui";

const PAISES = LISTA_PAISES.map(v => ({ valor: v, rotulo: rotuloPais(v) }));

/**
 * Financiada: género, data de nascimento, nacionalidade e habilitações (os do formulário público), para a equipa
 * pôr à mão quando a pessoa não os indicou (ou corrigir). O servidor valida com as mesmas regras do site.
 */
export function PerfilFinEditor({ leadId, perfil, onMudou }: { leadId: number; perfil: PerfilFinLead; onMudou: () => void }) {
  const [v, setV] = useState(perfil);
  useEffect(() => { setV(perfil); }, [perfil]);
  const gravar = useAccao(apiGravarDadosFin, { ok: "Dados pessoais gravados." });
  const mudou = useMemo(() => (Object.keys(v) as (keyof PerfilFinLead)[]).filter(k => v[k] !== perfil[k]), [v, perfil]);
  const set = (k: keyof PerfilFinLead, valor: string) => setV(x => ({ ...x, [k]: valor }));

  async function guardar() {
    const r = await gravar.correr(leadId, Object.fromEntries(mudou.map(k => [k, v[k]])));
    if (r) onMudou();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Género">
          {p => <Selecao {...p} opcoes={GENEROS_FIN.map(g => ({ valor: g.valor, rotulo: g.rotulo }))} vazio="—" value={v.genero} onChange={e => set("genero", e.target.value)} />}
        </Campo>
        <Campo rotulo="Data de nascimento">
          {p => <Entrada {...p} type="date" value={v.dataNascimento} onChange={e => set("dataNascimento", e.target.value)} />}
        </Campo>
        <Campo rotulo="Nacionalidade">
          {p => <Selecao {...p} opcoes={PAISES} vazio="—" value={v.nacionalidade} onChange={e => set("nacionalidade", e.target.value)} />}
        </Campo>
        <Campo rotulo="Habilitações">
          {p => <Selecao {...p} opcoes={HABILITACOES_FIN.map(h => ({ valor: h.rotulo, rotulo: h.rotulo }))} vazio="—" value={v.habilitacoes} onChange={e => set("habilitacoes", e.target.value)} />}
        </Campo>
      </div>
      {mudou.length > 0 && (
        <div className="flex gap-2">
          <Botao variante="primario" tamanho="sm" aCarregar={gravar.aCorrer} onClick={() => void guardar()}>Gravar dados pessoais</Botao>
          <Botao variante="fantasma" tamanho="sm" onClick={() => setV(perfil)}>Descartar</Botao>
        </div>
      )}
    </div>
  );
}
