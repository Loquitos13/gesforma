// Sistema › Configurações: secções à esquerda (com o estado de cada uma) e o formulário à direita.
import { useMemo, type ReactNode } from "react";
import { useAuth, usePode } from "../../../partilhado/AuthGate";
import { apiDefinicoes, apiEstadoConfiguracoes, type EstadoConfiguracoes } from "../../../partilhado/api/configuracoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Aviso, Botao, Cartao, ErroCarregar, Esqueleto, Estado, PageHeader, cx, useFiltrosUrl, type Tom } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { RegrasApoios } from "../formandos/apoios/RegrasApoios";
import { SeccaoAuditoria } from "./configuracoes/Auditoria";
import { SeccaoAvaliacoesGoogle } from "./configuracoes/AvaliacoesGoogle";
import { SeccaoDrive, SeccaoSmtp } from "./configuracoes/Integracoes";
import { SeccaoMicrosoft, SeccaoWhatsapp } from "./configuracoes/IntegracoesContas";
import { LogoEntidade } from "./configuracoes/LogoEntidade";
import { SeccaoDefinicoes } from "./configuracoes/SeccaoDefinicoes";
import { CAMPOS_CANDIDATURA, CAMPOS_ENTIDADE, CAMPOS_FIN, CAMPOS_FORMACAO, CAMPOS_GOLD, CAMPOS_LEMBRETE, CAMPOS_REGRAS } from "./configuracoes/secoes";
import { CANDIDATURA_FIN_OMISSAO } from "../../../partilhado/candidaturaFin";
import { SeccaoSeloAssinatura } from "./configuracoes/SeloAssinatura";
import { SeccaoSeguranca } from "./configuracoes/Seguranca";

type Seccao = { id: string; rotulo: string; grupo: string; soAdmin?: boolean; estado?: (e: EstadoConfiguracoes) => { texto: string; tom: Tom } };

const SECCOES: Seccao[] = [
  { id: "entidade", rotulo: "Entidade", grupo: "Entidade", estado: e => (e.entidade.completa ? { texto: "Completa", tom: "sucesso" } : { texto: `${e.entidade.emFalta.length} em falta`, tom: "aviso" }) },
  { id: "regras", rotulo: "Regras pedagógicas", grupo: "Entidade" },
  { id: "formacao", rotulo: "Formação", grupo: "Entidade" },
  { id: "gold", rotulo: "Gold", grupo: "Entidade" },
  { id: "fin", rotulo: "Financiada", grupo: "Entidade" },
  { id: "apoios", rotulo: "Apoios (Financiada)", grupo: "Entidade" },
  { id: "lembretes", rotulo: "Lembretes", grupo: "Comunicação", estado: e => (e.lembrete.activo ? { texto: `A cada ${e.lembrete.quantidade} ${e.lembrete.unidade}`, tom: "sucesso" } : { texto: "Desligado", tom: "neutro" }) },
  { id: "smtp", rotulo: "Email (SMTP)", grupo: "Comunicação", soAdmin: true, estado: e => (e.smtp.ligado ? { texto: "Ligado", tom: "sucesso" } : { texto: "Desligado", tom: "aviso" }) },
  { id: "whatsapp", rotulo: "WhatsApp", grupo: "Comunicação", soAdmin: true, estado: e => (e.whatsapp.ligado ? { texto: "Ligado", tom: "sucesso" } : { texto: "Desligado", tom: "neutro" }) },
  { id: "drive", rotulo: "Google Drive", grupo: "Integrações", estado: e => (e.drive.ligado ? { texto: "Ligado", tom: "sucesso" } : { texto: "Por ligar", tom: "aviso" }) },
  { id: "google-avaliacoes", rotulo: "Avaliações Google", grupo: "Integrações", soAdmin: true, estado: e => (e.googleAvaliacoes.ligado ? (e.googleAvaliacoes.erro ? { texto: "Com erro", tom: "aviso" } : { texto: "Ligado", tom: "sucesso" }) : { texto: "Desligado", tom: "neutro" }) },
  { id: "microsoft", rotulo: "Entrar com Microsoft", grupo: "Integrações", soAdmin: true, estado: e => (e.microsoft.ligado ? { texto: "Activo", tom: "sucesso" } : { texto: "Desligado", tom: "neutro" }) },
  { id: "pagamentos", rotulo: "Pagamentos", grupo: "Integrações", estado: () => ({ texto: "Gateway por escolher", tom: "neutro" }) },
  { id: "moodle", rotulo: "Moodle", grupo: "Integrações", estado: () => ({ texto: "Em pausa", tom: "neutro" }) },
  { id: "selo", rotulo: "Assinatura e selo", grupo: "Administração", soAdmin: true },
  { id: "seguranca", rotulo: "Segurança", grupo: "Administração", soAdmin: true, estado: e => (e.avisos ? { texto: `${e.avisos} aviso(s)`, tom: "perigo" } : { texto: "Sem avisos", tom: "sucesso" }) },
  { id: "auditoria", rotulo: "Auditoria", grupo: "Administração", soAdmin: true },
];

