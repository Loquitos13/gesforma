import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { ctaDestino } from "../emailCta.js";
import { linesToXml } from "../emailXml.js";
import { hashPassword, normalizeEmail } from "../security.js";
import type { Db } from "./pool.js";

const TEMPLATES = [
  {
    tipo: "welcome",
    nome: "Boas-vindas",
    assunto: "Bem-vindo(a) à ENA, {{nome}}",
    linhas: [
      "Confirmámos o seu interesse em {{curso}}.",
      "A turma {{turma}} é a unidade de gestão: datas, sessões e documentos ficam todos aí.",
      "Se ainda não escolheu horário, responda a este email ou complete a inscrição no site.",
    ],
    cta: "Ver a minha inscrição",
  },
  {
    tipo: "payment",
    nome: "Confirmação de Pagamento",
    assunto: "Pagamento confirmado - {{curso}}",
    linhas: [
      "{{nome}}, o pagamento de {{curso}} chegou.",
      "Já está inscrita na turma {{turma}}. O cronograma e o acesso à plataforma seguem nas próximas horas.",
    ],
    cta: "Abrir a turma",
  },
  {
    tipo: "sale_followup",
    nome: "Contacto após a venda",
    assunto: "Obrigado, {{nome}} - próximos passos em {{curso}}",
    linhas: [
      "O pagamento ficou registado. Daqui a pouco a secretaria confirma-lhe a turma {{turma}} e o horário.",
      "Se precisar de fatura, recibo ou de alterar o nome no certificado, responda a este email.",
      "Guarde este comprovativo. A ENA trata a formação pela turma, não por «ação».",
    ],
    cta: "Falar com a secretaria",
  },
  {
    tipo: "reminder_24h",
    nome: "Lembrete 24h",
    assunto: "Amanhã começa {{curso}}",
    linhas: [
      "{{nome}}, a primeira sessão de {{curso}} é amanhã, turma {{turma}}.",
      "Traga o CC e, se for CCP, o portefólio em construção. O link da sala está no botão abaixo.",
    ],
    cta: "Abrir o cronograma",
  },
  {
    tipo: "certificate",
    nome: "Certificado de Conclusão",
    assunto: "O seu certificado está disponível",
    linhas: [
      "Parabéns, {{nome}}. Concluiu {{curso}} na turma {{turma}}.",
      "O certificado está no cockpit da turma, em Certificados. Guarde o PDF: a ENA arquiva o DTP durante 10 anos.",
    ],
    cta: "Descarregar certificado",
  },
  {
    tipo: "reengagement",
    nome: "Reengajamento",
    assunto: "Ainda está a tempo de começar {{curso}}",
    linhas: [
      "{{nome}}, a pré-inscrição em {{curso}} ficou a meio.",
      "Há vagas na turma {{turma}}. Se quiser retomar, o pagamento reabre a inscrição sem perder os dados.",
    ],
    cta: "Retomar inscrição",
  },
].map(t => {
  const dest = ctaDestino(t.tipo);
  return { ...t, href: dest.href, ambito: dest.ambito };
});

const RULES = [
  { nome: "Boas-vindas ao registo", gatilho: "Nova pré-inscrição recebida", key: "preinscricao.created", tipo: "welcome", delay: 0 },
  { nome: "Confirmação de pagamento", gatilho: "Pagamento confirmado", key: "payment.confirmed", tipo: "payment", delay: 0 },
  { nome: "Contacto após a venda", gatilho: "Contacto após a venda", key: "sale.followup", tipo: "sale_followup", delay: 3600 },
  { nome: "Lembrete 24h antes do curso", gatilho: "24 horas antes do início", key: "turma.starts_in_24h", tipo: "reminder_24h", delay: 0 },
  { nome: "Certificado de conclusão", gatilho: "Formando marcado como concluído", key: "formando.completed", tipo: "certificate", delay: 0 },
  { nome: "Reengajamento 30 dias", gatilho: "30 dias sem compra", key: "lead.stale_30d", tipo: "reengagement", delay: 0, ativo: false },
];

