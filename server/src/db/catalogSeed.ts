import type { Db } from "./pool.js";

export const CATALOG_KINDS = [
  "formandos_avulso",
  "datas",
  "locais",
  "areas",
  "modulos",
  "conteudos",
  "horarios",
  "inscricoes_fin",
  "blog_tematicas",
  "inqueritos",
  "lista_opcoes",
  "entidades",
] as const;

export type CatalogKind = (typeof CATALOG_KINDS)[number];

type SeedRow = { id: number; kind: CatalogKind; regime: "gold" | "fin"; payload: Record<string, unknown> };

function rows(kind: CatalogKind, regime: "gold" | "fin", items: Array<{ id: number } & Record<string, unknown>>): SeedRow[] {
  return items.map(({ id, ...payload }) => ({ id, kind, regime, payload }));
}

const SEED: SeedRow[] = [
  ...rows("formandos_avulso", "gold", [
    { id: 4301, nome: "Rui", apelido: "Moreira", email: "rui.moreira@gmail.com", telf: "912334887", curso: "Excel do Básico ao Avançado", local: "E-learning", inscrito: "2026-08-12", pago: true, valor: 45, metodo: "MB Way", estado: "Ativo" },
    { id: 4302, nome: "Carla", apelido: "Nogueira", email: "carla.nogueira@sapo.pt", telf: "934112009", curso: "A Arte de Comunicar: E-learning", local: "Sala Virtual", inscrito: "2026-08-28", pago: true, valor: 35, metodo: "Cartão", estado: "Ativo" },
    { id: 4303, nome: "Pedro", apelido: "Almeida", email: "palmeida@outlook.pt", telf: "918776221", curso: "Curso de Cura Prânica", local: "E-learning", inscrito: "2026-09-01", pago: false, valor: 200, metodo: "-", estado: "Pendente" },
    { id: 4304, nome: "Sofia", apelido: "Ramos", email: "sofia.ramos@ena.pt", telf: "926441078", curso: "Auxiliar de Medicina Dentária", local: "E-learning", inscrito: "2026-07-19", pago: true, valor: 300, metodo: "Transferência", estado: "Ativo" },
    { id: 4305, nome: "Nuno", apelido: "Teixeira", email: "nuno.teixeira88@gmail.com", telf: "961203445", curso: "Auxiliar de Medicina Veterinária", local: "E-learning", inscrito: "2026-09-02", pago: false, valor: 400, metodo: "-", estado: "Pendente" },
  ]),
  ...rows("datas", "gold", [
    { id: 41, inicio: "2026-09-07", fim: "2026-11-29", horario: "Sábado manhã", preco: 125, local: "V.N.Gaia", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/vng-sm-07-09" },
    { id: 42, inicio: "2026-09-04", fim: "2026-11-26", horario: "Pós Laboral", preco: 125, local: "V.N.Gaia", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/vng-pl-04-09" },
    { id: 43, inicio: "2026-09-15", fim: "2026-12-07", horario: "Pós Laboral", preco: 120, local: "Braga", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/brg-pl-15-09" },
    { id: 44, inicio: "2026-09-21", fim: "2026-12-13", horario: "Sábado manhã", preco: 120, local: "Braga", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/brg-sm-21-09" },
    { id: 45, inicio: "2026-07-06", fim: "2026-09-28", horario: "Laboral Manhã", preco: 145, local: "Lisboa", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/irn-lsb-01-09" },
    { id: 46, inicio: "2026-09-02", fim: "2026-11-24", horario: "Sábado manhã", preco: 125, local: "Penafiel", curso: "Formação de Formadores - CCP", status: "Ativo", link: "ena.pt/ccp/pen-sm-02-09" },
    { id: 31, inicio: "2025-06-13", fim: "2025-07-30", horario: "Pós Laboral", preco: 120, local: "Braga", curso: "Formação de Formadores - CCP", status: "Inactivo", link: "ena.pt/ccp/braga-2025" },
    { id: 27, inicio: "2025-08-22", fim: "2025-10-08", horario: "Pós Laboral", preco: 125, local: "Aveiro", curso: "Formação de Formadores - CCP", status: "Inactivo", link: "ena.pt/ccp/aveiro-2025" },
  ]),
  ...rows("datas", "fin", [
    { id: 301, inicio: "2026-08-27", fim: "2026-09-24", horario: "Pós Laboral", preco: 0, local: "Sala Virtual", curso: "Primeiros Socorros", status: "Ativo", link: "ena.pt/ufcd/3564-t1" },
    { id: 302, inicio: "2026-09-08", fim: "2026-10-06", horario: "Sábado manhã", preco: 0, local: "Sala Virtual", curso: "Publicidade nas Redes Sociais", status: "Ativo", link: "ena.pt/ufcd/10785-sm" },
    { id: 303, inicio: "2026-09-15", fim: "2026-10-13", horario: "Pós Laboral", preco: 0, local: "Sala Virtual", curso: "Fundamentos de cibersegurança", status: "Ativo", link: "ena.pt/ufcd/9188-pl" },
    { id: 304, inicio: "2026-10-01", fim: "2026-10-29", horario: "Laboral Manhã", preco: 0, local: "V.N.Gaia", curso: "Métodos e Técnicas Pedagógicas Ativos", status: "Ativo", link: "ena.pt/ufcd/10394-vng" },
    { id: 305, inicio: "2026-07-02", fim: "2026-07-30", horario: "Pós Laboral", preco: 0, local: "Sala Virtual", curso: "Primeiros Socorros", status: "Inactivo", link: "ena.pt/ufcd/3564-jul" },
  ]),
  ...rows("locais", "gold", [
    { id: 15, nome: "V.N.Gaia", morada: "Rua da Formação 12, 4400-000 V.N. Gaia", salas: 3, turmas: 6, status: "Ativo" },
    { id: 16, nome: "Aveiro", morada: "Av. Dr. Lourenço Peixinho 88, 3800 Aveiro", salas: 1, turmas: 0, status: "Ativo" },
    { id: 17, nome: "Penafiel", morada: "Rua Direita 4, 4560 Penafiel", salas: 1, turmas: 1, status: "Ativo" },
    { id: 18, nome: "Braga", morada: "Av. da Liberdade 210, 4710 Braga", salas: 2, turmas: 2, status: "Ativo" },
    { id: 19, nome: "Lisboa", morada: "Av. da República 50, 1050 Lisboa", salas: 2, turmas: 1, status: "Ativo" },
    { id: 25, nome: "Sala Virtual", morada: "Moodle + Zoom ENA", salas: 0, turmas: 4, status: "Ativo" },
  ]),
  ...rows("locais", "fin", [
    { id: 41, nome: "Sala Virtual", morada: "Moodle + Zoom ENA · turmas financiadas", salas: 0, turmas: 6, status: "Ativo" },
    { id: 42, nome: "V.N.Gaia", morada: "Rua da Formação 12, 4400-000 V.N. Gaia", salas: 2, turmas: 1, status: "Ativo" },
    { id: 43, nome: "Centro de emprego Gaia", morada: "Polo IEFP · encaminhamento de candidatos", salas: 1, turmas: 0, status: "Ativo" },
    { id: 44, nome: "Braga", morada: "Av. da Liberdade 210, 4710 Braga", salas: 1, turmas: 0, status: "Ativo" },
  ]),
  ...rows("areas", "gold", [
    { id: 21, nome: "CCP e Gestão da Formação", cursos: 4, estado: "Ativo" },
    { id: 22, nome: "Saúde e bem estar", cursos: 3, estado: "Ativo" },
    { id: 23, nome: "Desenvolvimento Pessoal", cursos: 3, estado: "Ativo" },
    { id: 17, nome: "Boas práticas para a vida", cursos: 1, estado: "Ativo" },
    { id: 18, nome: "Boas práticas profissionais", cursos: 2, estado: "Ativo" },
    { id: 19, nome: "Boas práticas pedagógicas", cursos: 2, estado: "Ativo" },
  ]),
  ...rows("areas", "fin", [
    { id: 61, nome: "Saúde e segurança", cursos: 2, estado: "Ativo" },
    { id: 62, nome: "Marketing digital", cursos: 1, estado: "Ativo" },
    { id: 63, nome: "Cibersegurança", cursos: 1, estado: "Ativo" },
    { id: 64, nome: "Pedagogia e formação", cursos: 1, estado: "Ativo" },
  ]),
  ...rows("modulos", "gold", [
    { id: 1, codigo: "M1", nome: "Aprendizagem e pedagogia", horas: 20, curso: "Formação de Formadores - CCP", tipo: "Teórico-prático", estado: "Ativo" },
    { id: 2, codigo: "M2", nome: "Comunicação e dinâmica de grupos", horas: 20, curso: "Formação de Formadores - CCP", tipo: "Teórico-prático", estado: "Ativo" },
    { id: 3, codigo: "M3", nome: "Avaliação da formação", horas: 15, curso: "Formação de Formadores - CCP", tipo: "Teórico", estado: "Ativo" },
    { id: 4, codigo: "M4", nome: "Simulação pedagógica", horas: 25, curso: "Formação de Formadores - CCP", tipo: "Prático", estado: "Ativo" },
    { id: 5, codigo: "M5", nome: "Plataformas digitais e e-learning", horas: 10, curso: "Formação de Formadores - CCP", tipo: "B-learning", estado: "Ativo" },
    { id: 6, codigo: "EX1", nome: "Tabelas dinâmicas e dashboards", horas: 4, curso: "Excel do Básico ao Avançado", tipo: "Prático", estado: "Ativo" },
    { id: 7, codigo: "AV1", nome: "Voz e respiração", horas: 6, curso: "A Arte de Comunicar e Falar em Público: B-learning", tipo: "Prático", estado: "Ativo" },
    { id: 8, codigo: "AV2", nome: "Estrutura do discurso", horas: 5, curso: "A Arte de Comunicar e Falar em Público: B-learning", tipo: "Teórico-prático", estado: "Ativo" },
    { id: 9, codigo: "AV3", nome: "Ensaio e feedback", horas: 5, curso: "A Arte de Comunicar e Falar em Público: B-learning", tipo: "Prático", estado: "Ativo" },
  ]),
  ...rows("modulos", "fin", [
    { id: 101, codigo: "U1", nome: "Avaliação primária da vítima", horas: 8, curso: "Primeiros Socorros", tipo: "Teórico-prático", estado: "Ativo" },
    { id: 102, codigo: "U2", nome: "Suporte básico de vida", horas: 10, curso: "Primeiros Socorros", tipo: "Prático", estado: "Ativo" },
    { id: 103, codigo: "U3", nome: "Emergências mais frequentes", horas: 7, curso: "Primeiros Socorros", tipo: "Teórico-prático", estado: "Ativo" },
    { id: 104, codigo: "R1", nome: "Plataformas e formatos", horas: 8, curso: "Publicidade nas Redes Sociais", tipo: "Teórico", estado: "Ativo" },
    { id: 105, codigo: "R2", nome: "Campanhas pagas", horas: 10, curso: "Publicidade nas Redes Sociais", tipo: "Prático", estado: "Ativo" },
    { id: 106, codigo: "R3", nome: "Métricas e relatórios", horas: 7, curso: "Publicidade nas Redes Sociais", tipo: "Teórico-prático", estado: "Ativo" },
    { id: 107, codigo: "C1", nome: "Ameaça e risco", horas: 8, curso: "Fundamentos de cibersegurança", tipo: "Teórico", estado: "Ativo" },
    { id: 108, codigo: "C2", nome: "Boas práticas do utilizador", horas: 9, curso: "Fundamentos de cibersegurança", tipo: "Prático", estado: "Ativo" },
    { id: 109, codigo: "C3", nome: "Resposta a incidentes", horas: 8, curso: "Fundamentos de cibersegurança", tipo: "Teórico-prático", estado: "Ativo" },
    { id: 110, codigo: "P1", nome: "Métodos ativos", horas: 12, curso: "Métodos e Técnicas Pedagógicas Ativos", tipo: "Teórico-prático", estado: "Ativo" },
    { id: 111, codigo: "P2", nome: "Dinâmicas de grupo", horas: 13, curso: "Métodos e Técnicas Pedagógicas Ativos", tipo: "Prático", estado: "Ativo" },
  ]),
  ...rows("conteudos", "gold", [
    { id: 11, titulo: "Manual CCP - Módulo 1 (Aprendizagem)", tipo: "PDF", curso: "Formação de Formadores - CCP", modulo: "M1", tamanho: "2,4 MB", estado: "Ativo" },
    { id: 12, titulo: "Vídeo: comunicação em sala", tipo: "Vídeo", curso: "Formação de Formadores - CCP", modulo: "M2", tamanho: "18 min", estado: "Ativo" },
    { id: 13, titulo: "Grelha de observação da simulação", tipo: "PDF", curso: "Formação de Formadores - CCP", modulo: "M4", tamanho: "180 KB", estado: "Ativo" },
    { id: 14, titulo: "Plataforma Moodle CCP", tipo: "Link", curso: "Formação de Formadores - CCP", modulo: "M5", tamanho: "-", estado: "Ativo" },
    { id: 15, titulo: "Ficha de avaliação final", tipo: "PDF", curso: "Formação de Formadores - CCP", modulo: "M3", tamanho: "92 KB", estado: "Ativo" },
    { id: 16, titulo: "Exercícios Excel avançado", tipo: "PDF", curso: "Excel do Básico ao Avançado", modulo: "EX1", tamanho: "1,1 MB", estado: "Inactivo" },
  ]),
  ...rows("conteudos", "fin", [
    { id: 201, titulo: "Manual UFCD 3564 - Primeiros Socorros", tipo: "PDF", curso: "Primeiros Socorros", modulo: "U1", tamanho: "1,8 MB", estado: "Ativo" },
    { id: 202, titulo: "Vídeo: SBV no adulto", tipo: "Vídeo", curso: "Primeiros Socorros", modulo: "U2", tamanho: "14 min", estado: "Ativo" },
    { id: 203, titulo: "Grelha de observação prática", tipo: "PDF", curso: "Primeiros Socorros", modulo: "U2", tamanho: "210 KB", estado: "Ativo" },
    { id: 204, titulo: "Moodle UFCD 10785", tipo: "Link", curso: "Publicidade nas Redes Sociais", modulo: "R1", tamanho: "-", estado: "Ativo" },
    { id: 205, titulo: "Guia de campanhas Meta", tipo: "PDF", curso: "Publicidade nas Redes Sociais", modulo: "R2", tamanho: "890 KB", estado: "Ativo" },
    { id: 206, titulo: "Checklist de higiene digital", tipo: "PDF", curso: "Fundamentos de cibersegurança", modulo: "C2", tamanho: "140 KB", estado: "Ativo" },
  ]),
  ...rows("horarios", "gold", [
    { id: 71, nome: "Laboral manhã", descricao: "Dias úteis de manhã", status: "Ativo" },
    { id: 72, nome: "Laboral tarde", descricao: "Dias úteis de tarde", status: "Ativo" },
    { id: 73, nome: "Pós-Laboral", descricao: "Dias úteis ao fim do dia", status: "Ativo" },
    { id: 74, nome: "Sábado manhã", descricao: "Sábados de manhã", status: "Ativo" },
  ]),
  ...rows("inscricoes_fin", "fin", [
    { id: 501, inscrito: "2026-09-01", nome: "Mariana", apelido: "Sousa Pereira", email: "mariana98pereira@gmail.com", telf: "932874093", ufcd: "3564", curso: "Primeiros Socorros", turma: "UFCD 3564 · T1", estado: "Em análise", docs: { cc: false, ch: false, cu: false, ci: false, ce: false } },
    { id: 502, inscrito: "2026-08-28", nome: "Diogo Alexandre", apelido: "Soares Oliveira", email: "diogo_nik@hotmail.com", telf: "914388980", ufcd: "10785", curso: "Publicidade nas Redes Sociais", turma: "SM-T01", estado: "Elegível", docs: { cc: true, ch: false, cu: false, ci: true, ce: false } },
    { id: 503, inscrito: "2026-08-27", nome: "Vanesa Magali", apelido: "Correa Bender", email: "valescabender@gmail.com", telf: "963130925", ufcd: "10785", curso: "Publicidade nas Redes Sociais", turma: "SM-T01", estado: "Colocado na turma", docs: { cc: true, ch: true, cu: true, ci: true, ce: true } },
    { id: 504, inscrito: "2026-08-26", nome: "Laércio Daniel", apelido: "Ferreira da Costa", email: "71aercio7@gmail.com", telf: "933168749", ufcd: "10785", curso: "Publicidade nas Redes Sociais", turma: "SM-T01", estado: "Elegível", docs: { cc: true, ch: false, cu: false, ci: false, ce: false } },
    { id: 505, inscrito: "2026-08-20", nome: "Tânia", apelido: "Veloso", email: "taniapatriciaveloso@gmail.com", telf: "914011998", ufcd: "10785", curso: "Publicidade nas Redes Sociais", turma: "SM-T01", estado: "Recebida", docs: { cc: true, ch: false, cu: false, ci: false, ce: false } },
    { id: 506, inscrito: "2026-08-18", nome: "Helena", apelido: "Costa", email: "helena.costa@gmail.com", telf: "917220331", ufcd: "3564", curso: "Primeiros Socorros", turma: "-", estado: "Indeferido", docs: { cc: true, ch: false, cu: false, ci: false, ce: false } },
    { id: 507, inscrito: "2026-09-03", nome: "Bruno", apelido: "Machado", email: "bruno.machado@ua.pt", telf: "925667109", ufcd: "10394", curso: "Métodos e Técnicas Pedagógicas", turma: "-", estado: "Em análise", docs: { cc: true, ch: true, cu: false, ci: true, ce: false } },
  ]),
  ...rows("blog_tematicas", "gold", [
    { id: 1, nome: "Formação de Formadores", slug: "ccp", posts: 4, estado: "Ativo" },
    { id: 2, nome: "Formação Financiada", slug: "financiada", posts: 3, estado: "Ativo" },
    { id: 3, nome: "Dicas de e-learning", slug: "e-learning", posts: 2, estado: "Ativo" },
    { id: 4, nome: "Carreiras na saúde", slug: "saude", posts: 1, estado: "Ativo" },
    { id: 5, nome: "Notícias ENA", slug: "noticias", posts: 0, estado: "Inactivo" },
  ]),
  ...rows("inqueritos", "gold", [
    { id: 1, titulo: "Inquérito de Satisfação - Formação de Formadores CCP", perguntas: [
      { id: 1, tipo: "escala", texto: "Como avalia a qualidade geral da formação?" },
      { id: 2, tipo: "escala", texto: "O formador demonstrou domínio dos conteúdos?" },
      { id: 3, tipo: "multipla", texto: "Qual o principal benefício desta formação?", opcoes: ["Competências pedagógicas", "Certificação CCP", "Rede de contactos", "Outros"] },
      { id: 4, tipo: "simnao", texto: "Recomendaria esta formação a um colega?" },
      { id: 5, tipo: "texto", texto: "Deixe um comentário ou sugestão:" },
    ] },
  ]),
  ...rows("inqueritos", "fin", [
    { id: 1, titulo: "Inquérito de Satisfação - UFCD 3564 Primeiros Socorros", perguntas: [
      { id: 1, tipo: "escala", texto: "Os conteúdos da UFCD foram claros e úteis?" },
      { id: 2, tipo: "escala", texto: "A carga horária (25h) foi adequada?" },
      { id: 3, tipo: "simnao", texto: "Consegue aplicar o que aprendeu no contexto profissional?" },
      { id: 4, tipo: "texto", texto: "Sugestões para a próxima turma:" },
    ] },
  ]),
  ...rows("lista_opcoes", "gold", listaOpcoesSeed()),
];

function listaOpcoesSeed(): Array<{ id: number; lista: string; nome: string }> {
  const listas: Array<{ lista: string; nomes: string[] }> = [
    {
      lista: "origens",
      nomes: [
        "Website", "Facebook", "Instagram", "Google", "LinkedIn", "IEFP",
        "Referência", "Telefone", "WhatsApp", "Email", "Balcão", "Indicação", "Outro",
      ],
    },
    { lista: "meios_contacto", nomes: ["Telefone", "WhatsApp", "Email", "SMS", "Presencial"] },
    { lista: "metodos_pagamento", nomes: ["MB Way", "Multibanco", "Transferência", "Numerário", "Cartão", "PayPal"] },
    { lista: "motivos_desistencia", nomes: ["Preço", "Horário", "Local", "Sem vagas", "Concorrência", "Silêncio", "Não elegível", "Outro"] },
    { lista: "resultados_contacto", nomes: ["Atendeu", "Não atendeu", "Mailbox", "Interessado", "A pensar", "Recusou"] },
    { lista: "tipos_modulo", nomes: ["Teórico-prático", "Teórico", "Prático", "B-learning"] },
    { lista: "tipos_conteudo", nomes: ["PDF", "Vídeo", "Link"] },
    {
      lista: "tipos_parceria",
      nomes: [
        "Protocolo de Estágio", "Empresa Cliente", "Entidade Formadora",
        "Agente Comercial", "Instituição de Ensino", "Associação Setorial",
      ],
    },
    { lista: "tipos_curso", nomes: ["E-learning", "Pré-inscrição"] },
    { lista: "regimes_curso", nomes: ["b-learning", "e-learning", "presencial"] },
    { lista: "categorias_gold", nomes: ["CCP e Gestão da Formação", "Saúde e bem estar", "Desenvolvimento Pessoal"] },
    { lista: "areas_fin", nomes: ["Saúde e segurança", "Marketing digital", "TIC e cibersegurança", "Formação de formadores"] },
  ];
  let id = 9101;
  const out: Array<{ id: number; lista: string; nome: string }> = [];
  for (const bloco of listas) {
    for (const nome of bloco.nomes) {
      out.push({ id: id++, lista: bloco.lista, nome });
    }
  }
  return out;
}

export async function seedCatalogs(db: Db) {
  for (const r of SEED) {
    await db.query(
      `INSERT INTO catalog_items (id, kind, regime, payload)
       VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (kind, id) DO NOTHING`,
      [r.id, r.kind, r.regime, r.payload],
    );
  }
}

export function isCatalogKind(value: string): value is CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(value);
}
