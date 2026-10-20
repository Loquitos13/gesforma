// Execução física da Financiada: as listas do template oficial (folha TD do modelo
// server/src/modelos/execucao-fisica.xlsx, coluna C, «código - descrição») e os dados do formando para o
// financiamento. Partilhado entre o browser (seletores da ficha) e o servidor (validação e preenchimento):
// os valores gravados são exactamente os da lista, tal como o ficheiro os espera.
//
// As listas foram extraídas do modelo; o teste tests/execucaoFisica.test.ts confirma que continuam iguais.

/** Género (TD!C2:C4, coluna N). */
export const LISTA_GENERO = [
  "1 - Homens",
  "2 - Mulheres",
  "3 - Não Binário",
] as const;

/** Situação face ao emprego (TD!C25:C29, colunas V e W). */
export const LISTA_SITUACAO_EMPREGO = [
  "2 - Desempregado à procura do 1º emprego",
  "3 - Desempregado à procura de novo emprego - Não DLD",
  "4 - Desempregado à procura de novo emprego - DLD",
  "5 - Empregados",
  "6 - Inativos",
] as const;

/** Habilitações literárias (TD!C53:C63, colunas Z e AA). */
export const LISTA_HABILITACOES = [
  "1 - 2.º ciclo do ensino básico",
  "2 - 3.º ciclo do ensino básico obtido no ensino regular ou por percursos de dupla certificação",
  "3 - Ensino secundário vocacionado para prosseguimento de estudos de nível superior",
  "4 - Ensino secundário obtido por percursos de dupla certificação ou ensino secundário vocacionado para prosseguimento de estudos de nível superior acrescido de estágio profissional – mínimo de 6 meses",
  "5 - Qualificação de nível pós-secundário não superior com créditos para prosseguimento de estudos de nível superior",
  "6 - Licenciatura",
  "7 - Mestrado",
  "8 - Doutoramento",
  "9 - Não sabe ler nem escrever",
  "10 - < 4 anos escolaridade",
  "11 - 1.º ciclo do ensino básico",
] as const;

/** Nível QNQ (TD!C66:C74, colunas AB e AC). */
export const LISTA_QNQ = [
  "1 - Nível Qualificação 1",
  "2 - Nível Qualificação 2",
  "3 - Nível Qualificação 3",
  "4 - Nível Qualificação 4",
  "5 - Nível Qualificação 5",
  "6 - Nível Qualificação 6",
  "7 - Nível Qualificação 7",
  "8 - Nível Qualificação 8",
  "9 - Nível não aplicável",
] as const;

/** Sim/Não (TD!C77:C78 e C81:C82, colunas AD, AE e AF). */
export const LISTA_SIM_NAO = [
  "1 - Sim",
  "2 - Não",
] as const;

/** Tipo de entidade enquadradora (TD!C137:C140, coluna AQ). */
export const LISTA_TIPO_ENTIDADE = [
  "1 - Entidade Empregadora",
  "2 - Entidade Formadora",
  "3 - Entidade Responsavel pela candidatura interna",
  "4 - Entidade de Acolhimento",
] as const;

