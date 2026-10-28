// Email à pessoa da pré-inscrição, enviado pelo GesForma: o remetente é o email do local do pedido (ccplisboa@ena.pt
// para Lisboa…), e não a conta predefinida do Outlook. As respostas vão para essa caixa, que recebe uma cópia oculta.
import { useEffect, useState } from "react";
import { apiEnviarEmailLead, apiRemetentesLead, type DossieLead } from "../../../../partilhado/api/crm";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { toastError, toastOk } from "../../../../partilhado/toastBus";
import { AreaTexto, Aviso, Botao, Campo, Entrada, Esqueleto, Modal, Selecao } from "../../../../partilhado/ui";

export function EmailLead({ d, aberto, onFechar, onEnviado }: { d: DossieLead; aberto: boolean; onFechar: () => void; onEnviado: () => void }) {
  const id = d.lead.id;
  const { dados: info, erro } = useRecurso(aberto ? `crm:lead:${id}:remetentes` : null, signal => apiRemetentesLead(id, signal));
  const [de, setDe] = useState("");
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setAssunto(d.lead.curso ? `${d.lead.curso} · ENA` : "Pré-inscrição · ENA");
    setTexto(`Olá ${d.lead.nome || ""},\n\n`.replace(" ,", ","));
  }, [aberto, d.lead.curso, d.lead.nome]);
  useEffect(() => { if (info) setDe(info.sugerido || info.remetentes[0]?.email || ""); }, [info]);

  async function enviar() {
    setAEnviar(true);
    try {
      const r = await apiEnviarEmailLead(id, { de, assunto: assunto.trim(), texto: texto.trim() });
      toastOk(`Email enviado de ${r.de} para ${r.para}.`);
      onEnviado();
      onFechar();
    } catch (e) {
      toastError(e, "Não foi possível enviar o email.");
    } finally {
      setAEnviar(false);
    }
  }

  const mailto = `mailto:${d.lead.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
  const semLocais = info && info.remetentes.length === 0;
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Enviar email" subtitulo={`Para ${d.lead.email}`}
      rodape={<>
        <a className="mr-auto self-center text-[13px] text-ligacao hover:underline" href={mailto}>Abrir no Outlook</a>
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao variante="primario" aCarregar={aEnviar} disabled={!de || !assunto.trim() || !texto.trim()} onClick={() => void enviar()}>Enviar</Botao>
      </>}>
      {erro ? <Aviso tom="perigo">Não foi possível ler os remetentes.</Aviso> : !info ? <Esqueleto linhas={4} /> : (
        <div className="space-y-3">
          {semLocais
            ? <Aviso tom="aviso">Nenhum local tem email. Indique o email de cada local em Edição de cursos › Locais (por exemplo, ccplisboa@ena.pt).</Aviso>
            : (
              <Campo rotulo="De" ajuda={info.sugerido ? `O email do local da pré-inscrição (${info.local}). As respostas vão para esta caixa, que recebe também uma cópia.` : "O local da pré-inscrição não tem email: escolha o remetente."}>
                {p => <Selecao {...p} value={de} onChange={e => setDe(e.target.value)} opcoes={info.remetentes.map(r => ({ valor: r.email, rotulo: `${r.local} · ${r.email}` }))} />}
              </Campo>
            )}
          <Campo rotulo="Para">{p => <Entrada {...p} value={info.para} readOnly />}</Campo>
          <Campo rotulo="Assunto">{p => <Entrada {...p} maxLength={200} value={assunto} onChange={e => setAssunto(e.target.value)} />}</Campo>
          <Campo rotulo="Mensagem">{p => <AreaTexto {...p} rows={8} maxLength={10000} value={texto} onChange={e => setTexto(e.target.value)} />}</Campo>
        </div>
      )}
    </Modal>
  );
}
