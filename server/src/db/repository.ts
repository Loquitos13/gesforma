import type { Db } from "./pool.js";

// Formadores
export async function dbGetFormadores(db: Db) {
  const res = await db.query<{
    id: number;
    nome: string;
    telf: string;
    email: string;
    especialidade: string;
    ccp: string;
    nif: string;
    regimes: string[];
    estado: string;
  }>("SELECT id, nome, telf, email, especialidade, ccp, nif, regimes, estado FROM formadores ORDER BY id DESC");
  return res.rows;
}

export async function dbCreateFormador(db: Db, b: Record<string, any>) {
  const id = b.id || (Date.now() % 100000);
  const res = await db.query<{
    id: number;
    nome: string;
    telf: string;
    email: string;
    especialidade: string;
    ccp: string;
    nif: string;
    regimes: string[];
    estado: string;
  }>(
    `INSERT INTO formadores (id, nome, telf, email, especialidade, ccp, nif, regimes, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     RETURNING id, nome, telf, email, especialidade, ccp, nif, regimes, estado`,
    [
      id,
      b.nome || "",
      b.telf || "",
      b.email || "",
      b.especialidade || "",
      b.ccp || "",
      b.nif || "",
      JSON.stringify(b.regimes || ["gold"]),
      b.estado || "Ativo",
    ],
  );
  return res.rows[0];
}

export async function dbUpdateFormador(db: Db, id: number, b: Record<string, any>) {
  await db.query(
    `UPDATE formadores SET
       nome = COALESCE($2, nome),
       telf = COALESCE($3, telf),
       email = COALESCE($4, email),
       especialidade = COALESCE($5, especialidade),
       ccp = COALESCE($6, ccp),
       nif = COALESCE($7, nif),
       regimes = COALESCE($8::jsonb, regimes),
       estado = COALESCE($9, estado),
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      b.nome ?? null,
      b.telf ?? null,
      b.email ?? null,
      b.especialidade ?? null,
      b.ccp ?? null,
      b.nif ?? null,
      b.regimes ? JSON.stringify(b.regimes) : null,
      b.estado ?? null,
    ],
  );
}

export async function dbDeleteFormador(db: Db, id: number) {
  await db.query("DELETE FROM formadores WHERE id = $1", [id]);
}

// Cursos
export async function dbGetCursos(db: Db) {
  const res = await db.query("SELECT * FROM cursos ORDER BY id DESC");
  return res.rows;
}

export async function dbCreateCurso(db: Db, b: Record<string, any>) {
  const id = b.id || (Date.now() % 100000);
  const res = await db.query(
    `INSERT INTO cursos (id, regime, nome, categoria, tipo, preco, horas, estado, ufcd_cod, ufcd, nome_comercial, site_data, parametros_avaliacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)
     RETURNING *`,
    [
      id,
      b.regime || "gold",
      b.nome || "",
      b.categoria || "",
      b.tipo || "Gold",
      b.preco || 0,
      b.horas || 0,
      b.estado || "Ativo",
      b.ufcdCod || b.ufcd_cod || "",
      b.ufcd || "",
      b.nomeComercial || b.nome_comercial || "",
      JSON.stringify(b.site_data || {}),
      JSON.stringify(b.parametros_avaliacao || []),
    ],
  );
  return res.rows[0];
}

export async function dbUpdateCurso(db: Db, id: number, b: Record<string, any>) {
  await db.query(
    `UPDATE cursos SET
       nome = COALESCE($2, nome),
       categoria = COALESCE($3, categoria),
       tipo = COALESCE($4, tipo),
       preco = COALESCE($5, preco),
       horas = COALESCE($6, horas),
       estado = COALESCE($7, estado),
       ufcd_cod = COALESCE($8, ufcd_cod),
       ufcd = COALESCE($9, ufcd),
       nome_comercial = COALESCE($10, nome_comercial),
       site_data = COALESCE($11::jsonb, site_data),
       parametros_avaliacao = COALESCE($12::jsonb, parametros_avaliacao),
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      b.nome ?? null,
      b.categoria ?? null,
      b.tipo ?? null,
      b.preco ?? null,
      b.horas ?? null,
      b.estado ?? null,
      b.ufcdCod ?? b.ufcd_cod ?? null,
      b.ufcd ?? null,
      b.nomeComercial ?? b.nome_comercial ?? null,
      b.site_data ? JSON.stringify(b.site_data) : null,
      b.parametros_avaliacao ? JSON.stringify(b.parametros_avaliacao) : null,
    ],
  );
}

