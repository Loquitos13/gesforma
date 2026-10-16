// Ficha de um utilizador (painel lateral) e criação de contas novas.
import { useEffect, useState } from "react";
import { useAuth } from "../../../../partilhado/AuthGate";
import {
  apiAlterarUtilizador, apiApagarUtilizador, apiCriarUtilizador, apiTerminarSessoes, apiUtilizador, type PerfilUtilizador,
} from "../../../../partilhado/api/utilizadores";
import { useAccao } from "../../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../../partilhado/dados/useRecurso";
import { gerarPalavraPasse, mensagemPalavraPasse, palavraPasseValida } from "../../../../partilhado/passwordPolicy";
import {
  Aviso, Botao, Caixa, Campo, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Modal, PainelLateral, dataHora, num,
} from "../../../../partilhado/ui";
import { STAFF_ROLES } from "../../../UsersView";
import { NovaPalavraPasse, PalavraPasseTemporaria } from "./PalavraPasse";

const INVALIDAR = ["utilizadores:"];

function EscolherPerfil({ valor, onMudar, desativado }: { valor: string; onMudar: (p: PerfilUtilizador) => void; desativado?: boolean }) {
  return (
    <fieldset className="m-0 p-0 border-0" disabled={desativado}>
      <legend className="text-[13px] font-medium text-tinta mb-1.5">Perfil</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {STAFF_ROLES.map(r => (
          <label key={r.value} className={`flex items-start gap-2 rounded-controlo border p-3 cursor-pointer ${valor === r.value ? "border-acao bg-acao-suave/50" : "border-linha hover:bg-fundo"}`}>
            <input type="radio" name="perfil" className="mt-0.5 accent-[#1D4E89]" checked={valor === r.value} onChange={() => onMudar(r.value as PerfilUtilizador)} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-tinta">{r.label}</span>
              <span className="block text-xs text-tinta-suave">{r.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FichaUtilizador({ id, onFechar }: { id: string | null; onFechar: () => void; perfilInicial?: PerfilUtilizador | "" }) {
  const { user: eu } = useAuth();
  const { dados, erro, recarregar } = useRecurso(id ? `utilizadores:ficha:${id}` : null, signal => apiUtilizador(id!, signal));
  const u = dados?.user;
  const [f, setF] = useState({ name: "", email: "", role: "secretaria" as PerfilUtilizador });
  const [palavraPasse, setPalavraPasse] = useState(false);
  const [apagar, setApagar] = useState(false);
  const [desactivar, setDesactivar] = useState(false);
  useEffect(() => { if (u) setF({ name: u.name, email: u.email, role: u.role }); }, [u]);

  const gravar = useAccao(apiAlterarUtilizador, { ok: "Dados do utilizador actualizados.", invalidar: INVALIDAR });
  const terminar = useAccao(apiTerminarSessoes, { ok: r => `${num(r.terminadas)} sessão(ões) terminada(s).`, invalidar: INVALIDAR });
  const remover = useAccao(apiApagarUtilizador, { ok: "Utilizador eliminado.", invalidar: INVALIDAR });
  const propria = u?.id === eu.id;
  const mudou = u && (f.name !== u.name || f.email !== u.email || f.role !== u.role);

  return (
    <PainelLateral
      aberto={Boolean(id)}
      onFechar={onFechar}
      largura={560}
      titulo={u?.name ?? "Utilizador"}
      subtitulo={u ? `${u.active ? "Activo" : "Inactivo"} · criado em ${dataHora(u.created_at)}` : undefined}
      rodape={u ? (
        <>
          <Botao variante="secundario" disabled={propria} aCarregar={gravar.aCorrer}
            onClick={() => (u.active ? setDesactivar(true) : void gravar.correr(u.id, { active: true }).then(() => recarregar()))}>
            {u.active ? "Desactivar" : "Activar"}
          </Botao>
          <Botao variante="primario" disabled={!mudou || f.name.trim().length < 2} aCarregar={gravar.aCorrer}
            onClick={() => void gravar.correr(u.id, { name: f.name.trim(), email: f.email.trim(), role: f.role }).then(() => recarregar())}>
            Guardar
          </Botao>
        </>
      ) : undefined}
    >
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : !u ? <Esqueleto linhas={10} /> : (
        <div className="space-y-5">
          {propria && <Aviso tom="info">É a sua conta: não a pode desactivar nem eliminar aqui.</Aviso>}
          <Campo rotulo="Nome" obrigatorio>{a => <Entrada {...a} value={f.name} maxLength={120} onChange={e => setF({ ...f, name: e.target.value })} />}</Campo>
          <Campo rotulo="Email" obrigatorio ajuda="É o utilizador do login. Para entrar com Google ou Microsoft, tem de ser o mesmo email dessa conta.">
            {a => <Entrada {...a} type="email" value={f.email} maxLength={254} onChange={e => setF({ ...f, email: e.target.value })} />}
          </Campo>
          <EscolherPerfil valor={f.role} onMudar={role => setF({ ...f, role })} desativado={propria} />

          <section aria-label="Acesso" className="rounded-cartao border border-linha p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="m-0 text-[13px] font-semibold text-tinta flex-1">Acesso</p>
              <Botao tamanho="sm" onClick={() => setPalavraPasse(true)}>Nova palavra-passe</Botao>
              <Botao tamanho="sm" disabled={!dados.sessoes.length} aCarregar={terminar.aCorrer}
                onClick={() => void terminar.correr(u.id).then(() => recarregar())}>Terminar sessões</Botao>
            </div>
            <p className="m-0 text-[13px] text-tinta-suave">
              Último acesso: {u.last_login_at ? dataHora(u.last_login_at) : "nunca entrou"}.
              {u.mustChangePassword ? " Tem de mudar a palavra-passe no próximo acesso." : ""}
            </p>
            {dados.sessoes.length > 0 ? (
              <ul className="m-0 p-0 list-none divide-y divide-linha-suave text-[13px]">
                {dados.sessoes.map(s => (
                  <li key={s.id} className="py-2 flex gap-3 flex-wrap">
                    <span className="text-tinta">{dataHora(s.criada)}</span>
                    <span className="text-tinta-suave">{s.ip || "IP desconhecido"}</span>
                    <span className="text-tinta-suave truncate min-w-0 flex-1" title={s.navegador ?? ""}>{s.navegador || "navegador desconhecido"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="m-0 text-[13px] text-tinta-suave">Sem sessões abertas.</p>}
          </section>

          {!propria && (
            <div className="pt-3 border-t border-linha">
              <Botao tamanho="sm" variante="fantasma" className="text-perigo" onClick={() => setApagar(true)}>Eliminar utilizador</Botao>
            </div>
          )}
        </div>
      )}

      {u && <NovaPalavraPasse aberto={palavraPasse} onFechar={() => setPalavraPasse(false)} utilizador={u} onFeito={recarregar} />}
      <ConfirmarPerigo
        aberto={apagar}
        onFechar={() => setApagar(false)}
        titulo="Eliminar este utilizador?"
        descricao="A conta e as sessões abertas desaparecem. Se só quer impedir o acesso, desactive-a."
        confirmarTexto={u?.email}
        onConfirmar={async () => { if (u && await remover.correr(u.id)) onFechar(); }}
      />
      <ConfirmarPerigo
        aberto={desactivar}
        onFechar={() => setDesactivar(false)}
        titulo="Desactivar este utilizador?"
        descricao="As sessões abertas terminam e a pessoa deixa de conseguir entrar. Os dados ficam; pode voltar a activá-la."
        acao="Desactivar"
        onConfirmar={async () => { if (u && await gravar.correr(u.id, { active: false })) recarregar(); }}
      />
    </PainelLateral>
  );
}

export function NovoUtilizador({ aberto, onFechar, perfilInicial }: { aberto: boolean; onFechar: (id?: string) => void; perfilInicial: PerfilUtilizador | "" }) {
  const [f, setF] = useState({ name: "", email: "", role: "secretaria" as PerfilUtilizador, password: "", mudar: true });
  const [criada, setCriada] = useState<{ id: string; email: string; password: string } | null>(null);
  const criar = useAccao(apiCriarUtilizador, { ok: "Utilizador criado.", invalidar: INVALIDAR });
  useEffect(() => {
    if (aberto) {
      setF({ name: "", email: "", role: perfilInicial || "secretaria", password: gerarPalavraPasse(), mudar: true });
      setCriada(null);
    }
  }, [aberto, perfilInicial]);
  const erroPass = f.password && !palavraPasseValida(f.password) ? mensagemPalavraPasse(f.password) : null;
  const valido = f.name.trim().length > 1 && /\S+@\S+\.\S+/.test(f.email) && !erroPass && f.password;

  async function gravar() {
    const r = await criar.correr({ name: f.name.trim(), email: f.email.trim(), role: f.role, password: f.password, mustChangePassword: f.mudar });
    if (r) setCriada({ id: r.user.id, email: r.user.email, password: f.password });
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={() => onFechar(criada?.id)}
      titulo={criada ? "Conta criada" : "Novo utilizador"}
      largura="lg"
      rodape={criada
        ? <Botao variante="primario" onClick={() => onFechar(criada.id)}>Concluir</Botao>
        : (
          <>
            <Botao onClick={() => onFechar()}>Cancelar</Botao>
            <Botao variante="primario" disabled={!valido} aCarregar={criar.aCorrer} onClick={() => void gravar()}>Criar conta</Botao>
          </>
        )}
    >
      {criada ? (
        <PalavraPasseTemporaria email={criada.email} password={criada.password} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo rotulo="Nome" obrigatorio>{a => <Entrada {...a} value={f.name} maxLength={120} onChange={e => setF({ ...f, name: e.target.value })} data-autofocus />}</Campo>
            <Campo rotulo="Email" obrigatorio ajuda="O mesmo da conta Google ou Microsoft, se quiser entrar por aí.">
              {a => <Entrada {...a} type="email" value={f.email} maxLength={254} onChange={e => setF({ ...f, email: e.target.value })} />}
            </Campo>
          </div>
          <EscolherPerfil valor={f.role} onMudar={role => setF({ ...f, role })} />
          <Campo rotulo="Palavra-passe temporária" obrigatorio erro={erroPass}>
            {a => (
              <div className="flex gap-2">
                <Entrada {...a} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} autoComplete="new-password" className="font-mono" />
                <Botao variante="primario" onClick={() => setF({ ...f, password: gerarPalavraPasse() })}>Gerar</Botao>
              </div>
            )}
          </Campo>
          <Caixa rotulo="Pedir uma palavra-passe nova no primeiro acesso" checked={f.mudar} onChange={e => setF({ ...f, mudar: e.target.checked })} />
        </div>
      )}
    </Modal>
  );
}
