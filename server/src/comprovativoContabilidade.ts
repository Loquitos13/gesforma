/**
 * Comprovativo de pagamento recebido na ligação pessoal: segue para a contabilidade (Configurações › Entidade ›
 * Email da contabilidade) com o nome, NIF, telemóvel, email e IBAN da pessoa e o ficheiro em anexo.
 * Modelo editável «comprovativo_contabilidade». Sem email da contabilidade, não sai nada.
 */
import type { Db } from "./db/pool.js";
import { enviarModelo } from "./emailModelo.js";
import { lerEntidade } from "./regrasConfig.js";
import * as pags from "./repos/pagamentosLead.js";
import { isEmail } from "./security.js";

const fmtEuros = (v: number) => v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ou = (v: unknown) => String(v ?? "").trim() || "—";

export async function enviarComprovativoContabilidade(
  db: Db,
  lead: Record<string, unknown>,
  ficheiro: { nome: string; mime: string; bytes: Buffer },
) {
  const ent = await lerEntidade(db);
  const para = ent.emailContabilidade.trim();
  if (!isEmail(para)) return false;
  const pag = lead.pagamento_id ? await pags.pagamento(db, String(lead.pagamento_id)) : null;
  const valor = Number(pag?.valor ?? lead.preco) || 0;
  const nome = `${lead.nome ?? ""} ${lead.apelido ?? ""}`.replace(/\s+/g, " ").trim();
  const linhas = [
    "Chegou um comprovativo de pagamento (em anexo).",
    "Nome: {{nome_formando}}<br>NIF: {{nif}}<br>Telemóvel: {{telemovel}}<br>Email: {{email_formando}}<br>IBAN: {{iban_formando}}",
    "Curso: {{curso}}<br>Valor: € {{valor}}",
    "Conta de destino: {{iban}}",
  ];
  await enviarModelo(db, {
    tipo: "comprovativo_contabilidade", area: "contabilidade", para, nome: "Contabilidade",
    vars: {
      nome_formando: nome || "—", nif: ou(lead.nif), telemovel: ou(lead.telf), email_formando: ou(lead.email),
      iban_formando: ou(lead.iban), curso: ou(lead.curso), valor: fmtEuros(valor),
      iban: ent.iban.replace(/(.{4})/g, "$1 ").trim() || "—",
    },
    reserva: { assunto: "Comprovativo de pagamento · {{nome_formando}} · {{curso}}", linhas },
    anexos: [{ nome: ficheiro.nome, tipo: ficheiro.mime || "application/octet-stream", conteudo: ficheiro.bytes }],
  });
  return true;
}