export async function dbDeleteCurso(db: Db, id: number) {
  await db.query("DELETE FROM cursos WHERE id = $1", [id]);
}

// Turmas
export async function dbGetTurmas(db: Db) {
  const res = await db.query<any>("SELECT * FROM turmas ORDER BY id DESC");
  const gold = res.rows.filter(r => r.regime === "gold").map(r => ({
    id: r.id,
    dataInicio: r.data_inicio,
    nome: r.nome,
    curso: r.curso,
    local: r.local,
    horario: r.horario,
    totalAlunos: r.total_alunos,
    vagas: r.vagas,
    estado: r.estado,
    formador: r.formador,
    horas: r.horas,
    cronograma: r.cronograma,
  }));
  const fin = res.rows.filter(r => r.regime === "fin").map(r => ({
    id: r.id,
    dataInicio: r.data_inicio,
    nome: r.nome,
    curso: r.curso,
    ufcdCod: r.ufcd_cod,
    local: r.local,
    horario: r.horario,
    alunos: r.total_alunos,
    alunosTotal: r.vagas,
    estado: r.estado,
    horas: r.horas,
    formador: r.formador,
    activa: r.activa,
    cronograma: r.cronograma,
  }));
  return { gold, fin };
}

export async function dbCreateTurma(db: Db, b: Record<string, any>) {
  const id = b.id || (Date.now() % 100000);
  const regime = b.regime || "gold";
  const res = await db.query(
    `INSERT INTO turmas (id, regime, nome, curso, local, horario, data_inicio, vagas, total_alunos, estado, horas, formador, ufcd_cod, activa, cronograma)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
     RETURNING *`,
    [
      id,
      regime,
      b.nome || "",
      b.curso || "",
      b.local || "",
      b.horario || "",
      b.dataInicio || b.data_inicio || "",
      b.vagas || b.alunosTotal || 16,
      b.totalAlunos || b.alunos || 0,
      b.estado || "Ativa",
      b.horas || 25,
      b.formador || "Isac Silva",
      b.ufcdCod || b.ufcd_cod || "",
      b.activa ?? (b.estado === "Ativa"),
      JSON.stringify(b.cronograma || []),
    ],
  );
  return res.rows[0];
}

export async function dbUpdateTurma(db: Db, id: number, b: Record<string, any>) {
  await db.query(
    `UPDATE turmas SET
       nome = COALESCE($2, nome),
       curso = COALESCE($3, curso),
       local = COALESCE($4, local),
       horario = COALESCE($5, horario),
       data_inicio = COALESCE($6, data_inicio),
       vagas = COALESCE($7, vagas),
       total_alunos = COALESCE($8, total_alunos),
       estado = COALESCE($9, estado),
       horas = COALESCE($10, horas),
       formador = COALESCE($11, formador),
       ufcd_cod = COALESCE($12, ufcd_cod),
       activa = COALESCE($13, activa),
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      b.nome ?? null,
      b.curso ?? null,
      b.local ?? null,
      b.horario ?? null,
      b.dataInicio ?? b.data_inicio ?? null,
      b.vagas ?? b.alunosTotal ?? null,
      b.totalAlunos ?? b.alunos ?? null,
      b.estado ?? null,
      b.horas ?? null,
      b.formador ?? null,
      b.ufcdCod ?? b.ufcd_cod ?? null,
      b.activa ?? null,
    ],
  );
}

export async function dbUpdateTurmaCronograma(db: Db, id: number, cronograma: any[]) {
  await db.query("UPDATE turmas SET cronograma = $2::jsonb, updated_at = now() WHERE id = $1", [id, JSON.stringify(cronograma || [])]);
}

export async function dbToggleTurma(db: Db, id: number, activa: boolean) {
  await db.query(
    "UPDATE turmas SET activa = $2, estado = CASE WHEN $2 = true THEN 'Ativa' ELSE 'Inativa' END, updated_at = now() WHERE id = $1",
    [id, activa],
  );
}

export async function dbDeleteTurma(db: Db, id: number) {
  await db.query("DELETE FROM turmas WHERE id = $1", [id]);
}

// Pre-inscrições
export async function dbGetPreinscricoes(db: Db) {
  const res = await db.query<any>("SELECT * FROM preinscricoes ORDER BY id DESC");
  return res.rows.map(r => ({
    id: r.id,
    inscrito: r.inscrito,
    nome: r.nome,
    apelido: r.apelido,
    email: r.email,
    telf: r.telf,
    inicioCurso: r.inicio_curso,
    concelho: r.concelho,
    local: r.local,
    curso: r.curso,
    preco: Number(r.preco),
    estado: r.estado,
    campanha: r.campanha,
    origem: r.origem,
  }));
}

export async function dbCreatePreinscricao(db: Db, b: Record<string, any>) {
  const id = b.id || (Date.now() % 100000);
  const inscrito = b.inscrito || new Date().toISOString().replace("T", " ").slice(0, 16);
  await db.query(
    `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, inicio_curso, concelho, local, curso, preco, estado, campanha, origem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      inscrito,
      b.nome || "",
      b.apelido || "",
      b.email || "",
      b.telf || "",
      b.inicioCurso || b.inicio_curso || "",
      b.concelho || "",
      b.local || "",
      b.curso || "",
      b.preco || 0,
      b.estado || "Não contactado",
      b.campanha || "Geral",
      b.origem || "Website",
    ],
  );
  return id;
}

