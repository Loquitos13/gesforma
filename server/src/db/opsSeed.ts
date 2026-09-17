import { generateCronograma } from "../cronograma.js";
import { seedCatalogs } from "./catalogSeed.js";
import type { Db } from "./pool.js";

type TurmaCronogramaRow = {
  id: number;
  data_inicio: string;
  horario: string;
  horas: number;
  formador: string;
  curso: string;
};

/** Sem cronograma na base o DTP e os planos de sessão não têm denominador real. */
async function backfillCronogramas(db: Db) {
  for (const table of ["turmas_gold", "turmas_fin"] as const) {
    const rows = await db.query<TurmaCronogramaRow>(
      `SELECT id, data_inicio, horario, horas, formador, curso FROM ${table}
        WHERE cronograma IS NULL
           OR CASE jsonb_typeof(cronograma)
                WHEN 'array' THEN jsonb_array_length(cronograma) = 0
                ELSE true
              END`,
    );
    for (const t of rows.rows) {
      const horario = table === "turmas_fin" && (!t.horario || t.horario === "Online") ? "Pós Laboral" : t.horario;
      const sessoes = generateCronograma({
        inicio: t.data_inicio,
        horario,
        horas: Number(t.horas) || (table === "turmas_gold" ? 90 : 25),
        formador: t.formador,
        curso: t.curso,
      });
      await db.query(`UPDATE ${table} SET cronograma = $2::jsonb WHERE id = $1`, [t.id, sessoes]);
    }
  }
}

/**
 * O número de inscritos da turma é um contador mantido pela app. Recalcula-se no arranque
 * para o cockpit não dizer 14 formandos quando a lista só tem 10.
 */
async function syncContagensDeTurma(db: Db) {
  await db.query(`
    UPDATE turmas_gold t SET total_alunos = (
      SELECT count(*)::int FROM formandos_gold f WHERE f.turma_id = t.id OR f.turma = t.nome
    )
    WHERE t.total_alunos <> (
      SELECT count(*)::int FROM formandos_gold f WHERE f.turma_id = t.id OR f.turma = t.nome
    )
  `);
  await db.query(`
    UPDATE turmas_fin t SET alunos = (
      SELECT count(*)::int FROM formandos_fin f
       WHERE f.turma = t.nome
          OR (f.curso = t.curso AND NOT EXISTS (SELECT 1 FROM turmas_fin t2 WHERE t2.nome = f.turma))
    )
    WHERE t.alunos <> (
      SELECT count(*)::int FROM formandos_fin f
       WHERE f.turma = t.nome
          OR (f.curso = t.curso AND NOT EXISTS (SELECT 1 FROM turmas_fin t2 WHERE t2.nome = f.turma))
    )
  `);
}

/**
 * Documentos administrativos que a ENA arquiva quando abre a turma. Os itens pedagógicos
 * (planos, sumários, presenças, PIP, simulações, certificados) ficam de fora: saem dos dados reais.
 */
const DTP_BASE = [
  "id-turma", "ufcd", "programa", "regulamento", "divulgacao", "fichas",
  "contrato-formador", "cv-formador", "ccp-formador", "habil-formador",
  "instalacoes", "rgpd", "ocorrencias", "materiais",
] as const;

async function seedDtpBase(db: Db) {
  for (const [table, regime] of [["turmas_gold", "gold"], ["turmas_fin", "fin"]] as const) {
    const rows = await db.query<{ id: number }>(
      `SELECT t.id FROM ${table} t
        WHERE NOT EXISTS (SELECT 1 FROM turma_dtp d WHERE d.regime = $1 AND d.turma_id = t.id)`,
      [regime],
    );
    for (const t of rows.rows) {
      for (const item of DTP_BASE) {
        await db.query(
          `INSERT INTO turma_dtp (regime, turma_id, item_id, estado) VALUES ($1, $2, $3, 'ok')
           ON CONFLICT (regime, turma_id, item_id) DO NOTHING`,
          [regime, t.id, item],
        );
      }
    }
  }
}

