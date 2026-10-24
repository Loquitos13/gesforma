// Auditoria das turmas e da pedagogia: isolamento entre formadores, dados das sessões pelo id,
// PDFs do dossiê sem cópias repetidas no Drive e regra de elegibilidade única nos PDFs gerados.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { naPosicaoActual, type SessaoCronograma } from "../../src/partilhado/turmaModel.js";
import { arrancar, pedido, type Ctx } from "./helpers.js";

let seq = 0;
const unico = (p: string) => `${p} ${Date.now()}-${++seq}`;

const sessao = (id: string, data: string, formadores: string[]) => ({
  id, data, horaInicio: "09:00", horaFim: "13:00", modalidade: "presencial", formadores,
});

/** Ficha de formador (nos dois regimes) ligada à conta de teste "formador" pelo email. */
async function fichaDoFormador(ctx: Ctx) {
  const conta = await ctx.db.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [ctx.userId.formador]);
  // Uma conta liga-se a uma só ficha: a ficha do teste anterior deixa de ser desta conta.
  await ctx.db.query("UPDATE formadores SET user_id = NULL, email = '' WHERE user_id = $1", [ctx.userId.formador]);
  const nome = unico("Formador Eu");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome, email: conta.rows[0]!.email, regimes: ["gold", "fin"] });
  expect(r.statusCode, r.body).toBe(200);
  return nome;
}

async function outroFormador(ctx: Ctx) {
  const nome = unico("Outro Formador");
  const r = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome, email: `outro.${Date.now()}.${++seq}@exemplo.pt`, regimes: ["gold", "fin"] });
  expect(r.statusCode, r.body).toBe(200);
  return { nome, id: Number(r.json().formador?.id ?? r.json().id) };
}

async function turma(ctx: Ctx, regime: "gold" | "fin", nome: string, cronograma: unknown[]) {
  const r = regime === "gold"
    ? await pedido(ctx, "secretaria", "POST", "/v1/turmas-gold", { dataInicio: "2099-06-01", nome, curso: "Curso Sem Ficha", vagas: 10, cronograma })
    : await pedido(ctx, "secretaria", "POST", "/v1/turmas-fin", { dataInicio: "2099-06-01", nome, curso: "UFCD Teste", horas: 8, cronograma });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().turma.id as number;
}