export async function dbUpdatePreinscricao(db: Db, id: number, b: Record<string, any>) {
  await db.query(
    `UPDATE preinscricoes SET
       nome = COALESCE($2, nome),
       apelido = COALESCE($3, apelido),
       email = COALESCE($4, email),
       telf = COALESCE($5, telf),
       inicio_curso = COALESCE($6, inicio_curso),
       concelho = COALESCE($7, concelho),
       local = COALESCE($8, local),
       curso = COALESCE($9, curso),
       preco = COALESCE($10, preco),
       estado = COALESCE($11, estado),
       campanha = COALESCE($12, campanha),
       origem = COALESCE($13, origem),
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      b.nome ?? null,
      b.apelido ?? null,
      b.email ?? null,
      b.telf ?? null,
      b.inicioCurso ?? b.inicio_curso ?? null,
      b.concelho ?? null,
      b.local ?? null,
      b.curso ?? null,
      b.preco ?? null,
      b.estado ?? null,
      b.campanha ?? null,
      b.origem ?? null,
    ],
  );
}

export async function dbDeletePreinscricao(db: Db, id: number) {
  await db.query("DELETE FROM preinscricoes WHERE id = $1", [id]);
}

// Formandos Turmas
export async function dbGetFormandosTurmas(db: Db) {
  const res = await db.query<any>("SELECT * FROM formandos_turmas ORDER BY id DESC");
  return res.rows.map(r => ({
    id: r.id,
    nome: r.nome,
    apelido: r.apelido,
    telf: r.telf,
    email: r.email,
    inscrito: r.inscrito,
    local: r.local,
    curso: r.curso,
    turma: r.turma,
    turmaId: r.turma_id,
    estado: r.estado,
    pago: r.pago,
    valor: Number(r.valor),
    metodo: r.metodo,
  }));
}

export async function dbCreateFormandoTurma(db: Db, b: Record<string, any>) {
  const id = b.id || (Date.now() % 100000);
  await db.query(
    `INSERT INTO formandos_turmas (id, nome, apelido, telf, email, inscrito, local, curso, turma, turma_id, estado, pago, valor, metodo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      b.nome || "",
      b.apelido || "",
      b.telf || "",
      b.email || "",
      b.inscrito || new Date().toISOString().replace("T", " ").slice(0, 16),
      b.local || "",
      b.curso || "",
      b.turma || "",
      b.turmaId || b.turma_id || 0,
      b.estado || "Formando",
      b.pago ?? false,
      b.valor || 0,
      b.metodo || "-",
    ],
  );
  return id;
}

