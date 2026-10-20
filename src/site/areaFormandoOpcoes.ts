// Textos e opções da área do formando que o editor do site muda. Ficam à parte para o bloco do site
// não carregar a área do formando inteira só para ter os valores por omissão.

export type Separador = "courses" | "agenda" | "certificates" | "documents" | "notifications" | "payments" | "profile";

/** Textos e cores do painel ao lado do formulário de entrada (editáveis no editor do site). */
export type PainelEntrada = { mostrar: boolean; kicker: string; titulo: string; itens: string[]; rodape: string; fundo: string; imagem: string; fundoFormulario: string };

export const PAINEL_ENTRADA: PainelEntrada = {
  mostrar: true, kicker: "Área reservada", titulo: "Toda a sua formação num só lugar.",
  itens: ["Continue os cursos ao seu ritmo", "Consulte sessões e materiais", "Descarregue os seus certificados"],
  rodape: "ENA — Escola de Negócios e Administração", fundo: "#1C3350", imagem: "", fundoFormulario: "#F9F9F9",
};

/** O que o editor do site muda no painel do formando. */
export type OpcoesPainel = { saudacao: string; titulo: string; fundoTopo: string; resumo: boolean; separadores: Separador[] };

export const OPCOES_PAINEL: OpcoesPainel = {
  saudacao: "Olá,", titulo: "Continue a aprender.", fundoTopo: "", resumo: true,
  separadores: ["courses", "agenda", "certificates", "documents", "notifications", "payments", "profile"],
};
