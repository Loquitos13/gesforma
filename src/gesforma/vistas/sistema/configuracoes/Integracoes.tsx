// Integrações: Google Drive e email (SMTP da Brevo). Os segredos nunca voltam do servidor.
import { useEffect, useState } from "react";
import { useDrive } from "../../../../partilhado/DriveContext";
import {
  apiDesligarDrive, apiDesligarSmtp, apiDrive, apiGravarDrive, apiGravarSmtp, apiSmtp, apiTestarSmtp, urlLigarDrive,
} from "../../../../partilhado/api/configuracoes";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { Aviso, Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Estado } from "../../../../partilhado/ui";

/** Campo só de leitura com botão Copiar (URIs e tokens para colar noutro serviço). */
export function CampoCopiar({ rotulo, valor }: { rotulo: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Campo rotulo={rotulo}>
      {a => (
        <div className="flex gap-2">
          <Entrada {...a} readOnly value={valor} onFocus={e => e.currentTarget.select()} className="font-mono text-[13px]" />
          <Botao onClick={() => { void navigator.clipboard?.writeText(valor).then(() => setCopiado(true)); }}>{copiado ? "Copiado" : "Copiar"}</Botao>
        </div>
      )}
    </Campo>
  );
}

const MENSAGEM_DRIVE: Record<string, { tom: "sucesso" | "aviso" | "perigo"; texto: string }> = {
  ligado: { tom: "sucesso", texto: "Conta Google da entidade ligada. Os próximos ficheiros vão para o Drive." },
  "sem-cliente": { tom: "aviso", texto: "Grave primeiro o Client ID e o secret do cliente OAuth." },
  redirect_uri_mismatch: { tom: "perigo", texto: "O Google recusou o endereço de retorno. Cole os dois URI abaixo, sem os alterar, em «URIs de redireccionamento autorizados» e grave." },
};