/** Países (TD!C169:C414, colunas O, AV e AZ). */
export const LISTA_PAISES = [
  "1 - Afeganistão",
  "2 - África do Sul",
  "3 - Albânia",
  "4 - Alemanha",
  "5 - Andorra",
  "6 - Angola",
  "7 - Anguila",
  "8 - Antártida",
  "9 - Antígua e Barbuda",
  "10 - Antilhas Holandesas",
  "11 - Arábia Saudita",
  "12 - Argélia",
  "13 - Argentina",
  "14 - Arménia",
  "15 - Aruba",
  "16 - Austrália",
  "17 - Áustria",
  "18 - Azerbaijão",
  "19 - Bahamas",
  "20 - Bahrein",
  "21 - Bangladesh",
  "22 - Barbados",
  "23 - Bielorrússia",
  "24 - Bélgica",
  "25 - Belize",
  "26 - Benin",
  "27 - Bermudas",
  "28 - Bolívia",
  "29 - Bósnia-Herzegóvina",
  "30 - Botsuana",
  "31 - Brasil",
  "32 - Brunei",
  "33 - Bulgária",
  "34 - Burkina Fasso",
  "35 - Burundi",
  "36 - Butão",
  "37 - Cabo Verde",
  "38 - Camarões",
  "39 - Camboja",
  "40 - Canadá",
  "41 - Cazaquistão",
  "42 - Chade",
  "43 - Chile",
  "44 - China",
  "45 - Chipre",
  "46 - Singapura",
  "47 - Colômbia",
  "48 - Congo",
  "49 - Coreia do Norte",
  "50 - Coreia do Sul",
  "51 - Costa do Marfim",
  "52 - Costa Rica",
  "53 - Croácia (Hrvatska)",
  "54 - Cuba",
  "55 - Dinamarca",
  "56 - Djibuti",
  "57 - Dominica",
  "58 - Egito",
  "59 - El Salvador",
  "60 - Emirados Árabes Unidos",
  "61 - Equador",
  "62 - Eritréia",
  "63 - Eslováquia",
  "64 - Eslovénia",
  "65 - Espanha",
  "66 - Estados Unidos",
  "67 - Estônia",
  "68 - Etiópia",
  "69 - Federação Russa",
  "70 - Fiji",
  "71 - Filipinas",
  "72 - Finlândia",
  "73 - França",
  "74 - Gabão",
  "75 - Gâmbia",
  "76 - Gana",
  "77 - Geórgia",
  "78 - Gibraltar",
  "79 - Grã-Bretanha (Reino Unido, UK)",
  "80 - Granada",
  "81 - Grécia",
  "82 - Gronelândia",
  "83 - Guadalupe",
  "84 - Guam (Território dos Estados Unidos)",
  "85 - Guatemala",
  "86 - Guernsey",
  "87 - Guiana",
  "88 - Guiana Francesa",
  "89 - Guiné",
  "90 - Guiné Equatorial",
  "91 - Guiné-Bissau",
  "92 - Haiti",
  "93 - Holanda",
  "94 - Honduras",
  "95 - Hong Kong",
  "96 - Hungria",
  "97 - Iêmen",
  "98 - Ilha Bouvet (Território da Noruega)",
  "99 - Ilha do Homem",
  "100 - Ilha Natal",
  "101 - Ilha Pitcairn",
  "102 - Ilha Reunião",
  "103 - Ilhas Aland",
  "104 - Ilhas Cayman",
  "105 - Ilhas Cocos",
  "106 - Ilhas Comores",
  "107 - Ilhas Cook",
  "108 - Ilhas Falkland (Malvinas)",
  "109 - Ilhas Faroes",
  "110 - Ilhas Geórgia do Sul e Sandwich do Sul",
  "111 - Ilhas Heard e McDonald (Território da Austrália)",
  "112 - Ilhas Marianas do Norte",
  "113 - Ilhas Marshall",
  "114 - Ilhas Menores dos Estados Unidos",
  "115 - Ilhas Norfolk",
  "116 - Ilhas Seychelles",
  "117 - Ilhas Solomão",
  "118 - Ilhas Svalbard e Jan Mayen",
  "119 - Ilhas Tokelau",
  "120 - Ilhas Turks e Caicos",
  "121 - Ilhas Virgens (Estados Unidos)",
  "122 - Ilhas Virgens (Inglaterra)",
  "123 - Ilhas Wallis e Futuna",
  "124 - Índia",
  "125 - Indonésia",
  "126 - Irã",
  "127 - Iraque",
  "128 - Irlanda",
  "129 - Islândia",
  "130 - Israel",
  "131 - Itália",
  "132 - Jamaica",
  "133 - Japão",
  "134 - Jersey",
  "135 - Jordânia",
  "136 - Kênia",
  "137 - Kiribati",
  "138 - Kuait",
  "139 - Kyrgyzstan",
  "140 - Laos",
  "141 - Látvia",
  "142 - Lesoto",
  "143 - Líbano",
  "144 - Libéria",
  "145 - Líbia",
  "146 - Liechtenstein",
  "147 - Lituânia",
  "148 - Luxemburgo",
  "149 - Macau",
  "150 - Macedônia (República Yugoslava)",
  "151 - Madagascar",
  "152 - Malásia",
  "153 - Malaui",
  "154 - Maldivas",
  "155 - Mali",
  "156 - Malta",
  "157 - Marrocos",
  "158 - Martinica",
  "159 - Maurício",
  "160 - Mauritânia",
  "161 - Mayotte",
  "162 - Mexico",
  "163 - Micronésia",
  "164 - Moçambique",
  "165 - Moldova",
  "166 - Mônaco",
  "167 - Mongólia",
  "168 - Montenegro",
  "169 - Montserrat",
  "170 - Myanma (Ex-Burma)",
  "171 - Namíbia",
  "172 - Nauru",
  "173 - Nepal",
  "174 - Nicarágua",
  "175 - Níger",
  "176 - Nigéria",
  "177 - Niue",
  "178 - Noruega",
  "179 - Nova Caledônia",
  "180 - Nova Zelândia",
  "181 - Omã",
  "182 - Palau",
  "183 - Panamá",
  "184 - Papua-Nova Guiné",
  "185 - Paquistão",
  "186 - Paraguai",
  "187 - Peru",
  "188 - Polinésia Francesa",
  "189 - Polônia",
  "190 - Porto Rico",
  "191 - Portugal",
  "192 - Qatar",
  "193 - República Centro-Africana",
  "194 - República Democrática do Congo (ex-Zaire)",
  "195 - República Dominicana",
  "196 - República Tcheca",
  "197 - Romênia",
  "198 - Ruanda",
  "199 - Saara Ocidental (Ex-Spanish Sahara)",
  "200 - Saint Vincente e Granadinas",
  "201 - Samoa Americana",
  "202 - Samoa Ocidental",
  "203 - San Marino",
  "204 - Santa Helena",
  "205 - Santa Lúcia",
  "206 - São Bartolomeu",
  "207 - São Cristóvão e Névis",
  "208 - São Martim",
  "209 - São Tomé e Príncipe",
  "210 - Senegal",
  "211 - Serra Leoa",
  "212 - Sérvia",
  "213 - Síria",
  "214 - Somália",
  "215 - Sri Lanka",
  "216 - St. Pierre and Miquelon",
  "217 - Suazilândia",
  "218 - Sudão",
  "219 - Suécia",
  "220 - Suíça",
  "221 - Suriname",
  "222 - Tadjiquistão",
  "223 - Tailândia",
  "224 - Taiwan",
  "225 - Tanzânia",
  "226 - Território Britânico do Oceano índico",
  "227 - Territórios do Sul da França",
  "228 - Territórios Palestinos Ocupados",
  "229 - Timor Leste (Ex-East Timor)",
  "230 - Togo",
  "231 - Tonga",
  "232 - Trinidad and Tobago",
  "233 - Tunísia",
  "234 - Turcomenistão",
  "235 - Turquia",
  "236 - Tuvalu",
  "237 - Ucrânia",
  "238 - Uganda",
  "239 - Uruguai",
  "240 - Uzbequistão",
  "241 - Vanuatu",
  "242 - Vaticano",
  "243 - Venezuela",
  "244 - Vietnam",
  "245 - Zâmbia",
  "246 - Zimbábue",
] as const;

