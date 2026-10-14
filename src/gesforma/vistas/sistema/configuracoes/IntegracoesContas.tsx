// Integrações de contas: entrar com Microsoft e o assistente de WhatsApp (Meta Cloud API).
import { useEffect, useState } from "react";
import {
  apiDesligarMicrosoft, apiDesligarWhatsapp, apiGravarMicrosoft, apiGravarWhatsapp, apiMicrosoft, apiWhatsapp,
} from "../../../../partilhado/api/configuracoes";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Estado, num } from "../../../../partilhado/ui";
import { CampoCopiar } from "./Integracoes";

export function SeccaoMicrosoft() {
  const { dados: s, erro, recarregar } = useRecurso("configuracoes:microsoft", apiMicrosoft);
  const [f, setF] = useState({ clientId: "", clientSecret: "", tenantId: "" });
  const [desligar, setDesligar] = useState(false);
  useEffect(() => { if (s) setF({ clientId: s.clientId ?? "", clientSecret: "", tenantId: s.tenantId ?? "" }); }, [s]);
  const gravar = useAccao(apiGravarMicrosoft, { ok: "Login Microsoft gravado.", invalidar: ["configuracoes:"] });
  const sair = useAccao(apiDesligarMicrosoft, { ok: "Login Microsoft desligado.", invalidar: ["configuracoes:"] });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!s) return <Cartao><Esqueleto linhas={6} /></Cartao>;
  return (
    <Cartao
      titulo="Entrar com Microsoft"
      subtitulo="Para quem já existe como utilizador. Não cria contas novas."
      acoes={s.configured && !s.fromEnv ? <Botao onClick={() => setDesligar(true)}>Desligar</Botao> : undefined}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Estado tom={s.configured ? "sucesso" : "neutro"} ponto>{s.configured ? "Activo" : "Desligado"}</Estado>
          {s.hint && <span className="text-tinta-suave">{s.hint}</span>}
        </div>
        <CampoCopiar rotulo="URI de retorno (colar no Microsoft Entra ID)" valor={s.redirectUri} />
        <fieldset disabled={s.fromEnv} className="m-0 p-0 border-0 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo rotulo="Application (client) ID">{a => <Entrada {...a} value={f.clientId} autoComplete="off" onChange={e => setF({ ...f, clientId: e.target.value })} />}</Campo>
          <Campo rotulo="Client secret" ajuda={s.hasSecret ? "Já gravado: deixe vazio para manter." : undefined}>
            {a => <Entrada {...a} type="password" autoComplete="new-password" value={f.clientSecret} onChange={e => setF({ ...f, clientSecret: e.target.value })} />}
          </Campo>
          <Campo rotulo="Directory (tenant) ID">{a => <Entrada {...a} value={f.tenantId} onChange={e => setF({ ...f, tenantId: e.target.value })} />}</Campo>
        </fieldset>
        <div className="flex justify-end">
          <Botao variante="primario" disabled={s.fromEnv || f.clientId.trim().length < 12} aCarregar={gravar.aCorrer}
            onClick={() => void gravar.correr({ clientId: f.clientId.trim(), clientSecret: f.clientSecret.trim() || undefined, tenantId: f.tenantId.trim() || undefined })}>
            {s.fromEnv ? "Definido no servidor" : "Gravar"}
          </Botao>
        </div>
      </div>
      <ConfirmarPerigo aberto={desligar} onFechar={() => setDesligar(false)} titulo="Desligar o login Microsoft?" acao="Desligar"
        descricao="O botão «Entrar com Microsoft» deixa de funcionar. Quem o usava entra com email e palavra-passe."
        onConfirmar={async () => { await sair.correr(); }} />
    </Cartao>
  );
}

export function SeccaoWhatsapp() {
  const { dados: s, erro, recarregar } = useRecurso("configuracoes:whatsapp", apiWhatsapp);
  const [f, setF] = useState({ token: "", phoneId: "" });
  const [desligar, setDesligar] = useState(false);
  useEffect(() => { if (s) setF({ token: "", phoneId: s.phoneId }); }, [s]);
  const gravar = useAccao(apiGravarWhatsapp, { ok: "Token gravado.", invalidar: ["configuracoes:"] });
  const sair = useAccao(apiDesligarWhatsapp, { ok: "WhatsApp desligado. O simulador do CRM continua a funcionar.", invalidar: ["configuracoes:"] });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!s) return <Cartao><Esqueleto linhas={6} /></Cartao>;
  return (
    <Cartao
      titulo="WhatsApp · assistente de pré-inscrição"
      subtitulo={`Meta Cloud API. ${num(s.sessoes)} conversa(s) registadas.`}
      acoes={s.hasToken && !s.fromEnv ? <Botao onClick={() => setDesligar(true)}>Desligar</Botao> : undefined}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Estado tom={s.ligado ? "sucesso" : s.hasToken ? "aviso" : "neutro"} ponto>
            {s.ligado ? `Ligado${s.displayPhone ? ` · ${s.displayPhone}` : ""}` : s.hasToken ? "Token gravado, falta o número" : "Desligado"}
          </Estado>
          <span className="text-tinta-suave">{s.hint}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CampoCopiar rotulo="Callback URL (colar no Meta)" valor={s.webhook} />
          {s.verifyToken && <CampoCopiar rotulo="Verify token (colar no Meta)" valor={s.verifyToken} />}
        </div>
        <fieldset disabled={s.fromEnv} className="m-0 p-0 border-0 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo rotulo="Token da Cloud API" ajuda={s.hasToken ? "Já gravado: cole um novo só para o trocar." : "Na página API Setup do Meta."}>
            {a => <Entrada {...a} type="password" autoComplete="new-password" value={f.token} onChange={e => setF({ ...f, token: e.target.value })} />}
          </Campo>
          <Campo rotulo="Phone number ID" ajuda="Só se o Meta não o preencher sozinho.">
            {a => <Entrada {...a} value={f.phoneId} onChange={e => setF({ ...f, phoneId: e.target.value })} />}
          </Campo>
        </fieldset>
        <div className="flex justify-end">
          <Botao variante="primario" disabled={s.fromEnv || (!f.token.trim() && f.phoneId === s.phoneId)} aCarregar={gravar.aCorrer}
            onClick={() => void gravar.correr({ token: f.token.trim() || undefined, phoneId: f.phoneId.trim() || undefined })}>
            {s.fromEnv ? "Definido no servidor" : "Gravar"}
          </Botao>
        </div>
      </div>
      <ConfirmarPerigo aberto={desligar} onFechar={() => setDesligar(false)} titulo="Desligar o WhatsApp?" acao="Desligar"
        descricao="O assistente deixa de responder no WhatsApp. As conversas registadas ficam."
        onConfirmar={async () => { await sair.correr(); }} />
    </Cartao>
  );
}