export async function dbUpdateFormandoTurma(db: Db, id: number, b: Record<string, any>) {
  await db.query(
    `UPDATE formandos_turmas SET
       nome = COALESCE($2, nome),
       apelido = COALESCE($3, apelido),
       telf = COALESCE($4, telf),
       email = COALESCE($5, email),
       local = COALESCE($6, local),
       curso = COALESCE($7, curso),
       turma = COALESCE($8, turma),
       turma_id = COALESCE($9, turma_id),
       estado = COALESCE($10, estado),
       pago = COALESCE($11, pago),
       valor = COALESCE($12, valor),
       metodo = COALESCE($13, metodo),
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      b.nome ?? null,
      b.apelido ?? null,
      b.telf ?? null,
      b.email ?? null,
      b.local ?? null,
      b.curso ?? null,
      b.turma ?? null,
      b.turmaId ?? b.turma_id ?? null,
      b.estado ?? null,
      b.pago ?? null,
      b.valor ?? null,
      b.metodo ?? null,
    ],
  );
}

export async function dbDeleteFormandoTurma(db: Db, id: number) {
  await db.query("DELETE FROM formandos_turmas WHERE id = $1", [id]);
}

// Formandos Fin
export async function dbGetFormandosFin(db: Db) {
  const res = await db.query<any>("SELECT * FROM formandos_fin ORDER BY id DESC");
  return res.rows.map(r => ({
    id: r.id,
    nome: r.nome,
    apelido: r.apelido,
    turma: r.turma,
    telf: r.telf,
    email: r.email,
    curso: r.curso,
    estado: r.estado,
    cc: r.cc,
    ch: r.ch,
    cu: r.cu,
    ci: r.ci,
    ce: r.ce,
  }));
}

export async function dbCreateFormandoFin(db: Db, b: Record<string, any>) {
  const id = b.id || (Date.now() % 100000);
  await db.query(
    `INSERT INTO formandos_fin (id, nome, apelido, turma, telf, email, curso, estado, cc, ch, cu, ci, ce)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb)`,
    [
      id,
      b.nome || "",
      b.apelido || "",
      b.turma || "",
      b.telf || "",
      b.email || "",
      b.curso || "",
      b.estado || "Elegível",
      JSON.stringify(b.cc || { ok: false, data: "" }),
      JSON.stringify(b.ch || { ok: false, data: "" }),
      JSON.stringify(b.cu || { ok: false, data: "" }),
      JSON.stringify(b.ci || { ok: false, data: "" }),
      JSON.stringify(b.ce || { ok: false, data: "" }),
    ],
  );
  return id;
}

export async function dbUpdateFormandoFin(db: Db, id: number, b: Record<string, any>) {
  await db.query(
    `UPDATE formandos_fin SET
       nome = COALESCE($2, nome),
       apelido = COALESCE($3, apelido),
       turma = COALESCE($4, turma),
       telf = COALESCE($5, telf),
       email = COALESCE($6, email),
       curso = COALESCE($7, curso),
       estado = COALESCE($8, estado),
       cc = COALESCE($9::jsonb, cc),
       ch = COALESCE($10::jsonb, ch),
       cu = COALESCE($11::jsonb, cu),
       ci = COALESCE($12::jsonb, ci),
       ce = COALESCE($13::jsonb, ce),
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      b.nome ?? null,
      b.apelido ?? null,
      b.turma ?? null,
      b.telf ?? null,
      b.email ?? null,
      b.curso ?? null,
      b.estado ?? null,
      b.cc ? JSON.stringify(b.cc) : null,
      b.ch ? JSON.stringify(b.ch) : null,
      b.cu ? JSON.stringify(b.cu) : null,
      b.ci ? JSON.stringify(b.ci) : null,
      b.ce ? JSON.stringify(b.ce) : null,
    ],
  );
}

export async function dbDeleteFormandoFin(db: Db, id: number) {
  await db.query("DELETE FROM formandos_fin WHERE id = $1", [id]);
}

// Transações
export async function dbGetTransacoes(db: Db) {
  const res = await db.query<any>("SELECT * FROM transacoes ORDER BY created_at DESC");
  return res.rows.map(r => ({
    id: r.id,
    nome: r.nome,
    valor: Number(r.valor),
    metodo: r.metodo,
    curso: r.curso,
    data: r.data,
    estado: r.estado,
  }));
}

export async function dbCreateTransacao(db: Db, b: Record<string, any>) {
  const id = b.id || `TRX-${Date.now() % 100000}`;
  const data = b.data || new Date().toISOString().replace("T", " ").slice(0, 16);
  await db.query(
    "INSERT INTO transacoes (id, nome, valor, metodo, curso, data, estado) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [id, b.nome || "", b.valor || 0, b.metodo || "MB Way", b.curso || "", data, b.estado || "Pago"],
  );
  return id;
}

