// Propostas, contratos e modelos num só ecrã, por separadores.
import { useState } from "react";
import { apiContratos, apiModelos, apiPropostas } from "../../../partilhado/api/crmDiretorio";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Botao, PageHeader, Separadores, useFiltrosUrl } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { trilhoCrm, useGestao } from "./comum";
import { TabContratos } from "./TabContratos";
import { TabModelos } from "./TabModelos";
import { TabPropostas } from "./TabPropostas";

type Tab = "propostas" | "contratos" | "modelos";

export default function Contratos({ view, navigate }: VistaProps) {
  const [f, setF] = useFiltrosUrl({ tab: "propostas" });
  const tab = (["propostas", "contratos", "modelos"].includes(f.tab) ? f.tab : "propostas") as Tab;
  const gestao = useGestao();
  const [novo, setNovo] = useState(0);
  // Só para as contagens dos separadores (as listas pedem as suas páginas).
  const nP = useRecurso("crm:propostas:contagem", signal => apiPropostas({ pagina: 1 }, { signal }));
  const nK = useRecurso("crm:contratos:contagem", signal => apiContratos({ pagina: 1 }, { signal }));
  const nMp = useRecurso("crm:modelos:proposta", signal => apiModelos("proposta", { signal }));
  const nMc = useRecurso("crm:modelos:contrato", signal => apiModelos("contrato", { signal }));
  const nModelos = nMp.dados && nMc.dados ? nMp.dados.modelos.length + nMc.dados.modelos.length : undefined;
  const novoTexto = { propostas: "Nova proposta", contratos: "Novo contrato", modelos: "Novo modelo" }[tab];

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={trilhoCrm(view, navigate, "Contratos")}
        titulo="Propostas e contratos"
        subtitulo="Propostas enviadas aos clientes, os contratos que delas resultam e os modelos de texto que a equipa reutiliza."
        acoes={tab === "modelos" && !gestao ? undefined : <Botao variante="primario" onClick={() => setNovo(n => n + 1)}>{novoTexto}</Botao>}
      />
      <Separadores<Tab>
        rotulo="Secções"
        ativo={tab}
        onMudar={t => setF({ tab: t })}
        itens={[
          { id: "propostas", rotulo: "Propostas", contagem: nP.dados?.total },
          { id: "contratos", rotulo: "Contratos", contagem: nK.dados?.total },
          { id: "modelos", rotulo: "Modelos", contagem: nModelos },
        ]}
      />
      {tab === "propostas" && <TabPropostas novo={novo} onVerContratos={() => setF({ tab: "contratos" })} />}
      {tab === "contratos" && <TabContratos novo={novo} />}
      {tab === "modelos" && <TabModelos novo={novo} />}
    </div>
  );
}
