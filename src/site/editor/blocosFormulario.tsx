// Bloco «Formulário de pedido de proposta» (página Empresas): o pedido fica no CRM › Clientes e a ENA recebe um email.
import { useId, useState, type FormEvent } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { useServicos } from "./blocosServico";
import { campoCor } from "./campos";
import { campoAparencia } from "./camposGrupos";
import { corSegura, estiloBloco, estiloVazio, juntar, lados, type Estilo } from "./estilos";

type FormularioProps = {
  textoBotao: string; mensagemOk: string; corBotao: string; corTextoBotao: string; servicos: boolean; aparencia: Estilo;
  /** Serviço já escolhido (na página de um serviço). */
  servicoInicial?: string;
  puck?: { dragRef?: ((el: Element | null) => void) | null; isEditing?: boolean };
};

const CONTROLO = "h-11 w-full border border-[#9AA7B6] bg-white px-3 text-base font-normal text-[#1C3350] focus:outline focus:outline-2 focus:outline-[var(--c-destaque)]";

export function Formulario(p: FormularioProps) {
  const servicos = useServicos() ?? [];
  const id = useId();
  const [estado, setEstado] = useState<"" | "a-enviar" | "ok" | "erro">("");
  const [erro, setErro] = useState("");
  const c = estiloBloco(p.aparencia);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (p.puck?.isEditing) return;
    const dados = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setEstado("a-enviar");
    setErro("");
    try {
      const r = await fetch("/api/v1/public/pedidos-proposta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(dados) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || "Não foi possível enviar.");
      setEstado("ok");
    } catch (x) {
      setEstado("erro");
      setErro(x instanceof Error ? x.message : "Não foi possível enviar.");
    }
  }

  const campo = (nome: string, rotulo: string, tipo = "text", obrigatorio = false, auto = "") => (
    <label className="flex flex-col gap-1.5 text-sm font-bold" htmlFor={`${id}-${nome}`}>
      {rotulo}{obrigatorio && <span className="sr-only"> (obrigatório)</span>}
      <input id={`${id}-${nome}`} name={nome} type={tipo} required={obrigatorio} autoComplete={auto || undefined} className={CONTROLO} />
    </label>
  );

  return (
    <div ref={p.puck?.dragRef ?? undefined} className={juntar("text-[#1C3350]", c.className)} style={c.style}>
      {estado === "ok" ? (
        <p role="status" className="text-lg font-bold">{p.mensagemOk}</p>
      ) : (
        <form onSubmit={e => void enviar(e)} className="relative grid gap-3.5 sm:grid-cols-2">
          {campo("nome", "Nome", "text", true, "name")}
          {campo("empresa", "Empresa", "text", false, "organization")}
          {campo("email", "Email", "email", true, "email")}
          {campo("telefone", "Telefone", "tel", false, "tel")}
          {p.servicos && servicos.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm font-bold sm:col-span-2" htmlFor={`${id}-servico`}>
              Serviço
              <select id={`${id}-servico`} name="servico" className={CONTROLO} defaultValue={p.servicoInicial ?? ""}>
                <option value="">Escolha (opcional)</option>
                {servicos.map(s => <option key={s.slug} value={s.titulo}>{s.titulo}</option>)}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-bold sm:col-span-2" htmlFor={`${id}-mensagem`}>
            Mensagem
            <textarea id={`${id}-mensagem`} name="mensagem" rows={4} maxLength={3000} className={juntar(CONTROLO, "h-auto py-2.5")} />
          </label>
          {/* Campo escondido para apanhar robôs (as pessoas não o veem nem o preenchem). */}
          <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          {estado === "erro" && <p role="alert" className="text-sm font-bold text-[#A60000] sm:col-span-2">{erro}</p>}
          <button type="submit" disabled={estado === "a-enviar"} className="h-12 font-bold disabled:opacity-60 sm:col-span-2"
            style={{ background: corSegura(p.corBotao) ?? "var(--c-destaque)", color: corSegura(p.corTextoBotao) ?? "#ffffff" }}>
            {estado === "a-enviar" ? "A enviar…" : p.textoBotao}
          </button>
        </form>
      )}
    </div>
  );
}

export const FormularioProposta: ComponentConfig<FormularioProps> = {
  label: "Formulário de pedido de proposta",
  fields: {
    textoBotao: { type: "text", label: "Texto do botão" },
    mensagemOk: { type: "textarea", label: "Mensagem depois de enviar" },
    servicos: { type: "radio", label: "Escolha do serviço", options: [{ label: "Mostrar", value: true }, { label: "Esconder", value: false }] },
    corBotao: campoCor("Cor do botão"),
    corTextoBotao: campoCor("Cor do texto do botão"),
    aparencia: campoAparencia(),
  },
  defaultProps: {
    textoBotao: "Enviar pedido", mensagemOk: "Obrigado! Recebemos o seu pedido e vamos responder com uma proposta.", servicos: true,
    corBotao: "var(--c-destaque)", corTextoBotao: "#ffffff",
    aparencia: estiloVazio({ fundoCor: "#ffffff", preenchimento: lados(24, 24) }),
  },
  render: p => <Formulario {...p} />,
};
