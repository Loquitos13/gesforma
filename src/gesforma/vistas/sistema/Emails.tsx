// Sistema › Emails automáticos: regras (quando sai cada email), modelos (o que diz) e histórico de envios.
import { apiOpcoesEmail } from "../../../partilhado/api/emails";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { usePode } from "../../../partilhado/AuthGate";
import { ErroCarregar, PageHeader, Separadores, useFiltrosUrl } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { Historico } from "./emails/Historico";
import { Modelos } from "./emails/Modelos";
import { Regras } from "./emails/Regras";

type Aba = "regras" | "modelos" | "historico";

export default function Emails({ navigate }: VistaProps) {
  const [f, setF] = useFiltrosUrl({ aba: "regras" });
  // O histórico dos envios (destinatários) é só da secretaria; modelos e regras são de toda a equipa.
  const verHistorico = usePode()("emails.historico");
  const abas: Aba[] = verHistorico ? ["regras", "modelos", "historico"] : ["regras", "modelos"];
  const aba = (abas.includes(f.aba as Aba) ? f.aba : "regras") as Aba;
  const { dados: opcoes, erro, recarregar } = useRecurso("emails:opcoes", apiOpcoesEmail);

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: "Sistema", onClick: () => navigate("configuracoes") }, { rotulo: "Emails automáticos" }]}
        titulo="Emails automáticos"
        subtitulo={opcoes ? `Saem de ${opcoes.remetente}. As respostas vão para ${opcoes.contacto || "o remetente"}.` : "Regras, modelos e histórico de envios."}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <Separadores
        rotulo="Emails automáticos"
        ativo={aba}
        onMudar={id => setF({ aba: id })}
        itens={[{ id: "regras", rotulo: "Regras" }, { id: "modelos", rotulo: "Modelos" }, ...(verHistorico ? [{ id: "historico", rotulo: "Histórico" }] : [])]}
      />
      {aba === "regras" && <Regras opcoes={opcoes} onEditarModelo={() => setF({ aba: "modelos" })} />}
      {aba === "modelos" && <Modelos opcoes={opcoes} />}
      {aba === "historico" && verHistorico && <Historico />}
    </div>
  );
}
