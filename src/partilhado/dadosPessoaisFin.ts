// Dados pessoais da formação financiada, pedidos em duas fases:
//  1. no formulário público (pré-inscrição): nome completo, género, data de nascimento, nacionalidade, habilitações,
//     telemóvel e email;
//  2. na ligação pessoal, antes dos documentos: morada, identificação (documento, NIF, NISS, IBAN, situação face ao
//     emprego) e a aceitação dos termos e do uso dos dados.
// Partilhado entre o site (validação ao escrever) e o servidor (validação que conta): as mesmas regras nos dois.
// Os valores gravados para o financiamento são os das listas da execução física (execucaoFisica.ts); o teste
// tests/preinscricaoFinDados.test.ts confirma que continuam a existir nessas listas. Sem imports: o servidor
// compila este ficheiro tal como está.

// ── Listas (rótulo amigável → valor do template) ─────────────────────────────

/** Género (LISTA_GENERO). */
export const GENEROS_FIN = [
  { rotulo: "Masculino", valor: "1 - Homens" },
  { rotulo: "Feminino", valor: "2 - Mulheres" },
  { rotulo: "Não binário", valor: "3 - Não Binário" },
] as const;

export const PAIS_PORTUGAL_FIN = "191 - Portugal";

/**
 * Habilitações (o que a pessoa diz) → habilitações do template (LISTA_HABILITACOES), pelo nível concluído:
 * 4.º ano = 1.º ciclo; 6.º ano = 2.º ciclo; 9.º, 10.º e 11.º anos = 3.º ciclo (o secundário só conta concluído);
 * 12.º ano = secundário; bacharelato, licenciatura e pós-graduação = licenciatura (o template não tem bacharelato
 * nem pós-graduação: ambos ficam no nível da licenciatura); mestrado; doutoramento. «Outro» fica por classificar
 * (a secretaria escolhe na ficha).
 */
export const HABILITACOES_FIN = [
  { rotulo: "4.º Ano", valor: "11 - 1.º ciclo do ensino básico" },
  { rotulo: "6.º Ano", valor: "1 - 2.º ciclo do ensino básico" },
  { rotulo: "9.º Ano", valor: "2 - 3.º ciclo do ensino básico obtido no ensino regular ou por percursos de dupla certificação" },
  { rotulo: "10.º Ano", valor: "2 - 3.º ciclo do ensino básico obtido no ensino regular ou por percursos de dupla certificação" },
  { rotulo: "11.º Ano", valor: "2 - 3.º ciclo do ensino básico obtido no ensino regular ou por percursos de dupla certificação" },
  { rotulo: "12.º Ano", valor: "3 - Ensino secundário vocacionado para prosseguimento de estudos de nível superior" },
  { rotulo: "Bacharelato", valor: "6 - Licenciatura" },
  { rotulo: "Licenciatura", valor: "6 - Licenciatura" },
  { rotulo: "Pós-Graduado", valor: "6 - Licenciatura" },
  { rotulo: "Mestrado", valor: "7 - Mestrado" },
  { rotulo: "Doutoramento", valor: "8 - Doutoramento" },
  { rotulo: "Outro", valor: "" },
] as const;

/**
 * Situação face ao emprego (o que a pessoa diz) → valor do template (LISTA_SITUACAO_EMPREGO). O template só tem
 * «5 - Empregados»: trabalhador por conta de outrem e trabalhador independente vão ambos para aí e pedem o NIF da
 * entidade empregadora (no independente, o próprio NIF).
 */
export const SITUACOES_EMPREGO_FIN = [
  { rotulo: "Trabalhador(a) por conta de outrem", valor: "5 - Empregados", pedeNifEntidade: "outrem" },
  { rotulo: "Trabalhador(a) independente", valor: "5 - Empregados", pedeNifEntidade: "independente" },
  { rotulo: "Desempregado(a) à procura do 1.º emprego", valor: "2 - Desempregado à procura do 1º emprego", pedeNifEntidade: "" },
  { rotulo: "Desempregado(a) há menos de 12 meses", valor: "3 - Desempregado à procura de novo emprego - Não DLD", pedeNifEntidade: "" },
  { rotulo: "Desempregado(a) há 12 meses ou mais", valor: "4 - Desempregado à procura de novo emprego - DLD", pedeNifEntidade: "" },
  { rotulo: "Inativo(a) (estudante, reformado(a), doméstico(a)…)", valor: "6 - Inativos", pedeNifEntidade: "" },
] as const;

export const TIPOS_DOCUMENTO_FIN = ["Cartão de Cidadão", "Bilhete de Identidade", "Passaporte"] as const;

/** Rótulo de um país da lista do template («191 - Portugal» → «Portugal»). */
export function rotuloPais(v: string) {
  return v.replace(/^\s*\d+\s*-\s*/, "");
}