const CURSOS_GOLD = [
  [100, "Formação de Formadores - CCP", "CCP e Gestão da Formação", "Gold", 125, "b-learning", 90, "Ativo"],
  [108, "A Arte de Comunicar e Falar em Público: B-learning", "Desenvolvimento Pessoal", "Gold", 80, "b-learning", 16, "Inactivo"],
  [107, "A Arte de Comunicar e Falar em Público: E-learning", "Desenvolvimento Pessoal", "Pré-inscrição", 35, "e-learning", 8, "Inactivo"],
  [131, "CCP - Formação de Formadores para Empresas", "CCP e Gestão da Formação", "Pré-inscrição", 120, "b-learning", 90, "Inactivo"],
  [130, "Curso de Auxiliar de Medicina Dentária", "Saúde e bem estar", "Pré-inscrição", 300, "e-learning", 99, "Ativo"],
  [134, "Curso de Auxiliar de Medicina Veterinária", "Saúde e bem estar", "Pré-inscrição", 400, "e-learning", 120, "Ativo"],
  [136, "Curso de Cura Prânica", "Desenvolvimento Pessoal", "Pré-inscrição", 200, "b-learning", 20, "Ativo"],
  [138, "Excel do Básico ao Avançado", "CCP e Gestão da Formação", "Gold", 45, "e-learning", 12, "Ativo"],
] as const;

const CURSOS_FIN = [
  [6, "10785", "Publicidade nas Redes Socias", "Publicidade nas Redes Sociais: Master em Tráfego", "e-learning", 25, "Inactivo"],
  [43, "3564", "Primeiros Socorros", "Primeiros Socorros", "e-learning", 25, "Ativo"],
  [65, "9188", "Fundamentos de cibersegurança", "Fundamentos de cibersegurança", "b-learning", 25, "Inactivo"],
  [68, "10394", "Métodos e técnicas pedagógicas", "Métodos e Técnicas Pedagógicas Ativos", "b-learning", 25, "Ativo"],
] as const;

const FORMADORES = [
  [7, "Isac Silva", "914 547 554", "isacsilva1992@gmail.com", "CCP e pedagogia", "F-44821", "221 448 210", ["gold", "fin"], "Ativo"],
  [8, "Ivan Esteves", "912 370 557", "exsorio2@gmail.com", "Comunicação", "F-51209", "198 220 114", ["gold"], "Ativo"],
  [11, "António Cardeal", "915 258 691", "antoniocardeal71@gmail.com", "Comunicar em contexto profissional", "F-39012", "176 901 332", ["fin"], "Ativo"],
  [12, "Cátia Pinheiro", "912 919 291", "catiapinheiro@ena.pt", "Estética facial", "F-60118", "245 118 009", ["fin"], "Ativo"],
  [19, "Vânia Fernandes", "967 432 879", "fernandes.c.vania@gmail.com", "Primeiros socorros", "F-44790", "203 774 881", ["gold", "fin"], "Ativo"],
  [20, "Rosana Suarez", "938 039 001", "roxana.suarez.costa@gmail.com", "Massagem", "F-55802", "189 330 447", ["fin"], "Ativo"],
] as const;

const TURMAS_GOLD = [
  [947, "2026-09-03", "2176/2026", "Formação de Formadores - CCP", "V.N.Gaia", "Laboral Manhã", 16, 16, "Ativa"],
  [946, "2026-07-06", "IRN LSB 01/09", "Formação de Formadores - CCP", "Lisboa", "Laboral Manhã", 12, 16, "Ativa"],
  [945, "2026-09-15", "BRG-PL-15/09", "Formação de Formadores - CCP", "Braga", "Pós Laboral", 2, 16, "Ativa"],
  [944, "2026-09-21", "BRG-SM-21/09", "Formação de Formadores - CCP", "Braga", "Sábado manhã", 6, 16, "Ativa"],
  [943, "2026-09-07", "VNG-SM-07/09", "Formação de Formadores - CCP", "V.N.Gaia", "Sábado manhã", 10, 16, "Ativa"],
  [940, "2026-09-03", "2175/2026", "Formação de Formadores - CCP", "V.N.Gaia", "Laboral Manhã", 14, 16, "Ativa"],
  [939, "2026-09-04", "VNG-PL-04/09", "Formação de Formadores - CCP", "V.N.Gaia", "Pós Laboral", 9, 16, "Ativa"],
  [938, "2026-09-02", "PEN-SM-02/09", "Formação de Formadores - CCP", "Penafiel", "Sábado manhã", 13, 16, "Ativa"],
  [937, "2026-08-28", "VNG-SM-28/08", "Formação de Formadores - CCP", "V.N.Gaia", "Sábado manhã", 12, 16, "Inativa"],
  [936, "2026-09-03", "VNG-LM-03/09", "Formação de Formadores - CCP", "V.N.Gaia", "Laboral Manhã", 12, 16, "Inativa"],
] as const;