export async function dbUpdateTransacao(db: Db, id: string, b: Record<string, any>) {
  await db.query(
    `UPDATE transacoes SET
       nome = COALESCE($2, nome),
       valor = COALESCE($3, valor),
       metodo = COALESCE($4, metodo),
       curso = COALESCE($5, curso),
       estado = COALESCE($6, estado)
     WHERE id = $1`,
    [id, b.nome ?? null, b.valor ?? null, b.metodo ?? null, b.curso ?? null, b.estado ?? null],
  );
}

// DTP
export async function dbGetDtp(db: Db, turmaId: number) {
  const res = await db.query<any>("SELECT * FROM dtp_turmas WHERE turma_id = $1", [turmaId]);
  return res.rows[0] ?? null;
}

export async function dbSaveDtp(db: Db, turmaId: number, b: Record<string, any>) {
  await db.query(
    `INSERT INTO dtp_turmas (turma_id, regime, pip_items, sim_items, documentos, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, now())
     ON CONFLICT (turma_id) DO UPDATE SET
       pip_items = COALESCE($3::jsonb, dtp_turmas.pip_items),
       sim_items = COALESCE($4::jsonb, dtp_turmas.sim_items),
       documentos = COALESCE($5::jsonb, dtp_turmas.documentos),
       updated_at = now()`,
    [
      turmaId,
      b.regime || "gold",
      b.pip_items ? JSON.stringify(b.pip_items) : null,
      b.sim_items ? JSON.stringify(b.sim_items) : null,
      b.documentos ? JSON.stringify(b.documentos) : null,
    ],
  );
}

// Catálogo
export async function dbGetCatalogo(db: Db, tipo: string) {
  const res = await db.query<any>("SELECT id, data FROM catalogo_items WHERE tipo = $1 ORDER BY id ASC", [tipo]);
  return res.rows.map(r => ({ id: r.id, ...(typeof r.data === "object" ? r.data : {}) }));
}

export async function dbCreateCatalogo(db: Db, tipo: string, data: Record<string, any>) {
  const res = await db.query<any>(
    "INSERT INTO catalogo_items (tipo, data) VALUES ($1, $2::jsonb) RETURNING id, data",
    [tipo, JSON.stringify(data)],
  );
  return { id: res.rows[0].id, ...(data || {}) };
}

export async function dbDeleteCatalogo(db: Db, id: number) {
  await db.query("DELETE FROM catalogo_items WHERE id = $1", [id]);
}

// Notificações
export async function dbGetNotificacoes(db: Db) {
  const res = await db.query<any>("SELECT * FROM notificacoes ORDER BY id DESC LIMIT 50");
  return res.rows.map(r => ({
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    texto: r.texto,
    tempo: r.tempo,
    lida: r.lida,
    view: r.view,
    turmaId: r.turma_id,
    tab: r.tab,
  }));
}

export async function dbMarcarNotificacaoLida(db: Db, id: number) {
  await db.query("UPDATE notificacoes SET lida = true WHERE id = $1", [id]);
}

export async function dbMarcarTodasNotificacoesLidas(db: Db) {
  await db.query("UPDATE notificacoes SET lida = true");
}

// Configurações
export async function dbGetConfiguracoes(db: Db) {
  const res = await db.query<{ id: string; dados: any }>("SELECT id, dados FROM configuracoes");
  const out: Record<string, any> = {};
  for (const row of res.rows) {
    out[row.id] = row.dados;
  }
  return out;
}

export async function dbSaveConfiguracao(db: Db, id: string, dados: Record<string, any>) {
  await db.query(
    `INSERT INTO configuracoes (id, dados, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET dados = $2::jsonb, updated_at = now()`,
    [id, JSON.stringify(dados || {})],
  );
}

// Inquéritos
export async function dbGetInqueritos(db: Db) {
  const res = await db.query("SELECT * FROM inqueritos ORDER BY id ASC");
  return res.rows;
}

export async function dbCreateInquerito(db: Db, b: Record<string, any>) {
  const res = await db.query(
    `INSERT INTO inqueritos (regime, titulo, perguntas, respostas, ativo)
     VALUES ($1, $2, $3::jsonb, '[]'::jsonb, $4)
     RETURNING *`,
    [b.regime || "gold", b.titulo || "Inquérito de Satisfação", JSON.stringify(b.perguntas || []), b.ativo ?? true],
  );
  return res.rows[0];
}