const FORMADORES = [
  { id: 7, nome: "Isac Silva", telf: "914 547 554", email: "isacsilva1992@gmail.com", especialidade: "CCP e pedagogia", ccp: "F-44821", nif: "221 448 210", regimes: ["gold", "fin"], estado: "Ativo" },
  { id: 8, nome: "Ivan Esteves", telf: "912 370 557", email: "exsorio2@gmail.com", especialidade: "Comunicação", ccp: "F-51209", nif: "198 220 114", regimes: ["gold"], estado: "Ativo" },
  { id: 11, nome: "António Cardeal", telf: "915 258 691", email: "antoniocardeal71@gmail.com", especialidade: "Comunicar em contexto profissional", ccp: "F-39012", nif: "176 901 332", regimes: ["fin"], estado: "Ativo" },
  { id: 12, nome: "Cátia Pinheiro", telf: "912 919 291", email: "catiapinheiro@ena.pt", especialidade: "Estética facial", ccp: "F-60118", nif: "245 118 009", regimes: ["fin"], estado: "Ativo" },
  { id: 19, nome: "Vânia Fernandes", telf: "967 432 879", email: "fernandes.c.vania@gmail.com", especialidade: "Primeiros socorros", ccp: "F-44790", nif: "203 774 881", regimes: ["gold", "fin"], estado: "Ativo" },
  { id: 20, nome: "Rosana Suarez", telf: "938 039 001", email: "roxana.suarez.costa@gmail.com", especialidade: "Massagem", ccp: "F-55802", nif: "189 330 447", regimes: ["fin"], estado: "Ativo" },
];

const CURSOS = [
  { id: 100, regime: "gold", nome: "Formação de Formadores - CCP", categoria: "CCP e Gestão da Formação", tipo: "Gold", preco: 125, horas: 90, estado: "Ativo", ufcd_cod: "", ufcd: "", nome_comercial: "" },
  { id: 108, regime: "gold", nome: "A Arte de Comunicar e Falar em Público: B-learning", categoria: "Desenvolvimento Pessoal", tipo: "Gold", preco: 80, horas: 16, estado: "Inactivo", ufcd_cod: "", ufcd: "", nome_comercial: "" },
  { id: 107, regime: "gold", nome: "A Arte de Comunicar e Falar em Público: E-learning", categoria: "Desenvolvimento Pessoal", tipo: "Pré-inscrição", preco: 35, horas: 8, estado: "Inactivo", ufcd_cod: "", ufcd: "", nome_comercial: "" },
  { id: 131, regime: "gold", nome: "CCP - Formação de Formadores para Empresas", categoria: "CCP e Gestão da Formação", tipo: "Pré-inscrição", preco: 120, horas: 90, estado: "Inactivo", ufcd_cod: "", ufcd: "", nome_comercial: "" },
  { id: 130, regime: "gold", nome: "Curso de Auxiliar de Medicina Dentária", categoria: "Saúde e bem estar", tipo: "Pré-inscrição", preco: 300, horas: 99, estado: "Ativo", ufcd_cod: "", ufcd: "", nome_comercial: "" },
  { id: 134, regime: "gold", nome: "Curso de Auxiliar de Medicina Veterinária", categoria: "Saúde e bem estar", tipo: "Pré-inscrição", preco: 400, horas: 120, estado: "Ativo", ufcd_cod: "", ufcd: "", nome_comercial: "" },
  { id: 136, regime: "gold", nome: "Curso de Cura Prânica", categoria: "Desenvolvimento Pessoal", tipo: "Pré-inscrição", preco: 200, horas: 20, estado: "Ativo", ufcd_cod: "", ufcd: "", nome_comercial: "" },
  { id: 138, regime: "gold", nome: "Excel do Básico ao Avançado", categoria: "CCP e Gestão da Formação", tipo: "Gold", preco: 45, horas: 12, estado: "Ativo", ufcd_cod: "", ufcd: "", nome_comercial: "" },
  { id: 6, regime: "fin", nome: "Publicidade nas Redes Sociais: Master em Tráfego", categoria: "Marketing digital", tipo: "UFCD", preco: 0, horas: 25, estado: "Inactivo", ufcd_cod: "10785", ufcd: "Publicidade nas Redes Socias", nome_comercial: "Publicidade nas Redes Sociais: Master em Tráfego" },
  { id: 43, regime: "fin", nome: "Primeiros Socorros", categoria: "Saúde e segurança", tipo: "UFCD", preco: 0, horas: 25, estado: "Ativo", ufcd_cod: "3564", ufcd: "Primeiros Socorros", nome_comercial: "Primeiros Socorros" },
  { id: 65, regime: "fin", nome: "Fundamentos de cibersegurança", categoria: "Cibersegurança", tipo: "UFCD", preco: 0, horas: 25, estado: "Inactivo", ufcd_cod: "9188", ufcd: "Fundamentos de cibersegurança", nome_comercial: "Fundamentos de cibersegurança" },
  { id: 68, regime: "fin", nome: "Métodos e Técnicas Pedagógicas Ativos", categoria: "Pedagogia e formação", tipo: "UFCD", preco: 0, horas: 25, estado: "Ativo", ufcd_cod: "10394", ufcd: "Métodos e técnicas pedagógicas", nome_comercial: "Métodos e Técnicas Pedagógicas Ativos" },
];