export function SeccaoDrive({ resultado, onResultadoVisto }: { resultado?: string; onResultadoVisto: () => void }) {
  const { dados: s, erro, recarregar } = useRecurso("configuracoes:drive", apiDrive);
  const drive = useDrive();
  const [f, setF] = useState({ clientId: "", clientSecret: "", folderId: "" });
  const [desligar, setDesligar] = useState(false);
  useEffect(() => { if (s) setF({ clientId: s.clientId ?? "", clientSecret: "", folderId: s.folderId ?? "" }); }, [s]);
  useEffect(() => { if (resultado) void drive.refresh(); }, [resultado]); // eslint-disable-line react-hooks/exhaustive-deps
  const gravar = useAccao(apiGravarDrive, { ok: "Cliente OAuth gravado. Já pode ligar a conta Google da ENA.", invalidar: ["configuracoes:"] });
  const sair = useAccao(apiDesligarDrive, { ok: "Conta Google desligada. Os novos ficheiros ficam no servidor até voltar a ligar.", invalidar: ["configuracoes:"] });
  const msg = resultado ? MENSAGEM_DRIVE[resultado] ?? { tom: "perigo" as const, texto: "Não foi possível concluir a ligação ao Google. Confirme o URI de redireccionamento e tente outra vez." } : null;

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!s) return <Cartao><Esqueleto linhas={8} /></Cartao>;
  const redirect = s.redirectUri || `${window.location.origin}/api/v1/drive/oauth/callback`;
  const login = s.loginRedirectUri || `${window.location.origin}/api/v1/auth/google/callback`;

  return (
    <Cartao
      titulo="Google Drive da entidade"
      subtitulo={`Documentos, PIP, certificados e conteúdos ficam na pasta «${s.folderName}» da conta da ENA.`}
      acoes={s.connected
        ? <Botao onClick={() => setDesligar(true)}>Desligar</Botao>
        : <Botao variante="primario" disabled={!s.configured} onClick={() => { window.location.href = urlLigarDrive(); }}>Ligar conta Google</Botao>}
    >
      <div className="space-y-4">
        {msg && <Aviso tom={msg.tom} acao={<Botao tamanho="sm" variante="fantasma" onClick={onResultadoVisto}>Fechar</Botao>}>{msg.texto}</Aviso>}
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Estado tom={s.connected ? "sucesso" : s.configured ? "aviso" : "neutro"} ponto>
            {s.connected ? `Ligado como ${s.email ?? "conta Google"}` : s.configured ? "Cliente gravado, conta por ligar" : "Por configurar"}
          </Estado>
          <span className="text-tinta-suave">{s.hint}</span>
        </div>
        {!s.connected && (
          <ol className="m-0 pl-5 text-[13px] text-tinta-suave space-y-1 list-decimal">
            <li>Google Cloud Console → projecto da ENA → active a Google Drive API.</li>
            <li>Ecrã de consentimento OAuth (interno, se for Google Workspace).</li>
            <li>Clientes OAuth → «Aplicação Web». Cole os dois URI abaixo, sem os alterar.</li>
            <li>Grave o Client ID e o secret, e ligue com a conta da secretaria (não uma conta pessoal).</li>
          </ol>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CampoCopiar rotulo="URI de retorno do Drive" valor={redirect} />
          <CampoCopiar rotulo="URI de retorno do login Google" valor={login} />
        </div>
        <fieldset disabled={s.fromEnv} className="m-0 p-0 border-0 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Campo rotulo="Client ID">{a => <Entrada {...a} value={f.clientId} autoComplete="off" placeholder="xxxx.apps.googleusercontent.com" onChange={e => setF({ ...f, clientId: e.target.value })} />}</Campo>
          <Campo rotulo="Client secret" ajuda={s.hasSecret ? "Já gravado: deixe vazio para manter." : undefined}>
            {a => <Entrada {...a} type="password" value={f.clientSecret} autoComplete="new-password" onChange={e => setF({ ...f, clientSecret: e.target.value })} />}
          </Campo>
          <Campo rotulo="ID da pasta (opcional)" ajuda="Vazio: o GesForma cria a pasta.">
            {a => <Entrada {...a} value={f.folderId} onChange={e => setF({ ...f, folderId: e.target.value })} />}
          </Campo>
        </fieldset>
        <div className="flex justify-end">
          <Botao variante="secundario" disabled={s.fromEnv || !f.clientId.trim()} aCarregar={gravar.aCorrer}
            onClick={() => void gravar.correr({ clientId: f.clientId.trim(), clientSecret: f.clientSecret.trim() || undefined, folderId: f.folderId.trim() || undefined, folderName: s.folderName }).then(() => void drive.refresh())}>
            {s.fromEnv ? "Definido no servidor" : "Gravar cliente OAuth"}
          </Botao>
        </div>
      </div>
      <ConfirmarPerigo aberto={desligar} onFechar={() => setDesligar(false)} titulo="Desligar o Google Drive?" acao="Desligar"
        descricao="Os ficheiros já enviados ficam no Drive. Os novos ficam guardados no servidor até voltar a ligar."
        onConfirmar={async () => { await sair.correr(); await drive.refresh(); }} />
    </Cartao>
  );
}

export function SeccaoSmtp() {
  const { dados: s, erro, recarregar } = useRecurso("configuracoes:smtp", apiSmtp);
  const [f, setF] = useState({ host: "", port: "", login: "", smtpKey: "", fromName: "", fromEmail: "", replyTo: "" });
  const [para, setPara] = useState("");
  const [desligar, setDesligar] = useState(false);
  useEffect(() => {
    if (s) setF({ host: s.host, port: String(s.port || ""), login: s.login, smtpKey: "", fromName: s.fromName, fromEmail: s.fromEmail, replyTo: s.replyTo });
  }, [s]);
  const gravar = useAccao(apiGravarSmtp, { ok: "SMTP gravado.", invalidar: ["configuracoes:", "emails:"] });
  const testar = useAccao(apiTestarSmtp, { ok: "Email de teste enviado. Confirme a caixa de entrada." });
  const sair = useAccao(apiDesligarSmtp, { ok: "SMTP desligado. Os emails ficam só no registo até voltar a ligar.", invalidar: ["configuracoes:", "emails:"] });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!s) return <Cartao><Esqueleto linhas={8} /></Cartao>;
  const porta = Number(f.port);

  return (
    <Cartao
      titulo="Email (SMTP)"
      subtitulo="Por onde saem os emails automáticos e de onde vêm as respostas."
      acoes={s.configured && !s.fromEnv ? <Botao onClick={() => setDesligar(true)}>Desligar</Botao> : undefined}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Estado tom={s.configured ? "sucesso" : "aviso"} ponto>{s.configured ? "Ligado" : "Desligado: os emails ficam só no registo"}</Estado>
          <span className="text-tinta-suave">{s.hint}</span>
        </div>
        <fieldset disabled={s.fromEnv} className="m-0 p-0 border-0 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo rotulo="Servidor">{a => <Entrada {...a} value={f.host} onChange={e => setF({ ...f, host: e.target.value })} />}</Campo>
          <Campo rotulo="Porta">{a => <Entrada {...a} inputMode="numeric" value={f.port} onChange={e => setF({ ...f, port: e.target.value.replace(/\D/g, "") })} />}</Campo>
          <Campo rotulo="Login SMTP" obrigatorio>{a => <Entrada {...a} value={f.login} autoComplete="off" onChange={e => setF({ ...f, login: e.target.value })} />}</Campo>
          <Campo rotulo="Chave SMTP" ajuda={s.hasPassword ? "Já gravada: deixe vazio para manter." : "Na Brevo: Transactional → SMTP & API → SMTP."}>
            {a => <Entrada {...a} type="password" autoComplete="new-password" value={f.smtpKey} onChange={e => setF({ ...f, smtpKey: e.target.value })} />}
          </Campo>
          <Campo rotulo="Nome do remetente">{a => <Entrada {...a} value={f.fromName} onChange={e => setF({ ...f, fromName: e.target.value })} />}</Campo>
          <Campo rotulo="Email do remetente" obrigatorio>{a => <Entrada {...a} type="email" value={f.fromEmail} onChange={e => setF({ ...f, fromEmail: e.target.value })} />}</Campo>
          <Campo rotulo="Email para as respostas" obrigatorio className="md:col-span-2" ajuda="Também aparece no rodapé dos emails automáticos.">
            {a => <Entrada {...a} type="email" value={f.replyTo} onChange={e => setF({ ...f, replyTo: e.target.value })} />}
          </Campo>
        </fieldset>
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div className="flex items-end gap-2 flex-wrap">
            <Campo rotulo="Enviar teste para" ajuda="Vazio: o seu email.">
              {a => <Entrada {...a} type="email" value={para} onChange={e => setPara(e.target.value)} className="w-64" />}
            </Campo>
            <Botao disabled={!s.configured} aCarregar={testar.aCorrer} onClick={() => void testar.correr(para.trim() || undefined)}>Testar</Botao>
          </div>
          <Botao variante="primario" disabled={s.fromEnv || f.login.trim().length < 3 || !f.fromEmail || !f.replyTo} aCarregar={gravar.aCorrer}
            onClick={() => void gravar.correr({
              host: f.host.trim() || undefined, port: porta > 0 ? porta : undefined, login: f.login.trim(), smtpKey: f.smtpKey.trim() || undefined,
              fromName: f.fromName.trim() || undefined, fromEmail: f.fromEmail.trim(), replyTo: f.replyTo.trim(),
            })}>
            {s.fromEnv ? "Definido no servidor" : "Gravar"}
          </Botao>
        </div>
      </div>
      <ConfirmarPerigo aberto={desligar} onFechar={() => setDesligar(false)} titulo="Desligar o SMTP?" acao="Desligar"
        descricao="Os emails automáticos deixam de sair (ficam só no registo) até voltar a gravar o SMTP."
        onConfirmar={async () => { await sair.correr(); }} />
    </Cartao>
  );
}