export function situacaoEmpregoFin(rotulo: string) {
  return SITUACOES_EMPREGO_FIN.find(s => s.rotulo === rotulo) ?? null;
}

// ── Termos e condições ───────────────────────────────────────────────────────

/** Versão dos termos (sobe quando o texto muda; fica gravada com a aceitação). */
export const TERMOS_FIN_VERSAO = "2026-10";

export const TERMOS_FIN = [
  "A realização da formação está sujeita a um número mínimo de participantes.",
  "O número de participantes por turma é limitado.",
  "A seleção dos formandos é feita de acordo com a tipologia e os requisitos de acesso da formação.",
  "A inscrição só é considerada com a documentação obrigatória entregue.",
  "As inscrições são consideradas por ordem cronológica de chegada.",
  "As datas e os horários podem ser alterados; qualquer alteração é comunicada com antecedência.",
  "O certificado é emitido aos formandos com aproveitamento e assiduidade superior a 90%.",
  "Os dados pedidos são obrigatórios para a validação da inscrição e para a emissão do certificado na plataforma SIGO.",
] as const;

export const CONSENTIMENTO_DADOS_FIN = "Autorizo o tratamento dos meus dados pessoais para a inscrição numa turma e para o financiamento e o reembolso da formação.";

// ── Validadores ──────────────────────────────────────────────────────────────

/** Idade mínima à data do pedido: abaixo dos 16 anos não há contrato de formação. */
export const IDADE_MINIMA_FIN = 16;

/** NIF/NIPC português: 9 dígitos, primeiro dígito de um tipo atribuído e dígito de controlo (módulo 11). */
export function nifValido(nif: string) {
  if (!/^[1235689]\d{8}$/.test(nif) && !/^(45|70|71|72|74|75|77|79|90|91|98|99)\d{7}$/.test(nif)) return false;
  const soma = [...nif.slice(0, 8)].reduce((s, d, i) => s + Number(d) * (9 - i), 0);
  const resto = soma % 11;
  return Number(nif[8]) === (resto < 2 ? 0 : 11 - resto);
}

/** Normaliza (sem espaços, maiúsculas) e valida pelo controlo mod-97 (ISO 13616). */
export function validarIban(raw: string): { ok: true; iban: string } | { ok: false; erro: string } {
  const iban = String(raw ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return { ok: false, erro: "IBAN com formato inválido." };
  if (iban.startsWith("PT") && iban.length !== 25) return { ok: false, erro: "Um IBAN português tem 25 caracteres." };
  const rearranjado = iban.slice(4) + iban.slice(0, 4);
  let resto = 0;
  for (const ch of rearranjado) {
    const v = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) resto = (resto * 10 + Number(d)) % 97;
  }
  if (resto !== 1) return { ok: false, erro: "IBAN inválido (dígitos de controlo errados)." };
  return { ok: true, iban };
}

/** IBAN escrito como NIB (21 dígitos): em Portugal o IBAN é sempre PT50 + NIB. */
export function ibanDoNib(raw: string) {
  const s = String(raw ?? "").replace(/[\s.-]+/g, "").toUpperCase();
  return /^\d{21}$/.test(s) ? `PT50${s}` : s;
}

/** Só os últimos 4 caracteres à vista («•••• 1234»). */
export function mascararFim(v: string, fim = 4) {
  const s = String(v ?? "").replace(/\s+/g, "");
  if (!s) return "";
  return s.length <= fim ? "•".repeat(s.length) : `•••• ${s.slice(-fim)}`;
}

const soDigitos = (v: string) => String(v ?? "").replace(/\D/g, "");
const semEspacos = (v: string) => String(v ?? "").replace(/[\s-]+/g, "").toUpperCase();
const limparNif = (v: string) => String(v ?? "").replace(/\s+/g, "").replace(/^PT/i, "");