/** Áreas de formação CNAEF (TD!C418:C532; coluna D, e AW). */
export const LISTA_CNAEF = [
  "010 - Programas de base",
  "080 - Alfabetização",
  "090 - Desenvolvimento pessoal",
  "140 - Formação de professores/formadores e ciências da educação(*)",
  "142 - Ciências da educação",
  "143 - Formação de educadores de infância",
  "144 - Formação de professores do ensino básico (1.º e 2.º ciclos)",
  "145 - Formação de professores de áreas disciplinares específicas",
  "146 - Formação de professores e formadores de áreas tecnológicas",
  "149 - Formação de professores/formadores e ciências da educação - programas não classificados noutra área de formação",
  "210 - Artes(*)",
  "211 - Belas Artes",
  "212 - Artes do Espectáculo",
  "213 - Audiovisuais e produção dos media",
  "214 - Design",
  "215 - Artesanato",
  "219 - Artes - programas não classificados noutra área de formação",
  "220 - Humanidades(*)",
  "221 - Religião e teologia",
  "222 - Línguas e literaturas estrangeiras",
  "223 - Língua e literatura materna",
  "225 - História e arqueologia",
  "226 - Filosofia e ética",
  "229 - Humanidades - programas não classificados noutra área de formação",
  "310 - Ciências sociais e do comportamento(*)",
  "311 - Psicologia",
  "312 - Sociologia e outros estudos",
  "313 - Ciência política e cidadania",
  "314 - Economia",
  "319 - Ciências sociais e do comportamento - programas não classificados noutra área de formação",
  "320 - Informação e jornalismo(*)",
  "321 - Jornalismo e reportagem",
  "322 - Biblioteconomia, arquivo e documentação (BAD)",
  "329 - Informação e jornalismo - Programas não classificados noutra área de formação",
  "340 - Ciências empresariais(*)",
  "341 - Comércio",
  "342 - Marketing e publicidade",
  "343 - Finanças, banca e seguros",
  "344 - Contabilidade e fiscalidade",
  "345 - Gestão e administração",
  "346 - Secretariado e trabalho administrativo",
  "347 - Enquadramento na organização/ empresa",
  "349 - Ciências empresariais - programas não classificados noutra área de formação",
  "380 - Direito",
  "420 - Ciências da vida(*)",
  "421 - Biologia e bioquímica",
  "422 - Ciências do ambiente",
  "429 - Ciências da vida - programas não classificados noutra área de formação",
  "440 - Ciências físicas(*)",
  "441 - Física",
  "442 - Química",
  "443 - Ciências da terra",
  "449 - Ciências físicas - programas não classificados noutra área de formação",
  "460 - Matemática e estatística(*)",
  "461 - Matemática",
  "462 - Estatística",
  "469 - Matemática e estatística - programas não classificados noutra área de formação",
  "480 - Informática(*)",
  "481 - Ciências informáticas",
  "482 - Informática na óptica do utilizador",
  "489 - Informática - programas não classificados noutra área de formação",
  "520 - Engenharia e técnicas afins(*)",
  "521 - Metalurgia e metalomecânica",
  "522 - Electricidade e energia",
  "523 - Electrónica e automação",
  "524 - Tecnologia dos processos químicos",
  "525 - Construção e reparação de veículos a motor",
  "529 - Engenharia e técnicas afins - programas não classificados noutra área de formação",
  "540 - Indústrias transformadoras(*)",
  "541 - Indústrias alimentares",
  "542 - Indústrias do têxtil, vestuário, calçado e couro",
  "543 - Materiais (indústrias da madeira, cortiça, papel, plástico, vidro e outros)",
  "544 - Indústrias extractivas",
  "549 - Indústrias transformadoras - programas não classificados noutra área de formação",
  "580 - Arquitectura e construção(*)",
  "581 - Arquitectura e urbanismo",
  "582 - Construção civil e engenharia civil",
  "589 - Arquitectura e construção - programas não classificados noutra área de formação",
  "620 - Agricultura, silvicultura e pescas(*)",
  "621 - Produção agrícola e animal",
  "622 - Floricultura e jardinagem",
  "623 - Silvicultura e caça",
  "624 - Pescas",
  "629 - Agricultura, silvicultura e pescas - programas não classificados noutra área de formação",
  "640 - Ciências veterinárias",
  "720 - Saúde(*)",
  "721 - Medicina",
  "723 - Enfermagem",
  "724 - Ciências dentárias",
  "725 - Tecnologias de diagnóstico e terapêutica",
  "726 - Terapia e reabilitação",
  "727 - Ciências farmacêuticas",
  "729 - Saúde - programas não classificados noutra área de formação",
  "760 - Serviços sociais(*)",
  "761 - Serviços de apoio a crianças e jovens",
  "762 - Trabalho social e orientação",
  "769 - Serviços sociais - programas não classificados noutra área de formação",
  "810 - Serviços pessoais(*)",
  "811 - Hotelaria e restauração",
  "812 - Turismo e lazer",
  "813 - Desporto",
  "814 - Serviços domésticos",
  "815 - Cuidados de beleza",
  "819 - Serviços pessoais - programas não classificados noutra área de formação",
  "840 - Serviços de transporte",
  "850 - Protecção do ambiente(*)",
  "851 - Tecnologia de protecção do ambiente",
  "852 - Ambientes naturais e vida selvagem",
  "853 - Serviços de saúde pública",
  "859 - Protecção do ambiente - programas não classificados noutra área de formação",
  "860 - Serviços de segurança(*)",
  "861 - Protecção de pessoas e bens",
  "862 - Segurança e higiene no trabalho",
  "863 - Segurança militar",
  "869 - Serviços de segurança - programas não classificados noutra área de formação",
] as const;