/** Valores efectivos das regras (com os do servidor por omissão), no formato das definições. */
function comoTexto(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "boolean" ? (v ? "1" : "0") : String(v)]));
}

function Informativa({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <Cartao titulo={titulo}><div className="space-y-3 text-sm text-tinta-suave">{children}</div></Cartao>;
}

export default function Configuracoes({ params, navigate }: VistaProps) {
  const { user } = useAuth();
  const pode = usePode();
  const admin = user.role === "admin";
  const editar = pode("configuracoes.editar");
  const [f, setF] = useFiltrosUrl({ secao: params.drive ? "drive" : "entidade", drive: params.drive ?? "" });
  const { dados: estado, erro, recarregar } = useRecurso("configuracoes:estado", apiEstadoConfiguracoes);
  const { dados: defs } = useRecurso("configuracoes:definicoes", apiDefinicoes);
  const seccoes = SECCOES.filter(s => !s.soAdmin || admin);
  const atual = seccoes.find(s => s.id === f.secao) ?? seccoes[0]!;
  const grupos = useMemo(() => [...new Set(seccoes.map(s => s.grupo))], [seccoes]);
  const settings = defs?.settings ?? {};

  function conteudo() {
    if (!estado) return <Cartao><Esqueleto linhas={8} /></Cartao>;
    switch (atual.id) {
      case "entidade":
        return (
          <div className="space-y-4">
            <LogoEntidade podeEditar={admin} />
            <SeccaoDefinicoes id="entidade" titulo="Entidade formadora" soAdmin podeEditar={admin} campos={CAMPOS_ENTIDADE} valores={settings.entidade}
              descricao="Designação, contactos e a conta para transferências. Aparecem nos documentos e no pedido de pagamento." />
          </div>
        );
      case "regras":
        return <SeccaoDefinicoes id="regras_pedagogicas" titulo="Regras pedagógicas" soAdmin podeEditar={admin} campos={CAMPOS_REGRAS}
          valores={settings.regras_pedagogicas ?? comoTexto(estado.regras)} descricao="Valem para todas as turmas. Cada curso pode ter regras próprias na ficha do curso." />;
      case "formacao":
        return <SeccaoDefinicoes id="formacao" titulo="Formação" podeEditar={editar} campos={CAMPOS_FORMACAO} valores={settings.formacao} descricao="Notas internas sobre arquivo e documentos." />;
      case "gold":
        return <SeccaoDefinicoes id="gold" titulo="Gold" podeEditar={editar} campos={CAMPOS_GOLD} valores={settings.gold} descricao="Notas internas da formação autofinanciada. Os preços estão em cada curso." />;
      case "fin":
        return (
          <div className="space-y-4">
            <SeccaoDefinicoes id="candidatura_fin" titulo="Candidatura" podeEditar={editar} campos={CAMPOS_CANDIDATURA}
              valores={settings.candidatura_fin ?? CANDIDATURA_FIN_OMISSAO}
              descricao="Programa e tipologias da candidatura. Saem na ficha de inscrição e na folha de presenças / sumário de todas as turmas da Financiada." />
            <SeccaoDefinicoes id="fin" titulo="Financiada" podeEditar={editar} campos={CAMPOS_FIN} valores={settings.fin} descricao="Notas internas da formação financiada." />
          </div>
        );
      case "apoios": return <RegrasApoios podeEditar={editar} />;
      case "lembretes":
        return <SeccaoDefinicoes id="lembrete_pre" titulo="Lembrete da pré-inscrição" soAdmin podeEditar={admin} campos={CAMPOS_LEMBRETE}
          valores={settings.lembrete_pre ?? comoTexto(estado.lembrete)} descricao="Email automático enquanto a pré-inscrição não estiver validada (e aos formandos da Financiada com documentos do dossiê em falta, depois de um lembrete manual ou de uma recusa). A ligação pessoal fica aberta enquanto faltarem documentos ou houver recusados por corrigir; sem nada pendente, expira ao fim de 90 dias sem actividade." />;
      case "smtp": return <SeccaoSmtp />;
      case "whatsapp": return <SeccaoWhatsapp />;
      case "drive": return <SeccaoDrive resultado={f.drive || undefined} onResultadoVisto={() => setF({ drive: "" })} />;
      case "microsoft": return <SeccaoMicrosoft />;
      case "google-avaliacoes": return <SeccaoAvaliacoesGoogle />;
      case "pagamentos":
        return (
          <Informativa titulo="Pagamentos">
            <p className="m-0">Hoje os pagamentos fazem-se por transferência bancária com comprovativo. A secretaria confirma-os em Sistema › Pagamentos.</p>
            <p className="m-0">Métodos aceites: {estado.pagamentos.metodos.join(", ")}.</p>
            <Aviso tom="info" titulo="Pagamento automático: por escolher">Multibanco, MB WAY e cartão precisam de um gateway (por exemplo Ifthenpay, easypay ou SIBS). Quando for escolhido, a ligação faz-se aqui.</Aviso>
            <p className="m-0">IBAN: {estado.entidade.iban ? "definido em Entidade." : "em falta. Defina-o em Entidade para os pedidos de pagamento o mostrarem."}</p>
            <div><Botao tamanho="sm" onClick={() => navigate("pagamentos")}>Abrir Pagamentos</Botao></div>
          </Informativa>
        );
      case "moodle":
        return (
          <Informativa titulo="Moodle">
            <p className="m-0">A integração com o Moodle está em pausa. Os conteúdos dos cursos continuam na Drive e na área do formando.</p>
          </Informativa>
        );
      case "selo": return <SeccaoSeloAssinatura />;
      case "seguranca": return <SeccaoSeguranca />;
      case "auditoria": return <SeccaoAuditoria />;
      default: return null;
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: "Sistema" }, { rotulo: "Configurações" }]}
        titulo="Configurações"
        subtitulo={admin ? "Parâmetros da entidade, integrações e segurança." : "Parâmetros da entidade e integrações. Algumas secções só a administração altera."}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      {admin && estado && estado.avisos > 0 && atual.id !== "seguranca" && (
        <Aviso tom="perigo" titulo="Há avisos de configuração do servidor" acao={<Botao tamanho="sm" onClick={() => setF({ secao: "seguranca" })}>Ver</Botao>}>
          Faltam variáveis de ambiente ou estão com valores de desenvolvimento.
        </Aviso>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-5 items-start">
        <nav aria-label="Secções das configurações" className="bg-superficie border border-linha rounded-cartao p-2 lg:sticky lg:top-4">
          {grupos.map(g => (
            <div key={g} className="mb-2 last:mb-0">
              <p className="m-0 px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-tinta-fraca">{g}</p>
              <ul className="m-0 p-0 list-none">
                {seccoes.filter(s => s.grupo === g).map(s => {
                  const e = estado && s.estado ? s.estado(estado) : null;
                  return (
                    <li key={s.id}>
                      <button type="button" aria-current={atual.id === s.id ? "page" : undefined} onClick={() => setF({ secao: s.id })}
                        className={cx("w-full text-left rounded-controlo px-3 py-2 flex items-center gap-2", atual.id === s.id ? "bg-acao-suave/60 font-semibold" : "hover:bg-fundo")}>
                        <span className="flex-1 text-sm text-tinta">{s.rotulo}</span>
                        {e && <Estado tom={e.tom} className="!text-[11px]">{e.texto}</Estado>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="min-w-0">{conteudo()}</div>
      </div>
    </div>
  );
}