function dataValida(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Soma anos a uma data AAAA-MM-DD (29 de fevereiro passa a 28 nos anos comuns). */
function maisAnos(iso: string, anos: number) {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const ano = a + anos;
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return `${ano}-${String(m).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

type Erros<T> = Partial<Record<keyof T, string>>;

// ── 1. Formulário público ────────────────────────────────────────────────────

export type InscricaoFin = {
  nomeCompleto: string;
  /** Valor de GENEROS_FIN. */
  genero: string;
  /** AAAA-MM-DD. */
  dataNascimento: string;
  /** Valor da lista de países do template. */
  nacionalidade: string;
  /** Rótulo de HABILITACOES_FIN. */
  habilitacoes: string;
};

export const INSCRICAO_FIN_VAZIA: InscricaoFin = {
  nomeCompleto: "", genero: "", dataNascimento: "", nacionalidade: PAIS_PORTUGAL_FIN, habilitacoes: "",
};

/** `paises`: a lista de países do template (o servidor e o site passam LISTA_PAISES). `hoje`: dia civil em Lisboa. */
export function validarInscricaoFin(d: InscricaoFin, hoje: string, paises: readonly string[]): Erros<InscricaoFin> {
  const e: Erros<InscricaoFin> = {};
  const nome = d.nomeCompleto.trim().replace(/\s+/g, " ");
  if (!nome) e.nomeCompleto = "Indique o nome completo.";
  else if (nome.split(" ").length < 2) e.nomeCompleto = "Indique o nome completo (nome e apelido).";
  else if (nome.length > 160) e.nomeCompleto = "O nome é demasiado comprido.";
  if (!GENEROS_FIN.some(g => g.valor === d.genero)) e.genero = "Escolha o género.";
  const nasc = d.dataNascimento.trim();
  if (!nasc) e.dataNascimento = "Indique a data de nascimento.";
  else if (!dataValida(nasc) || nasc < "1900-01-01" || nasc >= hoje) e.dataNascimento = "Data de nascimento inválida.";
  else if (maisAnos(nasc, IDADE_MINIMA_FIN) > hoje) e.dataNascimento = `A formação financiada é para quem tem pelo menos ${IDADE_MINIMA_FIN} anos.`;
  if (!paises.includes(d.nacionalidade)) e.nacionalidade = "Escolha a nacionalidade.";
  if (!HABILITACOES_FIN.some(h => h.rotulo === d.habilitacoes)) e.habilitacoes = "Escolha as habilitações.";
  return e;
}

/** Telemóvel: pelo menos 9 dígitos (com ou sem indicativo). */
export function erroTelefoneFin(telf: string) {
  const d = soDigitos(telf);
  if (!d) return "Indique o número de telemóvel.";
  if (d.length < 9 || d.length > 15 || /[^\d\s+().-]/.test(telf)) return "Número de telemóvel inválido.";
  return "";
}

/** Nome completo → nome (primeiro) e apelido (o resto), como as fichas os guardam. */
export function partirNomeCompleto(nomeCompleto: string) {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  return { nome: partes[0] ?? "", apelido: partes.slice(1).join(" ") };
}

// ── 2. Ligação pessoal: morada ───────────────────────────────────────────────

export type MoradaFin = { morada: string; localidade: string; codigoPostal: string; concelho: string };

export const MORADA_FIN_VAZIA: MoradaFin = { morada: "", localidade: "", codigoPostal: "", concelho: "" };

/** `concelhos`: a lista de concelhos (Listas de opções); vazia aceita qualquer concelho. */
export function validarMoradaFin(d: MoradaFin, concelhos: readonly string[] = []): Erros<MoradaFin> {
  const e: Erros<MoradaFin> = {};
  if (d.morada.trim().length < 5) e.morada = "Indique a morada (rua, número e andar).";
  else if (d.morada.trim().length > 200) e.morada = "A morada é demasiado comprida.";
  if (d.localidade.trim().length < 2) e.localidade = "Indique a localidade.";
  else if (d.localidade.trim().length > 80) e.localidade = "A localidade é demasiado comprida.";
  if (!/^\d{4}-\d{3}$/.test(d.codigoPostal.trim())) e.codigoPostal = "Código postal no formato 0000-000.";
  if (!d.concelho.trim()) e.concelho = "Escolha o concelho.";
  else if (concelhos.length && !concelhos.includes(d.concelho.trim())) e.concelho = "Escolha um concelho da lista.";
  return e;
}

export function normalizarMoradaFin(d: MoradaFin): MoradaFin {
  return { morada: d.morada.trim().replace(/\s+/g, " "), localidade: d.localidade.trim(), codigoPostal: d.codigoPostal.trim(), concelho: d.concelho.trim() };
}

// ── 2. Ligação pessoal: identificação ────────────────────────────────────────

export type IdentificacaoFinForm = {
  tipoDocumento: string;
  numeroDocumento: string;
  /** AAAA-MM-DD. */
  validadeDocumento: string;
  nif: string;
  niss: string;
  /** IBAN ou NIB (21 dígitos). */
  iban: string;
  /** Rótulo de SITUACOES_EMPREGO_FIN. */
  situacaoEmprego: string;
  nifEntidadeEmpregadora: string;
};

export const IDENTIFICACAO_FIN_VAZIA: IdentificacaoFinForm = {
  tipoDocumento: "Cartão de Cidadão", numeroDocumento: "", validadeDocumento: "", nif: "", niss: "", iban: "",
  situacaoEmprego: "", nifEntidadeEmpregadora: "",
};

/** Campos sensíveis: ao retomar a ligação vêm mascarados e, deixados em branco, ficam como estavam. */
export const CAMPOS_SENSIVEIS_FIN = ["numeroDocumento", "nif", "niss", "iban", "nifEntidadeEmpregadora"] as const;
export type CampoSensivelFin = typeof CAMPOS_SENSIVEIS_FIN[number];

function erroDocumento(tipo: string, numero: string) {
  const n = semEspacos(numero);
  if (tipo === "Cartão de Cidadão") return /^\d{8}(\d[A-Z0-9]{2}\d)?$/.test(n) ? "" : "O n.º do Cartão de Cidadão tem 8 dígitos (ou o número completo, ex.: 12345678 0 ZZ0).";
  if (tipo === "Bilhete de Identidade") return /^\d{6,9}$/.test(n) ? "" : "O n.º do Bilhete de Identidade tem 6 a 9 dígitos.";
  return /^[A-Z0-9]{6,12}$/.test(n) ? "" : "O n.º do passaporte tem 6 a 12 letras e dígitos.";
}

/**
 * Valida a identificação. `guardados`: campos sensíveis que já estão gravados (em branco, mantêm-se).
 * Todos obrigatórios (são precisos para a turma e para o reembolso); o NIF da entidade empregadora só para quem
 * trabalha (por conta de outrem ou independente).
 */
export function validarIdentificacaoFin(d: IdentificacaoFinForm, hoje: string, guardados: readonly CampoSensivelFin[] = []): Erros<IdentificacaoFinForm> {
  const e: Erros<IdentificacaoFinForm> = {};
  const ja = (k: CampoSensivelFin) => guardados.includes(k) && !String(d[k] ?? "").trim();
  if (!(TIPOS_DOCUMENTO_FIN as readonly string[]).includes(d.tipoDocumento)) e.tipoDocumento = "Escolha o tipo de documento.";
  if (!ja("numeroDocumento")) {
    if (!d.numeroDocumento.trim()) e.numeroDocumento = "Indique o número do documento.";
    else if (!e.tipoDocumento) {
      const erro = erroDocumento(d.tipoDocumento, d.numeroDocumento);
      if (erro) e.numeroDocumento = erro;
    }
  }
  const val = d.validadeDocumento.trim();
  if (!val) e.validadeDocumento = "Indique a validade do documento.";
  else if (!dataValida(val)) e.validadeDocumento = "Data de validade inválida.";
  else if (val < hoje) e.validadeDocumento = "O documento está fora da validade.";
  else if (val > maisAnos(hoje, 20)) e.validadeDocumento = "Data de validade inválida.";
  if (!ja("nif")) {
    const nif = limparNif(d.nif);
    if (!nif) e.nif = "Indique o NIF.";
    else if (!(/^\d{9}$/.test(nif) && nifValido(nif))) e.nif = "NIF inválido (confira os 9 dígitos).";
  }
  if (!ja("niss")) {
    const niss = d.niss.replace(/\s+/g, "");
    if (!niss) e.niss = "Indique o NISS.";
    else if (!/^\d{11}$/.test(niss)) e.niss = "O NISS tem 11 dígitos.";
  }
  if (!ja("iban")) {
    const iban = ibanDoNib(d.iban);
    if (!iban) e.iban = "Indique o IBAN ou o NIB.";
    else {
      const r = validarIban(iban);
      if (!r.ok) e.iban = r.erro;
    }
  }
  const sit = situacaoEmpregoFin(d.situacaoEmprego);
  if (!sit) e.situacaoEmprego = "Escolha a situação face ao emprego.";
  else if (sit.pedeNifEntidade && !ja("nifEntidadeEmpregadora")) {
    const nif = limparNif(d.nifEntidadeEmpregadora);
    const rotulo = sit.pedeNifEntidade === "independente" ? "o seu NIF de trabalhador independente" : "o NIF da entidade empregadora";
    if (!nif) e.nifEntidadeEmpregadora = `Indique ${rotulo}.`;
    else if (!(/^\d{9}$/.test(nif) && nifValido(nif))) e.nifEntidadeEmpregadora = "NIF inválido (confira os 9 dígitos).";
  }
  return e;
}

/** Os valores como se gravam (normalizados); só depois de validar sem erros. Em branco = manter o gravado. */
export function normalizarIdentificacaoFin(d: IdentificacaoFinForm): IdentificacaoFinForm {
  const iban = ibanDoNib(d.iban);
  const ibanOk = iban ? validarIban(iban) : null;
  return {
    tipoDocumento: d.tipoDocumento,
    numeroDocumento: semEspacos(d.numeroDocumento),
    validadeDocumento: d.validadeDocumento.trim(),
    nif: limparNif(d.nif),
    niss: d.niss.replace(/\s+/g, ""),
    iban: ibanOk?.ok ? ibanOk.iban : "",
    situacaoEmprego: d.situacaoEmprego,
    nifEntidadeEmpregadora: situacaoEmpregoFin(d.situacaoEmprego)?.pedeNifEntidade ? limparNif(d.nifEntidadeEmpregadora) : "",
  };
}