const TURMAS_FIN = [
  [222, "2026-09-18", "UFCD 9109 - Cuidados Básicos", "Masterclass em Estética Facial", "9109", "Sala Virtual / E-Learning", "Online", 1, 20, "A montar", 25, "Cátia", false],
  [220, "2026-07-31", "UC02282 - Criar campanhas", "Publicidade nas Redes Sociais", "10785", "Sala Virtual / E-Learning", "Online", 17, 20, "A montar", 25, "Isac", true],
  [219, "2026-08-31", "UCUC00033 - Comunicar", "Comunicar e interagir em contexto profissional", "3564", "Sala Virtual / E-Learning", "Online", 17, 20, "A decorrer", 25, "António", true],
  [218, "2026-08-27", "UFCD 3564 - Primeiros So.", "Primeiros Socorros", "3564", "Sala Virtual / E-Learning", "Online", 4, 20, "A montar", 25, "Vânia Fernandes", true],
  [217, "2026-08-27", "UFCD 9119 - Massagem", "Técnicas de massagem", "9119", "Sala Virtual / E-Learning", "Online", 17, 20, "A decorrer", 25, "Rosana", true],
] as const;

const PREINSCRICOES = [
  [17550, "2026-09-04 11:24", "Inês", "Caetano", "caetanoines9@gmail.com", "932810856", "2026-09-07", "Trofa", "V.N.Gaia", "Formação de Formadores - CCP", 125, "Não contactado", "Setembro 2026", "Website"],
  [17539, "2026-09-04 11:07", "Aline Cristina", "Pereira", "alinecristina@ua.pt", "934283406", "2026-09-03", "Guimarães", "Braga", "Formação de Formadores - CCP", 120, "1º Contacto", "Setembro 2026", "Facebook"],
  [17536, "2026-09-04 09:52", "Priscila", "Damasceno", "prisciladamasceno82@gmail.com", "931810126", "-", "Leiria", "Sala Virtual", "Auxiliar de Medicina Dentária", 300, "1º Contacto", "Setembro 2026", "Google"],
  [17534, "2026-09-03 22:20", "Glynnis", "Ferreira", "glynnisferreira@gmail.com", "939080789", "-", "V.N.Gaia", "E-learning", "E-Formador novas tecnologias", 80, "1º Contacto", "CCP 2020", "Website"],
  [17533, "2026-09-03 21:24", "Carolina", "Esteves", "carolinaesteves@gmail.com", "960303492", "2026-09-07", "Braga", "V.N.Gaia", "Formação de Formadores - CCP", 125, "1º Contacto", "Setembro 2026", "Instagram"],
  [17532, "2026-09-03 17:28", "Susana", "Santos", "info@drasusanasantos.co", "919890846", "2026-09-07", "Lisboa", "Lisboa - Pós Laboral", "Formação de Formadores - CCP", 145, "Não contactado", "Setembro 2026", "Referência"],
  [17531, "2026-09-03 16:32", "Cheila", "Parisot", "cheilaparisot@gmail.com", "917754385", "2026-07-06", "Sintra", "Lisboa - Laboral Manhã", "Formação de Formadores - CCP", 145, "2º Contacto", "Setembro 2026", "Facebook"],
  [17530, "2026-09-03 16:21", "Tiago", "Bento", "tiagojsbento@gmail.com", "919700594", "2026-09-07", "V.N.Gaia", "V.N.Gaia", "Formação de Formadores - CCP", 125, "Pago", "Setembro 2026", "Website"],
  [17529, "2026-09-03 16:03", "Taís", "Araújo", "taisaraujoady@gmail.com", "926305132", "2026-09-03", "Braga", "Braga", "Formação de Formadores - CCP", 120, "Formando", "CCP 2020", "Google"],
  [17528, "2026-09-03 13:08", "Luísa", "Monteiro", "luisa.fmonteiro19@gmail.com", "910323422", "2026-09-03", "Maia", "V.N.Gaia", "Formação de Formadores - CCP", 125, "Formando", "Setembro 2026", "Website"],
] as const;