export const PAIS_PORTUGAL = "191 - Portugal";
export const SIM = "1 - Sim";
export const NAO = "2 - Não";
export const ENTIDADE_EMPREGADORA = "1 - Entidade Empregadora";
export const EMPREGADOS = "5 - Empregados";

/** Código de um valor de lista («341 - Comércio» → "341"). */
export function codigoDaLista(v: string) {
  return /^\s*(\d+)\s*-/.exec(v)?.[1] ?? "";
}

/**
 * Nível QNQ a partir das habilitações (o código das habilitações 1 a 8 é o nível; abaixo do 2.º ciclo,
 * «9 - Nível não aplicável»).
 */
export function qnqDasHabilitacoes(habilitacoes: string): string {
  const c = Number(codigoDaLista(habilitacoes));
  if (!c) return "";
  if (c >= 1 && c <= 8) return LISTA_QNQ[c - 1]!;
  return LISTA_QNQ[8]!;
}

/** Desempregado (à procura do 1.º ou de novo emprego). */
export function desempregado(situacao: string) {
  return ["2", "3", "4"].includes(codigoDaLista(situacao));
}

/** «Procura emprego após terminada a participação» por omissão: sim para quem entrou desempregado. */
export function procuraEmpregoPorOmissao(situacaoEntrada: string) {
  if (!situacaoEntrada) return "";
  return desempregado(situacaoEntrada) ? SIM : NAO;
}

