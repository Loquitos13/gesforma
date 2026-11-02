import { describe, expect, it } from "vitest";
import { montarModelo } from "../src/emailModelo.js";
import { arrancar } from "./helpers.js";

const NOVOS = [
  "acesso_formando_pago", "acesso_formando", "pedido_pagamento", "pedido_pagamento_formando", "comprovativo_recusado",
  "turma_cheia", "documentos_em_falta", "lembrete_turma", "lembrete_docs_fin_inicio", "plano_aprovado", "plano_devolvido",
  "inquerito_turma", "pedido_proposta",
];

describe("emails automáticos com modelo editável", () => {
  it("os modelos novos existem; o texto editado é o que sai; sem modelo sai o texto de reserva", async () => {
    const ctx = await arrancar();
    const r = await ctx.db.query<{ tipo: string }>("SELECT tipo FROM email_templates WHERE tipo = ANY($1::text[])", [`{${NOVOS.join(",")}}`]);
    expect(r.rows.map(x => x.tipo).sort()).toEqual([...NOVOS].sort());

    const envio = {
      tipo: "comprovativo_recusado", nome: "Ana Silva", email: "ana@exemplo.pt", link: "https://ena.pt/x",
      vars: { curso: "CCP", motivo: "ilegível" },
      reserva: { assunto: "Reserva · {{curso}}", linhas: ["Texto de reserva: {{motivo}}"], cta: "Abrir" },
    };
    const deOrigem = await montarModelo(ctx.db, envio);
    expect(deOrigem.subject).toBe("Comprovativo de pagamento · CCP");
    expect(deOrigem.text).toContain("Motivo: ilegível");
    expect(deOrigem.html).toContain('href="https://ena.pt/x"');

    await ctx.db.query("UPDATE email_templates SET assunto = 'Novo assunto {{curso}}' WHERE tipo = 'comprovativo_recusado'");
    expect((await montarModelo(ctx.db, envio)).subject).toBe("Novo assunto CCP");

    await ctx.db.query("DELETE FROM email_templates WHERE tipo = 'comprovativo_recusado'");
    const reserva = await montarModelo(ctx.db, envio);
    expect(reserva.subject).toBe("Reserva · CCP");
    expect(reserva.text).toContain("Texto de reserva: ilegível");
  });

  it("um parágrafo que fica vazio (ex.: sem palavra-passe nova) não sai", async () => {
    const ctx = await arrancar();
    const m = await montarModelo(ctx.db, {
      tipo: "plano_aprovado", nome: "Rui", link: "https://ena.pt/p",
      vars: { curso: "CCP", turma: "T1", sessao: "3", data_sessao: "", revisto_por: "", comentario_itens: [] },
      reserva: { assunto: "", linhas: [] },
    });
    expect(m.subject).toBe("Plano de sessão aprovado · T1 · sessão 3");
    expect(m.text).not.toContain("Comentários");
  });
});