const FORMANDOS_GOLD = [
  [17550, "Tiago", "Bento", "919700594", "tiagojsbento@gmail.com", "2026-09-03 16:21", "V.N.Gaia", "Formação de Formadores - CCP", "VNG-SM-07/09", 943, "Formando", true, 125, "MB Way"],
  [17539, "Luciana", "D'Avila", "910641014", "davila.lucianam@gmail.com", "2026-09-02 16:29", "V.N.Gaia", "Formação de Formadores - CCP", "VNG-SM-07/09", 943, "Formando", true, 125, "Cartão"],
  [17536, "Ciara", "Gonçalves", "912247513", "g.clarasofia03@gmail.com", "2026-09-02 11:45", "Penafiel", "Formação de Formadores - CCP", "PEN-SM-02/09", 938, "Formando", false, 125, "-"],
  [17534, "Liliana", "Real", "9111", "liascr777@gmail.com", "2026-09-02 09:32", "Penafiel", "Formação de Formadores - CCP", "PEN-SM-02/09", 938, "Formando", true, 125, "Multibanco"],
  [17526, "Angélica", "Ribeiro", "935043095", "alribeiro53@gmail.com", "2026-09-01 15:06", "V.N.Gaia", "Formação de Formadores - CCP", "VNG-SM-07/09", 943, "Formando", true, 125, "MB Way"],
  [17522, "Maria", "Mota", "925997151", "mccmota.28@gmail.com", "2026-09-01 09:36", "Braga", "Formação de Formadores - CCP", "BRG-PL-15/09", 945, "Formando", false, 120, "-"],
  [17517, "Elisabete", "Soares", "914298952", "elisabete.soares@netcabo.pt", "2026-08-31 21:45", "V.N.Gaia", "Formação de Formadores - CCP", "VNG-SM-07/09", 943, "Formando", true, 125, "Cartão"],
  [17516, "Andreia", "Arantes", "962016923", "andreia_filipa@hotmail.com", "2026-08-31 20:22", "Braga", "Formação de Formadores - CCP", "BRG-SM-21/09", 944, "Formando", true, 120, "MB Way"],
  [17514, "Hugo", "Baldaia", "932832245", "hugo.baldaia2@gmail.com", "2026-08-31 14:32", "V.N.Gaia", "Formação de Formadores - CCP", "VNG-PL-04/09", 939, "Formando", true, 125, "MB Way"],
  [17510, "Marta", "Maia", "914304801", "marta_maia84@hotmail.com", "2026-08-30 12:33", "V.N.Gaia", "Formação de Formadores - CCP", "VNG-PL-04/09", 939, "Formando", true, 125, "Multibanco"],
] as const;

const FORMANDOS_FIN = [
  [27, "Diogo Alexandre", "Soares Oliveira", "SM-T01", "914388980", "diogo_nik@hotmail.com", "Publicidade nas Redes Sociais", "Elegível", { cc: { ok: true, data: "2021-01-10" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: true, data: "2021-01-12" }, ce: { ok: false, data: "" } }],
  [42, "Laércio Daniel", "Ferreira da Costa", "SM-T01", "933168749", "71aercio7@gmail.com", "Publicidade nas Redes Sociais", "Elegível", { cc: { ok: true, data: "2021-01-12" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: false, data: "" }, ce: { ok: false, data: "" } }],
  [71, "Vanesa Magali", "Correa Bender", "SM-T01", "963130925", "valescabender@gmail.com", "Publicidade nas Redes Sociais", "Elegível", { cc: { ok: true, data: "2021-01-20" }, ch: { ok: true, data: "2021-01-21" }, cu: { ok: true, data: "2021-01-22" }, ci: { ok: true, data: "2021-01-20" }, ce: { ok: true, data: "2021-01-23" } }],
  [81, "Tânia", "Veloso", "SM-T01", "914011998", "taniapatriciaveloso@gmail.com", "Publicidade nas Redes Sociais", "Elegível", { cc: { ok: true, data: "2021-01-24" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: false, data: "" }, ce: { ok: false, data: "" } }],
  [97, "Mariana", "Sousa Pereira", "UFCD 3564 · T1", "932874093", "mariana98pereira@gmail.com", "Primeiros Socorros", "Elegível", { cc: { ok: false, data: "" }, ch: { ok: false, data: "" }, cu: { ok: false, data: "" }, ci: { ok: false, data: "" }, ce: { ok: false, data: "" } }],
] as const;

const CAMPANHAS = [
  [4, "Setembro 2026", "2026-09-01", "Aguilar", 421, 38, 4750, 380],
  [3, "CCP 2020", "2022-05-30", "Aguilar", 890, 212, 25440, 890],
  [1, "Outubro - Março - CCP", "2021-03-09", "Escola", 1240, 480, 57600, 1800],
] as const;

const BLOG = [
  [25, "Dicas para aprender online com sucesso", "dicas-aprender-online", "2025-12-15", "Ativo"],
  [26, "O que é a Formação Financiada?", "formacao-financiada", "2025-12-16", "Ativo"],
  [27, "CCP: Formação de Formadores explicada", "ccp-formacao-formadores", "2025-12-16", "Ativo"],
] as const;