/**
 * Dados do formando para o financiamento (ficha da Financiada › Dados para o financiamento).
 * Os identificadores pessoais (NIF, NISS, data de nascimento, código postal e documentos de estrangeiro)
 * ficam no pacote cifrado do formando; o resto numa tabela própria.
 */
export type DadosFinanciamento = {
  nif: string;
  niss: string;
  /** AAAA-MM-DD. */
  dataNascimento: string;
  codigoPostal: string;
  protecaoInternacional: string;
  autorizacaoResidencia: string;
  tipoAutorizacaoResidencia: string;
  passaporte: string;
  genero: string;
  nacionalidade: string;
  situacaoEmpregoEntrada: string;
  situacaoEmpregoSaida: string;
  habilitacoesEntrada: string;
  habilitacoesSaida: string;
  procuraEmpregoApos: string;
  estudaEntrada: string;
  estudaApos: string;
  numeroSigo: string;
  nifEntidadeEmpregadora: string;
};

/** Os campos cifrados (identificadores pessoais). */
export const CAMPOS_FINANCIAMENTO_CIFRADOS = [
  "nif", "niss", "dataNascimento", "codigoPostal", "protecaoInternacional", "autorizacaoResidencia", "tipoAutorizacaoResidencia", "passaporte",
] as const satisfies readonly (keyof DadosFinanciamento)[];

