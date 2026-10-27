/** Ícones do shell (traço único, 24×24). Os mesmos caminhos do menu do canvas. */
export const CAMINHOS_ICONE = {
  home: "M3 11 12 4l9 7v9H3z",
  crm: "M6 4h12v17H6zM9 4h6v3H9z",
  pessoas: "M5.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6",
  campanha: "M3 10v4h3l6 5V5L6 10zM16 9a4 4 0 0 1 0 6",
  livro: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5",
  turma: "m2 9 10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5",
  pessoa: "M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0",
  pasta: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  doc: "M6 3h9l4 4v14H6zM9 12h7M9 16h7",
  inscricao: "M6 4h12v17H6zM9 11l2 2 4-4",
  blog: "M4 4h16v16H4zM8 8h8M8 12h8M8 16h5",
  lista: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  email: "M3 5h18v14H3zM3 6l9 7 9-7",
  cartao: "M2 6h20v12H2zM2 10h20M6 15h4",
  site: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  config: "M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  calendario: "M4 5h16v16H4zM4 9h16M8 3v4M16 3v4",
  seta: "m9 6 6 6-6 6",
  sair: "M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0",
  chave: "M14.5 9.5a4 4 0 1 0-1.4 3.05L20 19.5M17 16.5l2-2M18.5 18l1.5-1.5",
  menu: "M4 6h16M4 12h16M4 18h16",
  fechar: "M6 6l12 12M18 6 6 18",
  sino: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
  lupa: "M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-3.5-3.5",
  aviso: "M12 3 2 20h20zM12 10v4M12 17h.01",
  info: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 11v5M12 8h.01",
  externo: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
} as const;

export type NomeIcone = keyof typeof CAMINHOS_ICONE;

export function Icone({ nome, tamanho = 16, className }: { nome: NomeIcone; tamanho?: number; className?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={CAMINHOS_ICONE[nome]} />
    </svg>
  );
}