describe("o formador não vê as turmas nem os dados de outro formador", () => {
  it("listas, turma, pedagogia, notas, resultados, horas, pesquisa e relatórios, nos dois regimes", async () => {
    const ctx = await arrancar();
    const eu = await fichaDoFormador(ctx);
    const outro = await outroFormador(ctx);
    const prefixo = unico("ISO");
    const ids = {
      gold: {
        minha: await turma(ctx, "gold", `${prefixo} GM`, [sessao("gm1", "2099-06-01", [eu]), sessao("gm2", "2099-06-02", [outro.nome])]),
        alheia: await turma(ctx, "gold", `${prefixo} GA`, [sessao("ga1", "2099-06-03", [outro.nome])]),
      },
      fin: {
        minha: await turma(ctx, "fin", `${prefixo} FM`, [sessao("fm1", "2099-06-04", [eu])]),
        alheia: await turma(ctx, "fin", `${prefixo} FA`, [sessao("fa1", "2099-06-05", [outro.nome])]),
      },
    };

    for (const regime of ["gold", "fin"] as const) {
      const { minha, alheia } = ids[regime];
      // Lista: só as suas, também quando procura pelo nome da outra.
      const lista = await pedido(ctx, "formador", "GET", `/v1/turmas?regime=${regime}&q=${encodeURIComponent(prefixo)}`);
      expect(lista.statusCode, lista.body).toBe(200);
      const vistas = (lista.json().linhas as { id: number }[]).map(l => l.id);
      expect(vistas, regime).toContain(minha);
      expect(vistas, regime).not.toContain(alheia);
      // A equipa vê as duas (o filtro é do formador, não da pesquisa).
      const daEquipa = (await pedido(ctx, "admin", "GET", `/v1/turmas?regime=${regime}&q=${encodeURIComponent(prefixo)}`)).json().linhas as { id: number }[];
      expect(daEquipa.map(l => l.id)).toEqual(expect.arrayContaining([minha, alheia]));

      const base = `/v1/turmas/${regime}/${alheia}`;
      for (const url of [base, `${base}/pedagogia`, `${base}/avaliacao`, `${base}/resultados`]) {
        expect((await pedido(ctx, "formador", "GET", url)).statusCode, url).toBe(403);
      }
      for (const url of [`/v1/turmas/${regime}/${minha}`, `/v1/turmas/${regime}/${minha}/pedagogia`, `/v1/turmas/${regime}/${minha}/resultados`]) {
        expect((await pedido(ctx, "formador", "GET", url)).statusCode, url).toBe(200);
      }
      // Nem a lista de turmas de onde copiar planos.
      expect((await pedido(ctx, "formador", "GET", `/v1/turmas/${regime}/${minha}/planos/origens`)).statusCode).toBe(403);
    }

    // Relatórios e PDFs do dossiê da Financiada: nem da sua turma, muito menos da alheia.
    for (const url of [`/v1/turmas/fin/${ids.fin.alheia}/relatorio-final`, `/v1/turmas/fin/${ids.fin.alheia}/dossie/listagem-formandos`]) {
      expect((await pedido(ctx, "formador", "GET", url)).statusCode, url).toBe(403);
    }

    // Pesquisa global: só encontra as suas turmas.
    const pesquisa = await pedido(ctx, "formador", "GET", `/v1/search?q=${encodeURIComponent(prefixo)}`);
    expect(pesquisa.statusCode, pesquisa.body).toBe(200);
    const achadas = (pesquisa.json().groups as { items: { turmaId?: number }[] }[]).flatMap(g => g.items.map(i => i.turmaId));
    expect(achadas).not.toContain(ids.gold.alheia);
    expect(achadas).not.toContain(ids.fin.alheia);
  });

  it("não lê a ficha, os documentos nem a ocupação de outro formador", async () => {
    const ctx = await arrancar();
    await fichaDoFormador(ctx);
    const outro = await outroFormador(ctx);
    expect(outro.id).toBeGreaterThan(0);
    expect((await pedido(ctx, "formador", "GET", "/v1/formadores?regime=gold")).statusCode).toBe(403);
    for (const url of [`/v1/formadores/${outro.id}`, `/v1/formadores/${outro.id}/docs`, `/v1/formadores/${outro.id}/ocupacao?de=2099-01-01&ate=2099-12-31`]) {
      expect((await pedido(ctx, "formador", "GET", url)).statusCode, url).toBe(403);
    }
  });

  it("ficheiros de turma: só os das suas turmas", async () => {
    const ctx = await arrancar();
    const eu = await fichaDoFormador(ctx);
    const outro = await outroFormador(ctx);
    const minhaNome = unico("DRV Minha");
    const alheiaNome = unico("DRV Alheia");
    await turma(ctx, "gold", minhaNome, [sessao("dm1", "2099-07-01", [eu])]);
    await turma(ctx, "gold", alheiaNome, [sessao("da1", "2099-07-02", [outro.nome])]);
    const ficheiro = async (turmaNome: string) => {
      const id = randomUUID().replace(/-/g, "");
      await ctx.db.query(
        `INSERT INTO drive_files (id, name, mime_type, size_bytes, kind, regime, turma, stored_in, local_path, created_by)
         VALUES ($1, 'material.pdf', 'application/pdf', 1, 'documento', 'gold', $2, 'local', $3, $4)`,
        [id, turmaNome, `${id}-material.pdf`, ctx.userId.secretaria],
      );
      return id;
    };
    const meu = await ficheiro(minhaNome);
    const alheio = await ficheiro(alheiaNome);
    expect((await pedido(ctx, "formador", "GET", `/v1/drive/files/${meu}`)).statusCode).toBe(200);
    expect((await pedido(ctx, "formador", "GET", `/v1/drive/files/${alheio}`)).statusCode).toBe(404);
    expect((await pedido(ctx, "formador", "GET", `/v1/drive/files/${alheio}/content`)).statusCode).toBe(404);
    const lista = await pedido(ctx, "formador", "GET", `/v1/drive/files?regime=gold&turma=${encodeURIComponent(alheiaNome)}`);
    expect(lista.statusCode, lista.body).toBe(200);
    expect(lista.json().files).toEqual([]);
    const minha = await pedido(ctx, "formador", "GET", `/v1/drive/files?regime=gold&turma=${encodeURIComponent(minhaNome)}`);
    expect((minha.json().files as { id: string }[]).map(f => f.id)).toEqual([meu]);
  });
});