/** Os campos com lista do template e a lista de cada um. */
export const LISTAS_FINANCIAMENTO = {
  genero: LISTA_GENERO,
  nacionalidade: LISTA_PAISES,
  situacaoEmpregoEntrada: LISTA_SITUACAO_EMPREGO,
  situacaoEmpregoSaida: LISTA_SITUACAO_EMPREGO,
  habilitacoesEntrada: LISTA_HABILITACOES,
  habilitacoesSaida: LISTA_HABILITACOES,
  procuraEmpregoApos: LISTA_SIM_NAO,
  estudaEntrada: LISTA_SIM_NAO,
  estudaApos: LISTA_SIM_NAO,
} as const satisfies Partial<Record<keyof DadosFinanciamento, readonly string[]>>;

export const FINANCIAMENTO_VAZIO: DadosFinanciamento = {
  nif: "", niss: "", dataNascimento: "", codigoPostal: "", protecaoInternacional: "", autorizacaoResidencia: "",
  tipoAutorizacaoResidencia: "", passaporte: "", genero: "", nacionalidade: "", situacaoEmpregoEntrada: "",
  situacaoEmpregoSaida: "", habilitacoesEntrada: "", habilitacoesSaida: "", procuraEmpregoApos: "", estudaEntrada: "",
  estudaApos: "", numeroSigo: "", nifEntidadeEmpregadora: "",
};

/** Rótulos (os mesmos na ficha e na lista do que falta no cockpit). */
export const ROTULOS_FINANCIAMENTO: Record<keyof DadosFinanciamento, string> = {
  nif: "NIF",
  niss: "NISS",
  dataNascimento: "Data de nascimento",
  codigoPostal: "Código postal",
  protecaoInternacional: "N.º do pedido de proteção internacional",
  autorizacaoResidencia: "N.º da autorização de residência",
  tipoAutorizacaoResidencia: "Tipo de autorização de residência",
  passaporte: "N.º do passaporte",
  genero: "Género",
  nacionalidade: "Nacionalidade",
  situacaoEmpregoEntrada: "Situação face ao emprego à entrada",
  situacaoEmpregoSaida: "Situação face ao emprego à saída",
  habilitacoesEntrada: "Habilitações à entrada",
  habilitacoesSaida: "Habilitações à saída",
  procuraEmpregoApos: "Procura emprego após a formação",
  estudaEntrada: "Estuda ou frequenta formação à entrada",
  estudaApos: "Estuda ou frequenta formação após",
  numeroSigo: "Número SIGO",
  nifEntidadeEmpregadora: "NIF da entidade empregadora",
};

/** Estrangeiro sem nenhum documento (autorização de residência, passaporte ou pedido de proteção internacional). */
export function faltaDocumentoEstrangeiro(d: Pick<DadosFinanciamento, "nacionalidade" | "autorizacaoResidencia" | "passaporte" | "protecaoInternacional">) {
  return Boolean(d.nacionalidade) && d.nacionalidade !== PAIS_PORTUGAL
    && !d.autorizacaoResidencia.trim() && !d.passaporte.trim() && !d.protecaoInternacional.trim();
}

/** Área CNAEF válida (exactamente um valor da lista). */
export function areaCnaefValida(v: string) {
  return (LISTA_CNAEF as readonly string[]).includes(v);
}