function makeCronograma(inicio: string, horario: string, horas: number, formador: string) {
  const isNight = horario.toLowerCase().includes("pós");
  const isSat = horario.toLowerCase().includes("sábado");
  const horaInicio = isSat ? "09:00" : isNight ? "19:00" : "09:00";
  const horaFim = isSat ? "13:00" : isNight ? "23:00" : "13:00";
  const perSession = 4;
  const count = Math.max(3, Math.ceil(horas / perSession));
  const out = [];
  const cur = new Date(`${inicio}T12:00:00Z`);
  if (Number.isNaN(cur.getTime())) cur.setTime(Date.now());
  for (let i = 0; i < count; i++) {
    const dStr = cur.toISOString().slice(0, 10);
    out.push({
      id: `s-${i + 1}`,
      data: dStr,
      horaInicio,
      horaFim,
      modulos: [`Módulo ${((i % 5) + 1)}`],
      formadores: formador ? [formador] : ["Isac Silva"],
    });
    cur.setDate(cur.getDate() + (isSat ? 7 : 3));
  }
  return out;
}

const TURMAS_GOLD = [
  { id: 947, dataInicio: "2026-09-03", nome: "2176/2026", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 16, vagas: 16, estado: "Ativa", formador: "Isac Silva" },
  { id: 946, dataInicio: "2026-07-06", nome: "IRN LSB 01/09", curso: "Formação de Formadores - CCP", local: "Lisboa", horario: "Laboral Manhã", totalAlunos: 12, vagas: 16, estado: "Ativa", formador: "Isac Silva" },
  { id: 945, dataInicio: "2026-09-15", nome: "BRG-PL-15/09", curso: "Formação de Formadores - CCP", local: "Braga", horario: "Pós Laboral", totalAlunos: 2, vagas: 16, estado: "Ativa", formador: "Isac Silva" },
  { id: 944, dataInicio: "2026-09-21", nome: "BRG-SM-21/09", curso: "Formação de Formadores - CCP", local: "Braga", horario: "Sábado manhã", totalAlunos: 6, vagas: 16, estado: "Ativa", formador: "Isac Silva" },
  { id: 943, dataInicio: "2026-09-07", nome: "VNG-SM-07/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Sábado manhã", totalAlunos: 10, vagas: 16, estado: "Ativa", formador: "Isac Silva" },
  { id: 940, dataInicio: "2026-09-03", nome: "2175/2026", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 14, vagas: 16, estado: "Ativa", formador: "Isac Silva" },
  { id: 939, dataInicio: "2026-09-04", nome: "VNG-PL-04/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Pós Laboral", totalAlunos: 9, vagas: 16, estado: "Ativa", formador: "Isac Silva" },
  { id: 938, dataInicio: "2026-09-02", nome: "PEN-SM-02/09", curso: "Formação de Formadores - CCP", local: "Penafiel", horario: "Sábado manhã", totalAlunos: 13, vagas: 16, estado: "Ativa", formador: "Isac Silva" },
  { id: 937, dataInicio: "2026-08-28", nome: "VNG-SM-28/08", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Sábado manhã", totalAlunos: 12, vagas: 16, estado: "Inativa", formador: "Isac Silva" },
  { id: 936, dataInicio: "2026-09-03", nome: "VNG-LM-03/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 12, vagas: 16, estado: "Inativa", formador: "Isac Silva" },
];

const TURMAS_FIN = [
  { id: 222, dataInicio: "2026-09-18", nome: "UFCD 9109 - Cuidados Básicos", curso: "Masterclass em Estética Facial", ufcdCod: "9109", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 1, alunosTotal: 20, estado: "A montar", horas: 25, formador: "Cátia Pinheiro", activa: false },
  { id: 220, dataInicio: "2026-07-31", nome: "UC02282 - Criar campanhas", curso: "Publicidade nas Redes Sociais", ufcdCod: "10785", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 17, alunosTotal: 20, estado: "A montar", horas: 25, formador: "Isac Silva", activa: true },
  { id: 219, dataInicio: "2026-08-31", nome: "UCUC00033 - Comunicar", curso: "Comunicar e interagir em contexto profissional", ufcdCod: "3564", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 17, alunosTotal: 20, estado: "A decorrer", horas: 25, formador: "António Cardeal", activa: true },
  { id: 218, dataInicio: "2026-08-27", nome: "UFCD 3564 - Primeiros So.", curso: "Primeiros Socorros", ufcdCod: "3564", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 4, alunosTotal: 20, estado: "A montar", horas: 25, formador: "Vânia Fernandes", activa: true },
  { id: 217, dataInicio: "2026-08-27", nome: "UFCD 9119 - Massagem", curso: "Técnicas de massagem", ufcdCod: "9119", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 17, alunosTotal: 20, estado: "A decorrer", horas: 25, formador: "Rosana Suarez", activa: true },
];

const PREINSCRICOES = [
  { id: 17550, inscrito: "2026-09-04 11:24", nome: "Inês", apelido: "Caetano", email: "caetanoines9@gmail.com", telf: "932810856", inicioCurso: "2026-09-07", concelho: "Trofa", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", preco: 125, estado: "Não contactado", campanha: "Setembro 2026", origem: "Website" },
  { id: 17539, inscrito: "2026-09-04 11:07", nome: "Aline Cristina", apelido: "Pereira", email: "alinecristina@ua.pt", telf: "934283406", inicioCurso: "2026-09-03", concelho: "Guimarães", local: "Braga", curso: "Formação de Formadores - CCP", preco: 120, estado: "1º Contacto", campanha: "Setembro 2026", origem: "Facebook" },
  { id: 17536, inscrito: "2026-09-04 09:52", nome: "Priscila", apelido: "Damasceno", email: "prisciladamasceno82@gmail.com", telf: "931810126", inicioCurso: "-", concelho: "Leiria", local: "Sala Virtual", curso: "Auxiliar de Medicina Dentária", preco: 300, estado: "1º Contacto", campanha: "Setembro 2026", origem: "Google" },
  { id: 17534, inscrito: "2026-09-03 22:20", nome: "Glynnis", apelido: "Ferreira", email: "glynnisferreira@gmail.com", telf: "939080789", inicioCurso: "-", concelho: "V.N.Gaia", local: "E-learning", curso: "E-Formador novas tecnologias", preco: 80, estado: "1º Contacto", campanha: "CCP 2020", origem: "Website" },
  { id: 17533, inscrito: "2026-09-03 21:24", nome: "Carolina", apelido: "Esteves", email: "carolinaesteves@gmail.com", telf: "960303492", inicioCurso: "2026-09-07", concelho: "Braga", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", preco: 125, estado: "1º Contacto", campanha: "Setembro 2026", origem: "Instagram" },
  { id: 17532, inscrito: "2026-09-03 17:28", nome: "Susana", apelido: "Santos", email: "info@drasusanasantos.co", telf: "919890846", inicioCurso: "2026-09-07", concelho: "Lisboa", local: "Lisboa - Pós Laboral", curso: "Formação de Formadores - CCP", preco: 145, estado: "Não contactado", campanha: "Setembro 2026", origem: "Referência" },
  { id: 17531, inscrito: "2026-09-03 16:32", nome: "Cheila", apelido: "Parisot", email: "cheilaparisot@gmail.com", telf: "917754385", inicioCurso: "2026-07-06", concelho: "Sintra", local: "Lisboa - Laboral Manhã", curso: "Formação de Formadores - CCP", preco: 145, estado: "2º Contacto", campanha: "Setembro 2026", origem: "Facebook" },
  { id: 17530, inscrito: "2026-09-03 16:21", nome: "Tiago", apelido: "Bento", email: "tiagojsbento@gmail.com", telf: "919700594", inicioCurso: "2026-09-07", concelho: "V.N.Gaia", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", preco: 125, estado: "Pago", campanha: "Setembro 2026", origem: "Website" },
  { id: 17529, inscrito: "2026-09-03 16:03", nome: "Taís", apelido: "Araújo", email: "taisaraujoady@gmail.com", telf: "926305132", inicioCurso: "2026-09-03", concelho: "Braga", local: "Braga", curso: "Formação de Formadores - CCP", preco: 120, estado: "Formando", campanha: "CCP 2020", origem: "Google" },
  { id: 17528, inscrito: "2026-09-03 13:08", nome: "Luísa", apelido: "Monteiro", email: "luisa.fmonteiro19@gmail.com", telf: "910323422", inicioCurso: "2026-09-03", concelho: "Maia", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", preco: 125, estado: "Formando", campanha: "Setembro 2026", origem: "Website" },
];

const FORMANDOS_TURMAS = [
  { id: 17550, nome: "Tiago", apelido: "Bento", telf: "919700594", email: "tiagojsbento@gmail.com", inscrito: "2026-09-03 16:21", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-SM-07/09", turmaId: 943, estado: "Formando", pago: true, valor: 125, metodo: "MB Way" },
  { id: 17539, nome: "Luciana", apelido: "D'Avila", telf: "910641014", email: "davila.lucianam@gmail.com", inscrito: "2026-09-02 16:29", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-SM-07/09", turmaId: 943, estado: "Formando", pago: true, valor: 125, metodo: "Cartão" },
  { id: 17536, nome: "Ciara", apelido: "Gonçalves", telf: "912247513", email: "g.clarasofia03@gmail.com", inscrito: "2026-09-02 11:45", local: "Penafiel", curso: "Formação de Formadores - CCP", turma: "PEN-SM-02/09", turmaId: 938, estado: "Formando", pago: false, valor: 125, metodo: "-" },
  { id: 17534, nome: "Liliana", apelido: "Real", telf: "9111", email: "liascr777@gmail.com", inscrito: "2026-09-02 09:32", local: "Penafiel", curso: "Formação de Formadores - CCP", turma: "PEN-SM-02/09", turmaId: 938, estado: "Formando", pago: true, valor: 125, metodo: "Multibanco" },
  { id: 17526, nome: "Angélica", apelido: "Ribeiro", telf: "935043095", email: "alribeiro53@gmail.com", inscrito: "2026-09-01 15:06", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-SM-07/09", turmaId: 943, estado: "Formando", pago: true, valor: 125, metodo: "MB Way" },
  { id: 17522, nome: "Maria", apelido: "Mota", telf: "925997151", email: "mccmota.28@gmail.com", inscrito: "2026-09-01 09:36", local: "Braga", curso: "Formação de Formadores - CCP", turma: "BRG-PL-15/09", turmaId: 945, estado: "Formando", pago: false, valor: 120, metodo: "-" },
  { id: 17517, nome: "Elisabete", apelido: "Soares", telf: "914298952", email: "elisabete.soares@netcabo.pt", inscrito: "2026-08-31 21:45", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-SM-07/09", turmaId: 943, estado: "Formando", pago: true, valor: 125, metodo: "Cartão" },
  { id: 17516, nome: "Andreia", apelido: "Arantes", telf: "962016923", email: "andreia_filipa@hotmail.com", inscrito: "2026-08-31 20:22", local: "Braga", curso: "Formação de Formadores - CCP", turma: "BRG-SM-21/09", turmaId: 944, estado: "Formando", pago: true, valor: 120, metodo: "MB Way" },
  { id: 17514, nome: "Hugo", apelido: "Baldaia", telf: "932832245", email: "hugo.baldaia2@gmail.com", inscrito: "2026-08-31 14:32", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-PL-04/09", turmaId: 939, estado: "Formando", pago: true, valor: 125, metodo: "MB Way" },
  { id: 17510, nome: "Marta", apelido: "Maia", telf: "914304801", email: "marta_maia84@hotmail.com", inscrito: "2026-08-30 12:33", local: "V.N.Gaia", curso: "Formação de Formadores - CCP", turma: "VNG-PL-04/09", turmaId: 939, estado: "Formando", pago: true, valor: 125, metodo: "Multibanco" },
];

const FORMANDOS_FIN = [
  { id: 27, nome: "Diogo Alexandre", apelido: "Soares Oliveira", turma: "SM-T01", telf: "914388980", email: "diogo_nik@hotmail.com", curso: "Publicidade nas Redes Sociais", estado: "Elegível", cc: { ok: true, data: "2021-01-10" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: true, data: "2021-01-12" }, ce: { ok: false, data: "" } },
  { id: 42, nome: "Laércio Daniel", apelido: "Ferreira da Costa", turma: "SM-T01", telf: "933168749", email: "71aercio7@gmail.com", curso: "Publicidade nas Redes Sociais", estado: "Elegível", cc: { ok: true, data: "2021-01-12" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: false, data: "" }, ce: { ok: false, data: "" } },
  { id: 71, nome: "Vanesa Magali", apelido: "Correa Bender", turma: "SM-T01", telf: "963130925", email: "valescabender@gmail.com", curso: "Publicidade nas Redes Sociais", estado: "Elegível", cc: { ok: true, data: "2021-01-20" }, ch: { ok: true, data: "2021-01-21" }, cu: { ok: true, data: "2021-01-22" }, ci: { ok: true, data: "2021-01-20" }, ce: { ok: true, data: "2021-01-23" } },
  { id: 81, nome: "Tânia", apelido: "Veloso", turma: "SM-T01", telf: "914011998", email: "taniapatriciaveloso@gmail.com", curso: "Publicidade nas Redes Sociais", estado: "Elegível", cc: { ok: true, data: "2021-01-24" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: false, data: "" }, ce: { ok: false, data: "" } },
  { id: 97, nome: "Mariana", apelido: "Sousa Pereira", turma: "UFCD 3564 · T1", telf: "932874093", email: "mariana98pereira@gmail.com", curso: "Primeiros Socorros", estado: "Elegível", cc: { ok: false, data: "" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: false, data: "" }, ce: { ok: false, data: "" } },
];

const TRANSACOES = [
  { id: "TRX-17550", nome: "Tiago Bento", valor: 125, metodo: "MB Way", curso: "Formação de Formadores - CCP", data: "2026-09-03 16:21", estado: "Pago" },
  { id: "TRX-17539", nome: "Aline Cristina Pereira", valor: 120, metodo: "Cartão", curso: "Formação de Formadores - CCP", data: "2026-09-04 11:07", estado: "Pago" },
  { id: "TRX-17536", nome: "Priscila Damasceno", valor: 300, metodo: "Transferência", curso: "Auxiliar de Medicina Dentária", data: "2026-09-04 09:52", estado: "Pendente" },
  { id: "TRX-17530", nome: "Maria Mota", valor: 120, metodo: "Cartão", curso: "Formação de Formadores - CCP", data: "2026-09-01 09:36", estado: "Pago" },
  { id: "TRX-17522", nome: "Hugo Baldaia", valor: 145, metodo: "MB Way", curso: "Formação de Formadores - CCP", data: "2026-08-31 14:32", estado: "Pago" },
];

const NOTIFICACOES = [
  { tipo: "warn", titulo: "VNG-SM-07/09 sem vagas", texto: "A turma de V.N.Gaia (07/09) atingiu capacidade máxima - 10/10 formandos.", tempo: "2 min", lida: false, view: "gold-cockpit-turma", turma_id: 943, tab: "overview" },
  { tipo: "error", titulo: "67 pagamentos pendentes", texto: "8 400 euros por confirmar. 12 com mais de 7 dias sem resposta.", tempo: "15 min", lida: false, view: "pagamentos", turma_id: null, tab: null },
  { tipo: "warn", titulo: "DTP da turma UFCD 3564 · T1 a 54%", texto: "A turma não arranca: faltam habilitações, CV e comprovativo de emprego.", tempo: "1h", lida: false, view: "fin-cockpit-turma", turma_id: 218, tab: "dtp" },
  { tipo: "warn", titulo: "DTP incompleto - turma VNG-SM-07/09", texto: "PIP, simulações e sumários em falta. Não emitir CCP.", tempo: "45 min", lida: false, view: "gold-cockpit-turma", turma_id: 943, tab: "dtp" },
  { tipo: "info", titulo: "Nova pré-inscrição Gold", texto: "Inês Caetano inscreveu-se em CCP - turma VNG-SM-07/09.", tempo: "2h", lida: true, view: "gold-preinscricoes", turma_id: null, tab: null },
  { tipo: "info", titulo: "Turma BRG-PL-15/09 com poucas inscrições", texto: "Apenas 2 de 16 vagas preenchidas. A 15/09 está próxima.", tempo: "3h", lida: true, view: "gold-turmas", turma_id: null, tab: null },
];

export async function seed(db: Db) {
  const email = normalizeEmail(config.adminEmail);
  const existing = await db.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (!existing.rows[0]) {
    await db.query(
      "INSERT INTO users (id, name, email, password_hash, role, active) VALUES ($1, $2, $3, $4, 'admin', true)",
      [randomUUID(), config.adminName, email, await hashPassword(config.adminPassword)],
    );
  }

  for (const t of TEMPLATES) {
    await db.query(
      `INSERT INTO email_templates (tipo, nome, assunto, body_lines, cta, cta_href, cta_ambito)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (tipo) DO UPDATE SET
         nome = EXCLUDED.nome,
         assunto = CASE WHEN email_templates.assunto = EXCLUDED.assunto THEN email_templates.assunto ELSE email_templates.assunto END,
         body_lines = CASE WHEN email_templates.body_lines = '[]'::jsonb THEN EXCLUDED.body_lines ELSE email_templates.body_lines END,
         cta_href = CASE WHEN email_templates.cta_href = '' THEN EXCLUDED.cta_href ELSE email_templates.cta_href END,
         cta_ambito = CASE WHEN email_templates.cta_href = '' THEN EXCLUDED.cta_ambito ELSE email_templates.cta_ambito END`,
      [t.tipo, t.nome, t.assunto, JSON.stringify(t.linhas), t.cta, t.href, t.ambito],
    );
    const row = await db.query<{ body_lines: unknown; body_xml: string; cta_href: string }>(
      "SELECT body_lines, body_xml, cta_href FROM email_templates WHERE tipo = $1",
      [t.tipo],
    );
    const lines = row.rows[0]?.body_lines;
    const empty = !lines || (Array.isArray(lines) && lines.length === 0);
    const xml = linesToXml(t.linhas, t.cta, t.href, t.ambito);
    if (empty) {
      await db.query(
        "UPDATE email_templates SET assunto = $2, body_lines = $3::jsonb, cta = $4, cta_href = $5, cta_ambito = $6, body_xml = $7, updated_at = now() WHERE tipo = $1",
        [t.tipo, t.assunto, JSON.stringify(t.linhas), t.cta, t.href, t.ambito, xml],
      );
    } else if (!row.rows[0]?.body_xml?.trim()) {
      await db.query("UPDATE email_templates SET body_xml = $2, updated_at = now() WHERE tipo = $1", [t.tipo, xml]);
    } else if (!/<cta\b[^>]*\bhref\s*=/i.test(row.rows[0]?.body_xml ?? "")) {
      const nextXml = (row.rows[0]?.body_xml ?? "").replace(
        /<cta\b[^>]*>[\s\S]*?<\/cta>/i,
        `<cta ambito="${t.ambito}" href="${t.href.replace(/&/g, "&amp;")}">${t.cta}</cta>`,
      );
      await db.query(
        "UPDATE email_templates SET body_xml = $2, cta_href = CASE WHEN cta_href = '' THEN $3 ELSE cta_href END, cta_ambito = $4, updated_at = now() WHERE tipo = $1",
        [t.tipo, nextXml, t.href, t.ambito],
      );
    }
  }

  const countRules = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM email_rules");
  if ((countRules.rows[0]?.n ?? 0) === 0) {
    for (const r of RULES) {
      await db.query(
        `INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, ativo)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [r.nome, r.key, r.gatilho, r.tipo, r.delay, r.ativo !== false],
      );
    }
  }

  // Seed formadores
  const countFormadores = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM formadores");
  if ((countFormadores.rows[0]?.n ?? 0) === 0) {
    for (const f of FORMADORES) {
      await db.query(
        `INSERT INTO formadores (id, nome, telf, email, especialidade, ccp, nif, regimes, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         ON CONFLICT (id) DO NOTHING`,
        [f.id, f.nome, f.telf, f.email, f.especialidade, f.ccp, f.nif, JSON.stringify(f.regimes), f.estado],
      );
    }
  }

  // Seed cursos
  const countCursos = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM cursos");
  if ((countCursos.rows[0]?.n ?? 0) === 0) {
    for (const c of CURSOS) {
      await db.query(
        `INSERT INTO cursos (id, regime, nome, categoria, tipo, preco, horas, estado, ufcd_cod, ufcd, nome_comercial)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.regime, c.nome, c.categoria, c.tipo, c.preco, c.horas, c.estado, c.ufcd_cod, c.ufcd, c.nome_comercial],
      );
    }
  }

  // Seed turmas
  const countTurmas = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM turmas");
  if ((countTurmas.rows[0]?.n ?? 0) === 0) {
    for (const t of TURMAS_GOLD) {
      const crono = makeCronograma(t.dataInicio, t.horario, 90, t.formador);
      await db.query(
        `INSERT INTO turmas (id, regime, nome, curso, local, horario, data_inicio, vagas, total_alunos, estado, horas, formador, activa, cronograma)
         VALUES ($1, 'gold', $2, $3, $4, $5, $6, $7, $8, $9, 90, $10, $11, $12::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.nome, t.curso, t.local, t.horario, t.dataInicio, t.vagas, t.totalAlunos, t.estado, t.formador, t.estado === "Ativa", JSON.stringify(crono)],
      );
    }
    for (const t of TURMAS_FIN) {
      const crono = makeCronograma(t.dataInicio, t.horario, t.horas, t.formador);
      await db.query(
        `INSERT INTO turmas (id, regime, nome, curso, local, horario, data_inicio, vagas, total_alunos, estado, horas, formador, ufcd_cod, activa, cronograma)
         VALUES ($1, 'fin', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.nome, t.curso, t.local, t.horario, t.dataInicio, t.alunosTotal, t.alunos, t.estado, t.horas, t.formador, t.ufcdCod, t.activa, JSON.stringify(crono)],
      );
    }
  }

  // Seed preinscricoes
  const countPre = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM preinscricoes");
  if ((countPre.rows[0]?.n ?? 0) === 0) {
    for (const p of PREINSCRICOES) {
      await db.query(
        `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, inicio_curso, concelho, local, curso, preco, estado, campanha, origem)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.inscrito, p.nome, p.apelido, p.email, p.telf, p.inicioCurso, p.concelho, p.local, p.curso, p.preco, p.estado, p.campanha, p.origem],
      );
    }
  }

  // Seed formandos turmas
  const countFT = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM formandos_turmas");
  if ((countFT.rows[0]?.n ?? 0) === 0) {
    for (const f of FORMANDOS_TURMAS) {
      await db.query(
        `INSERT INTO formandos_turmas (id, nome, apelido, telf, email, inscrito, local, curso, turma, turma_id, estado, pago, valor, metodo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [f.id, f.nome, f.apelido, f.telf, f.email, f.inscrito, f.local, f.curso, f.turma, f.turmaId, f.estado, f.pago, f.valor, f.metodo],
      );
    }
  }

  // Seed formandos fin
  const countFF = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM formandos_fin");
  if ((countFF.rows[0]?.n ?? 0) === 0) {
    for (const f of FORMANDOS_FIN) {
      await db.query(
        `INSERT INTO formandos_fin (id, nome, apelido, turma, telf, email, curso, estado, cc, ch, cu, ci, ce)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [f.id, f.nome, f.apelido, f.turma, f.telf, f.email, f.curso, f.estado, JSON.stringify(f.cc), JSON.stringify(f.ch), JSON.stringify(f.cu), JSON.stringify(f.ci), JSON.stringify(f.ce)],
      );
    }
  }

  // Seed transacoes
  const countTrx = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM transacoes");
  if ((countTrx.rows[0]?.n ?? 0) === 0) {
    for (const t of TRANSACOES) {
      await db.query(
        `INSERT INTO transacoes (id, nome, valor, metodo, curso, data, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.nome, t.valor, t.metodo, t.curso, t.data, t.estado],
      );
    }
  }

  // Seed notificacoes
  const countNotifs = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM notificacoes");
  if ((countNotifs.rows[0]?.n ?? 0) === 0) {
    for (const n of NOTIFICACOES) {
      await db.query(
        `INSERT INTO notificacoes (tipo, titulo, texto, tempo, lida, view, turma_id, tab)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [n.tipo, n.titulo, n.texto, n.tempo, n.lida, n.view, n.turma_id, n.tab],
      );
    }
  }

  // Seed inqueritos
  const countInq = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM inqueritos");
  if ((countInq.rows[0]?.n ?? 0) === 0) {
    await db.query(
      `INSERT INTO inqueritos (regime, titulo, perguntas, respostas, ativo)
       VALUES ('gold', 'Inquérito de Satisfação da Formação Gold', $1::jsonb, '[]'::jsonb, true),
              ('fin', 'Inquérito de Avaliação da Ação Financiada', $2::jsonb, '[]'::jsonb, true)`,
      [
        JSON.stringify([
          { id: "p1", texto: "Como avalia o desempenho do formador?", tipo: "escala" },
          { id: "p2", texto: "Os objetivos pedagógicos foram atingidos?", tipo: "sim_nao" },
          { id: "p3", texto: "Qual o seu nível global de satisfação?", tipo: "escala" },
          { id: "p4", texto: "Comentários e sugestões adicionais", tipo: "texto" },
        ]),
        JSON.stringify([
          { id: "p1", texto: "A clareza dos conteúdos transmitidos", tipo: "escala" },
          { id: "p2", texto: "Adequação dos meios técnicos e sala virtual", tipo: "escala" },
          { id: "p3", texto: "Recomendaria este módulo a outros colegas?", tipo: "sim_nao" },
        ]),
      ],
    );
  }

  // Seed configuracoes
  const countCfg = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM configuracoes");
  if ((countCfg.rows[0]?.n ?? 0) === 0) {
    await db.query(
      `INSERT INTO configuracoes (id, dados)
       VALUES ('geral', $1::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        JSON.stringify({
          entidade: { nome: "ENA - Escola de Negócios e Administração", nif: "508123456", morada: "V.N. Gaia" },
          dgert: { certificado: "DGERT-4401/2020", validade: "2028-12-31" },
          iefp: { polo: "Norte - VNG", responsavel: "Tânia" },
        }),
      ],
    );
  }
}
