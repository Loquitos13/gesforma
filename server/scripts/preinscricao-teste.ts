/**
 * Pré-inscrição de TESTE da Financiada, completa e sem turma: o formulário do site, a morada, a identificação e os
 * termos da ligação pessoal, um PDF de teste em cada documento pedido e o percurso concluído. Fica na fila
 * «Na secretaria», pronta para rever os documentos e validar (é aí que se escolhe a turma).
 *
 * Corre dentro do contentor da API (monta a API no próprio processo, sobre a mesma base):
 *   docker compose exec api npx tsx scripts/preinscricao-teste.ts ["Nome do curso financiado"] [email]
 * Sem curso, usa o primeiro curso financiado publicado no site. Sem email, usa um @example.com (não recebe nada).
 * Para apagar depois: Pré-inscrições › a ficha › Desistiu (ou eliminar).
 */
import "../src/env.js";
import { buildApp } from "../src/app.js";
import { createDb } from "../src/db/pool.js";

const db = await createDb();
const app = await buildApp(db, { worker: false });
const [cursoArg, emailArg] = process.argv.slice(2);
const marca = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const email = (emailArg || `preinscricao.teste+${marca}@example.com`).toLowerCase();

// PDF mínimo válido (os uploads confirmam que o conteúdo é mesmo um PDF).
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

async function pedido(metodo: "GET" | "POST", caminho: string, corpo?: unknown) {
  const r = await app.inject({ method: metodo, url: caminho, ...(corpo ? { payload: corpo as object } : {}) });
  if (r.statusCode >= 400) throw new Error(`${metodo} ${caminho} → ${r.statusCode} ${r.body.slice(0, 300)}`);
  return r.body ? r.json() : null;
}

async function enviarDocumento(token: string, tipo: string) {
  const fronteira = "----gesforma-teste";
  const payload = Buffer.concat([
    Buffer.from(`--${fronteira}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\n${tipo}\r\n`),
    Buffer.from(`--${fronteira}\r\nContent-Disposition: form-data; name="ficheiro"; filename="${tipo}-teste.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    PDF,
    Buffer.from(`\r\n--${fronteira}--\r\n`),
  ]);
  const r = await app.inject({ method: "POST", url: `/v1/public/documentos/${token}`, payload, headers: { "content-type": `multipart/form-data; boundary=${fronteira}` } });
  if (r.statusCode >= 400) throw new Error(`documento ${tipo} → ${r.statusCode} ${r.body.slice(0, 300)}`);
}

const catalogo = await pedido("GET", "/v1/public/catalogo") as { cursos: { titulo: string; regime: string; nomeOferta?: string }[] };
const fin = catalogo.cursos.filter(c => c.regime === "fin");
const curso = cursoArg
  ? fin.find(c => [c.titulo, c.nomeOferta].some(n => n?.toLowerCase() === cursoArg.toLowerCase()))
  : fin[0];
if (!curso) throw new Error(cursoArg ? `Curso financiado «${cursoArg}» não está publicado no site.` : "Não há cursos financiados publicados no site.");

await pedido("POST", "/v1/public/preinscricoes", {
  nome: "Teste", apelido: `Pré-inscrição ${marca}`, email, telf: "912345678", curso: curso.nomeOferta || curso.titulo, regime: "fin",
  consentimento: true, origem: "Website",
  dadosFin: { nomeCompleto: `Teste Pré-inscrição ${marca}`, genero: "2 - Mulheres", dataNascimento: "1990-05-17", nacionalidade: "191 - Portugal", habilitacoes: "12.º Ano" },
});

const linha = (await db.query<{ id: number; docs_token: string }>(
  "SELECT id, docs_token FROM preinscricoes WHERE lower(email) = $1 ORDER BY id DESC LIMIT 1", [email])).rows[0];
if (!linha?.docs_token) throw new Error("A pré-inscrição não ficou gravada.");
const token = linha.docs_token;

const validade = `${new Date().getFullYear() + 5}-06-30`;
await pedido("POST", `/v1/public/documentos/${token}/dados/morada`, { morada: "Rua de Teste, 1", localidade: "Porto", codigoPostal: "4000-123", concelho: "Porto" });
await pedido("POST", `/v1/public/documentos/${token}/dados/identificacao`, {
  tipoDocumento: "Cartão de Cidadão", numeroDocumento: "12345678 0 zz0", validadeDocumento: validade, nif: "123456789", niss: "12345678901",
  iban: "PT50000201231234567890154", situacaoEmprego: "Trabalhador(a) por conta de outrem", nifEntidadeEmpregadora: "509999999",
});
await pedido("POST", `/v1/public/documentos/${token}/dados/termos`, { termos: true, dados: true });

const vista = await pedido("GET", `/v1/public/documentos/${token}`) as { tipos?: { id: string; label: string; required?: boolean }[] };
for (const t of vista.tipos ?? []) await enviarDocumento(token, t.id);
await pedido("POST", `/v1/public/documentos/${token}/concluir`);

console.log(`Pré-inscrição de teste #${linha.id} criada: ${curso.titulo} · ${email}`);
console.log(`Documentos enviados: ${(vista.tipos ?? []).map(t => t.label).join(", ") || "nenhum pedido"}. Sem turma: escolhe-se ao validar.`);
await app.close();
await db.close();
process.exit(0);