describe("dados das sessões no ecrã seguem o id da sessão", () => {
  it("depois de mexer na grelha, cada sumário fica na posição actual da sua sessão", () => {
    const s = (id: string, data: string, modalidade: SessaoCronograma["modalidade"] = "presencial"): SessaoCronograma =>
      ({ id, data, horaInicio: "09:00", horaFim: "13:00", modulos: [], formadores: [], modalidade });
    // O servidor leu s1 na posição 1 e s2 na 2; a grelha trocou-as e pôs um e-learning pelo meio.
    const lidas = [
      { n: 1, sessaoId: "s1", sumario: "da s1" },
      { n: 2, sessaoId: "s2", sumario: "da s2" },
      { n: 3, sessaoId: "s3", sumario: "da s3" },
      { n: 4, sessaoId: null, sumario: "antiga sem id" },
    ];
    const grelha = [s("s2", "2099-01-05"), s("x", "2099-01-06", "auto"), s("s1", "2099-01-07")];
    expect(naPosicaoActual(lidas, grelha).map(l => [l.n, l.sumario])).toEqual([
      [2, "da s1"], [1, "da s2"], [4, "antiga sem id"],
    ]);
  });
});

describe("PDFs gerados do dossiê no Drive", () => {
  it("gerar de novo sem mudanças reutiliza o ficheiro; com mudanças substitui-o", async () => {
    const ctx = await arrancar();
    const nome = unico("FIN-REUSO");
    const id = await turma(ctx, "fin", nome, [sessao("r1", "2099-10-05", [])]);
    const ligado = async () => (await ctx.db.query<{ drive_file_id: string }>(
      "SELECT drive_file_id FROM dtp_anexos WHERE regime = 'fin' AND turma_id = $1 AND item_id = 'listagem-formandos'", [id])).rows[0]?.drive_file_id;
    const quantos = async () => (await ctx.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM drive_files WHERE turma = $1 AND label = 'listagem-formandos'", [nome])).rows[0]!.n;
    const url = `/v1/turmas/fin/${id}/dossie/listagem-formandos`;

    expect((await pedido(ctx, "secretaria", "GET", url)).statusCode).toBe(200);
    const primeiro = await ligado();
    expect(primeiro).toBeTruthy();
    expect((await pedido(ctx, "secretaria", "GET", url)).statusCode).toBe(200);
    expect(await ligado()).toBe(primeiro);
    expect(await quantos()).toBe(1);

    // O local entra no cabeçalho: o PDF muda, guarda-se um novo e o anterior sai.
    expect((await pedido(ctx, "secretaria", "PATCH", `/v1/turmas-fin/${id}`, { local: "Porto" })).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "GET", url)).statusCode).toBe(200);
    expect(await ligado()).not.toBe(primeiro);
    expect(await quantos()).toBe(1);
  });

  it("os PDFs das sessões (cronograma, folhas, planos) não se duplicam ao gerar outra vez", async () => {
    const ctx = await arrancar();
    const nome = unico("GOLD-PDFS");
    const id = await turma(ctx, "gold", nome, [sessao("p1", "2099-10-06", [])]);
    const ficheiros = async () => (await ctx.db.query<{ id: string }>(
      "SELECT id FROM drive_files WHERE turma = $1 AND kind = 'dtp' ORDER BY id", [nome])).rows.map(r => r.id);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${id}/dtp/pdfs`)).statusCode).toBe(200);
    const antes = await ficheiros();
    expect(antes.length).toBe(3);
    expect((await pedido(ctx, "secretaria", "POST", `/v1/turmas/gold/${id}/dtp/pdfs`)).statusCode).toBe(200);
    expect(await ficheiros()).toEqual(antes);
  });
});

describe("elegibilidade nos PDFs do dossiê", () => {
  it("o comprovativo de entrega usa a regra e os mínimos do cálculo dos resultados", async () => {
    const ctx = await arrancar();
    const id = await turma(ctx, "fin", unico("FIN-REGRA"), [sessao("e1", "2099-10-07", [])]);
    const res = await pedido(ctx, "secretaria", "GET", `/v1/turmas/fin/${id}/resultados`);
    expect(res.statusCode, res.body).toBe(200);
    const { regras } = res.json() as { regras: { assiduidadeMinFin: number; elearningMin: number } };
    const pdf = await pedido(ctx, "secretaria", "GET", `/v1/turmas/fin/${id}/dossie/entrega-certificados`);
    expect(pdf.statusCode).toBe(200);
    // Texto como um leitor de PDF o extrai; as linhas juntam-se para ler a frase mesmo quando parte em duas.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf.rawPayload), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
    let texto = "";
    for (let i = 1; i <= doc.numPages; i++) texto += " " + (await (await doc.getPage(i)).getTextContent()).items.map(it => ("str" in it ? it.str : "")).join(" ");
    await doc.destroy();
    texto = texto.replace(/\s+/g, " ");
    expect(texto).toContain(`Elegível: ${regras.assiduidadeMinFin}% de assiduidade`);
    expect(texto).toContain(`e-learning de pelo menos ${regras.elearningMin}`);
  });
});