export async function dbResponderInquerito(db: Db, id: number, respostas: any[]) {
  const row = await db.query<{ respostas: any[] }>("SELECT respostas FROM inqueritos WHERE id = $1", [id]);
  if (!row.rows[0]) throw new Error("inquérito não encontrado");
  const curr = Array.isArray(row.rows[0].respostas) ? row.rows[0].respostas : [];
  curr.push({ data: new Date().toISOString(), respostas: respostas || [] });
  await db.query("UPDATE inqueritos SET respostas = $2::jsonb WHERE id = $1", [id, JSON.stringify(curr)]);
}

// Ficheiros
export async function dbSaveFicheiro(db: Db, f: {
  id: string;
  nome: string;
  mimeType: string;
  tamanho: number;
  base64: string;
  contexto?: string;
  referenciaId?: string;
}) {
  await db.query(
    `INSERT INTO ficheiros (id, nome, mime_type, tamanho, base64_data, contexto, referencia_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [f.id, f.nome, f.mimeType, f.tamanho, f.base64, f.contexto || "", f.referenciaId || ""],
  );
}

export async function dbGetFicheiro(db: Db, id: string) {
  const res = await db.query<{ id: string; nome: string; mime_type: string; tamanho: number; base64_data: string }>(
    "SELECT id, nome, mime_type, tamanho, base64_data FROM ficheiros WHERE id = $1",
    [id],
  );
  return res.rows[0] ?? null;
}

// Exportações
export async function dbGetTurmaForExport(db: Db, turmaId: number) {
  const tRow = await db.query<any>("SELECT * FROM turmas WHERE id = $1", [turmaId]);
  const turma = tRow.rows[0];
  if (!turma) return null;
  const fRows = await db.query<any>(
    "SELECT nome, apelido, email, telf, estado, pago, valor, metodo FROM formandos_turmas WHERE turma_id = $1 OR turma = $2 ORDER BY id ASC",
    [turmaId, turma.nome],
  );
  const dtpRow = await db.query<any>("SELECT * FROM dtp_turmas WHERE turma_id = $1", [turmaId]);
  return { turma, formandos: fRows.rows, dtp: dtpRow.rows[0] ?? null };
}

// Auditoria
export async function dbInsertAuditLog(
  db: Db,
  actorId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  ip?: string,
  meta: Record<string, unknown> = {},
) {
  await db.query(
    "INSERT INTO audit_log (actor_id, action, entity, entity_id, ip, meta) VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
    [actorId ?? null, action, entity, entityId ?? null, ip ?? null, JSON.stringify(meta)],
  );
}

// Autenticação e Sessões
export async function dbGetSessionUser(db: Db, tokenHash: string) {
  const res = await db.query<{ id: string; email: string; name: string; role: string }>(
    `SELECT u.id, u.email, u.name, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true`,
    [tokenHash],
  );
  return res.rows[0] ?? null;
}

export async function dbGetUserByEmail(db: Db, email: string) {
  const res = await db.query<{ id: string; password_hash: string; name: string; role: string; active: boolean }>(
    "SELECT id, password_hash, name, role, active FROM users WHERE email = $1",
    [email],
  );
  return res.rows[0] ?? null;
}

export async function dbCreateSession(
  db: Db,
  session: { id: string; userId: string; tokenHash: string; expiresAt: string; ip?: string; userAgent?: string },
) {
  await db.query(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)",
    [session.id, session.userId, session.tokenHash, session.expiresAt, session.ip ?? null, session.userAgent ?? ""],
  );
}

export async function dbDeleteSession(db: Db, tokenHash: string) {
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
}

// Templates de Email
export async function dbGetEmailTemplates(db: Db) {
  const res = await db.query(
    "SELECT id, tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito, updated_at FROM email_templates ORDER BY id",
  );
  return res.rows;
}

export async function dbUpdateEmailTemplate(
  db: Db,
  id: number,
  patch: {
    nome?: string;
    assunto?: string;
    body_lines?: any;
    cta?: string;
    body_xml?: string;
    cta_href?: string;
    cta_ambito?: string;
  },
) {
  await db.query(
    `UPDATE email_templates SET
       nome = COALESCE($2, nome),
       assunto = COALESCE($3, assunto),
       body_lines = COALESCE($4::jsonb, body_lines),
       cta = COALESCE($5, cta),
       body_xml = COALESCE($6, body_xml),
       cta_href = COALESCE($7, cta_href),
       cta_ambito = COALESCE($8, cta_ambito),
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      patch.nome ?? null,
      patch.assunto ?? null,
      patch.body_lines ? JSON.stringify(patch.body_lines) : null,
      patch.cta ?? null,
      patch.body_xml ?? null,
      patch.cta_href ?? null,
      patch.cta_ambito ?? null,
    ],
  );
}

