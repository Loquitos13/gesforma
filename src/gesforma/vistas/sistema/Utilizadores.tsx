// Sistema › Gestão › Utilizadores: contas, perfis, estado, último acesso e sessões (só administração).
import { useState } from "react";
import { useAuth } from "../../../partilhado/AuthGate";
import { apiUtilizadores, type PerfilUtilizador, type Utilizador } from "../../../partilhado/api/utilizadores";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  Aviso, Botao, Cartao, ErroCarregar, Estado, Filtros, PageHeader, Separadores, Tabela, Vazio, dataHora, num, useFiltrosUrl, type Coluna, type Tom,
} from "../../../partilhado/ui";
import { STAFF_ROLES, roleLabel } from "../../UsersView";
import type { VistaProps } from "../../shell/tipos";
import { FichaUtilizador, NovoUtilizador } from "./utilizadores/FichaUtilizador";

export const TOM_PERFIL: Record<string, Tom> = {
  admin: "acao", secretaria: "info", comercial: "aviso", financiada: "info", formador: "neutro", formando: "neutro",
};

function Iniciais({ nome }: { nome: string }) {
  const ini = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("");
  return <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full bg-linha-suave text-tinta-suave text-xs font-semibold inline-flex items-center justify-center">{ini || "?"}</span>;
}

export default function Utilizadores({ navigate }: VistaProps) {
  const { user } = useAuth();
  const admin = user.role === "admin";
  const [f, setF, limpar] = useFiltrosUrl({ perfil: "", estado: "", q: "", sel: "" });
  const { dados, erro, aCarregar, recarregar } = useRecurso(
    admin ? `utilizadores:${f.perfil}:${f.estado}:${f.q}` : null,
    signal => apiUtilizadores({ perfil: f.perfil, estado: f.estado, q: f.q }, signal),
  );
  const [novo, setNovo] = useState(false);

  if (!admin) {
    return (
      <div className="space-y-5">
        <PageHeader titulo="Utilizadores" />
        <Aviso tom="aviso" titulo="Só a administração gere contas">Peça a um administrador para criar ou alterar utilizadores.</Aviso>
      </div>
    );
  }

  const contagens = dados?.contagens ?? [];
  const equipa = contagens.filter(c => c.role !== "formando").reduce((s, c) => s + c.total, 0);
  const separadores = [
    { id: "", rotulo: "Equipa", contagem: dados ? equipa : undefined },
    ...STAFF_ROLES.map(r => ({ id: r.value as string, rotulo: r.label, contagem: dados ? contagens.find(c => c.role === r.value)?.total ?? 0 : undefined })),
  ];
  const linhas = dados?.users ?? [];

  const colunas: Coluna<Utilizador>[] = [
    {
      id: "nome", titulo: "Nome", principal: true,
      celula: u => (
        <span className="flex items-center gap-3 min-w-0">
          <Iniciais nome={u.name} />
          <span className="min-w-0">
            <span className="block font-semibold text-tinta truncate">{u.name}{u.id === user.id ? " (você)" : ""}</span>
            <span className="block text-xs text-tinta-suave truncate">{u.email}</span>
          </span>
        </span>
      ),
    },
    { id: "perfil", titulo: "Perfil", celula: u => <Estado tom={TOM_PERFIL[u.role] ?? "neutro"}>{roleLabel(u.role)}</Estado> },
    {
      id: "estado", titulo: "Estado",
      celula: u => (
        <span className="inline-flex gap-1.5 flex-wrap">
          <Estado tom={u.active ? "sucesso" : "neutro"} ponto>{u.active ? "Activo" : "Inactivo"}</Estado>
          {u.mustChangePassword && <Estado tom="aviso" title="Tem de mudar a palavra-passe no próximo acesso">Palavra-passe temporária</Estado>}
        </span>
      ),
    },
    { id: "acesso", titulo: "Último acesso", celula: u => (u.last_login_at ? dataHora(u.last_login_at) : "Nunca entrou") },
    { id: "sessoes", titulo: "Sessões", alinhar: "dir", esconderMovel: true, celula: u => num(u.sessions_open) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: "Sistema", onClick: () => navigate("configuracoes") }, { rotulo: "Utilizadores" }]}
        titulo="Utilizadores"
        subtitulo="Quem não estiver aqui não entra no GesForma, nem com Google ou Microsoft."
        acoes={<Botao variante="primario" onClick={() => setNovo(true)}>Novo utilizador</Botao>}
      />
      <Separadores rotulo="Perfil" estilo="pilula" itens={separadores} ativo={f.perfil} onMudar={perfil => setF({ perfil, sel: "" })} />
      <Filtros
        pesquisa={{ valor: f.q, onMudar: q => setF({ q }), placeholder: "Nome ou email" }}
        selecoes={[{
          chave: "estado", rotulo: "Estado", valor: f.estado, onMudar: estado => setF({ estado }), vazio: "Estado: todos",
          opcoes: [{ valor: "ativos", rotulo: "Activos" }, { valor: "inativos", rotulo: "Inactivos" }],
        }]}
        ativos={[f.q, f.estado].filter(Boolean).length}
        onLimpar={limpar}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      <Cartao semPadding>
        <Tabela
          rotulo="Utilizadores"
          linhas={linhas}
          colunas={colunas}
          chave={u => u.id}
          onLinha={u => setF({ sel: u.id })}
          linhaAtiva={f.sel || null}
          aCarregar={aCarregar && !dados}
          vazio={(
            <Vazio
              titulo={f.q || f.estado ? "Ninguém corresponde à pesquisa" : "Sem contas neste perfil"}
              acao={f.q || f.estado ? <Botao tamanho="sm" onClick={limpar}>Limpar filtros</Botao> : <Botao tamanho="sm" variante="primario" onClick={() => setNovo(true)}>Criar utilizador</Botao>}
            />
          )}
        />
      </Cartao>
      <FichaUtilizador id={f.sel || null} onFechar={() => setF({ sel: "" })} perfilInicial={f.perfil as PerfilUtilizador | ""} />
      <NovoUtilizador aberto={novo} onFechar={id => { setNovo(false); if (id) setF({ sel: id }); }} perfilInicial={f.perfil as PerfilUtilizador | ""} />
    </div>
  );
}