const PAGAMENTOS = [
  ["TRX-17550", "Tiago Bento", 125, "MB Way", "Formação de Formadores - CCP", "2026-09-03 16:21", "Pago"],
  ["TRX-17539", "Aline Cristina Pereira", 120, "Cartão", "Formação de Formadores - CCP", "2026-09-04 11:07", "Pago"],
  ["TRX-17536", "Priscila Damasceno", 300, "Transferência", "Auxiliar de Medicina Dentária", "2026-09-04 09:52", "Pendente"],
  ["TRX-17530", "Maria Mota", 120, "Cartão", "Formação de Formadores - CCP", "2026-09-01 09:36", "Pago"],
  ["TRX-17522", "Hugo Baldaia", 145, "MB Way", "Formação de Formadores - CCP", "2026-08-31 14:32", "Pago"],
] as const;

async function empty(db: Db, table: string) {
  const row = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
  return (row.rows[0]?.n ?? 0) === 0;
}

export async function seedOperational(db: Db) {
  if (await empty(db, "cursos_gold")) {
    for (const r of CURSOS_GOLD) {
      await db.query(
        "INSERT INTO cursos_gold (id, nome, categoria, tipo, preco, regime, horas, estado) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [...r],
      );
    }
  }
  if (await empty(db, "cursos_fin")) {
    for (const r of CURSOS_FIN) {
      await db.query(
        "INSERT INTO cursos_fin (id, ufcd_cod, ufcd, nome_comercial, regime, horas, estado) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [...r],
      );
    }
  }
  if (await empty(db, "formadores")) {
    for (const r of FORMADORES) {
      await db.query(
        "INSERT INTO formadores (id, nome, telf, email, especialidade, ccp, nif, regimes, estado) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)",
        [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]],
      );
    }
  }
  if (await empty(db, "turmas_gold")) {
    for (const r of TURMAS_GOLD) {
      await db.query(
        "INSERT INTO turmas_gold (id, data_inicio, nome, curso, local, horario, total_alunos, vagas, estado, formador, horas) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [...r, "Isac Silva", 90],
      );
    }
  }
  if (await empty(db, "turmas_fin")) {
    for (const r of TURMAS_FIN) {
      await db.query(
        "INSERT INTO turmas_fin (id, data_inicio, nome, curso, ufcd_cod, local, horario, alunos, alunos_total, estado, horas, formador, activa) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [...r],
      );
    }
  }
  if (await empty(db, "preinscricoes")) {
    for (const r of PREINSCRICOES) {
      await db.query(
        `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, inicio_curso, concelho, local, curso, preco, estado, campanha, origem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [...r],
      );
    }
  }
  if (await empty(db, "formandos_gold")) {
    for (const r of FORMANDOS_GOLD) {
      await db.query(
        `INSERT INTO formandos_gold (id, nome, apelido, telf, email, inscrito, local, curso, turma, turma_id, estado, pago, valor, metodo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [...r],
      );
    }
  }
  if (await empty(db, "formandos_fin")) {
    for (const r of FORMANDOS_FIN) {
      await db.query(
        "INSERT INTO formandos_fin (id, nome, apelido, turma, telf, email, curso, estado, docs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)",
        [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]],
      );
    }
  }
  if (await empty(db, "campanhas")) {
    for (const r of CAMPANHAS) {
      await db.query(
        "INSERT INTO campanhas (id, nome, data, encarregado, preinscricoes, pagos, receita, custo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [...r],
      );
    }
  }
  if (await empty(db, "blog_posts")) {
    for (const r of BLOG) {
      await db.query("INSERT INTO blog_posts (id, titulo, slug, data, status) VALUES ($1,$2,$3,$4,$5)", [...r]);
    }
  }
  if (await empty(db, "pagamentos")) {
    for (const r of PAGAMENTOS) {
      await db.query(
        "INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [...r],
      );
    }
  }

  await seedCatalogs(db);
  await backfillCronogramas(db);
  await seedDtpBase(db);
  await syncContagensDeTurma(db);

  await db.query(`
    SELECT setval('ops_id_seq', GREATEST(
      20000,
      (SELECT COALESCE(MAX(id), 0) FROM preinscricoes),
      (SELECT COALESCE(MAX(id), 0) FROM formandos_gold),
      (SELECT COALESCE(MAX(id), 0) FROM formandos_fin),
      (SELECT COALESCE(MAX(id), 0) FROM cursos_gold),
      (SELECT COALESCE(MAX(id), 0) FROM cursos_fin),
      (SELECT COALESCE(MAX(id), 0) FROM turmas_gold),
      (SELECT COALESCE(MAX(id), 0) FROM turmas_fin),
      (SELECT COALESCE(MAX(id), 0) FROM formadores),
      (SELECT COALESCE(MAX(id), 0) FROM campanhas),
      (SELECT COALESCE(MAX(id), 0) FROM blog_posts)
    ))
  `);
}