export async function dbGetEmailTemplateById(db: Db, id: number) {
  const res = await db.query(
    "SELECT id, tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito, updated_at FROM email_templates WHERE id = $1",
    [id],
  );
  return res.rows[0] ?? null;
}

export async function dbGetEmailTemplateByTipo(db: Db, tipo: string) {
  const res = await db.query<{ tipo: string }>("SELECT tipo FROM email_templates WHERE tipo = $1", [tipo]);
  return res.rows[0] ?? null;
}

// Regras de Email
export async function dbGetEmailRules(db: Db) {
  const res = await db.query<{
    id: number;
    nome: string;
    gatilho_label: string;
    template_tipo: string;
    delay_seconds: number;
    curso: string | null;
    ativo: boolean;
    envios: number;
  }>(
    `SELECT r.id, r.nome, r.gatilho_label, r.template_tipo, r.delay_seconds, r.curso, r.ativo,
            (SELECT count(*)::int FROM email_jobs j WHERE j.rule_id = r.id AND j.status = 'sent') AS envios
     FROM email_rules r ORDER BY r.id`,
  );
  return res.rows;
}

export async function dbCreateEmailRule(
  db: Db,
  rule: {
    nome: string;
    triggerKey: string;
    gatilhoLabel: string;
    templateTipo: string;
    delaySeconds: number;
    curso: string | null;
    ativo: boolean;
  },
) {
  const res = await db.query<{ id: number }>(
    `INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      rule.nome,
      rule.triggerKey,
      rule.gatilhoLabel,
      rule.templateTipo,
      rule.delaySeconds,
      rule.curso,
      rule.ativo,
    ],
  );
  return res.rows[0];
}

export async function dbUpdateEmailRule(
  db: Db,
  id: number,
  update: {
    nome?: string | null;
    gatilhoLabel?: string | null;
    triggerKey?: string | null;
    templateTipo?: string | null;
    delaySeconds?: number | null;
    curso?: string | null;
    ativo?: boolean | null;
  },
) {
  await db.query(
    `UPDATE email_rules SET
       nome = COALESCE($2, nome),
       gatilho_label = COALESCE($3, gatilho_label),
       trigger_key = COALESCE($4, trigger_key),
       template_tipo = COALESCE($5, template_tipo),
       delay_seconds = COALESCE($6, delay_seconds),
       curso = COALESCE($7, curso),
       ativo = COALESCE($8, ativo)
     WHERE id = $1`,
    [
      id,
      update.nome ?? null,
      update.gatilhoLabel ?? null,
      update.triggerKey ?? null,
      update.templateTipo ?? null,
      update.delaySeconds ?? null,
      update.curso,
      update.ativo ?? null,
    ],
  );
}

export async function dbDeleteEmailRule(db: Db, id: number) {
  await db.query("DELETE FROM email_rules WHERE id = $1", [id]);
}

// Jobs de Email
export async function dbGetEmailJobStats(db: Db) {
  const res = await db.query<{ sent: number; queued: number; failed: number }>(
    `SELECT
       count(*) FILTER (WHERE status = 'sent')::int AS sent,
       count(*) FILTER (WHERE status = 'queued')::int AS queued,
       count(*) FILTER (WHERE status = 'failed')::int AS failed
     FROM email_jobs
     WHERE created_at >= now() - interval '30 days'`,
  );
  return res.rows[0] ?? { sent: 0, queued: 0, failed: 0 };
}

export async function dbGetEmailJobs(db: Db, limit = 80) {
  const res = await db.query(
    `SELECT j.id, j.to_email, j.to_name, j.subject, j.status, j.scheduled_at, j.sent_at, j.last_error, r.nome AS regra
     FROM email_jobs j
     JOIN email_rules r ON r.id = j.rule_id
     ORDER BY coalesce(j.sent_at, j.scheduled_at) DESC
     LIMIT $1`,
    [limit],
  );
  return res.rows;
}

