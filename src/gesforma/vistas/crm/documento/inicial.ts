// Texto de partida de um modelo novo (o resto do texto vem sempre dos modelos guardados na base de dados).
import { chipHtml } from "./modelo";

const c = chipHtml;

export const BLOCO_INVESTIMENTO = '<div data-bloco="investimento" contenteditable="false"></div>';
export const BLOCO_ASSINATURAS = '<div data-assinaturas="1" contenteditable="false"><div>Pela entidade formadora</div><div>Pelo cliente</div></div>';

export function propostaInicial() {
  return [
    `<p>Exmo(a). Senhor(a) ${c("contacto")},</p>`,
    `<p>Na sequência da nossa conversa, apresentamos a proposta de formação para ${c("cliente")}.</p>`,
    `<h2>${c("curso")}</h2>`,
    `<p>A formação tem <strong>${c("horas")}</strong>, com início previsto a ${c("inicio")}, e confere certificado de formação profissional emitido no SIGO.</p>`,
    "<h3>O que inclui</h3>",
    "<ul><li>Formador especializado na área;</li><li>Manual do formando e exercícios adaptados à vossa operação;</li><li>Avaliação final e relatório de aproveitamento por formando.</li></ul>",
    "<h3>Investimento</h3>",
    BLOCO_INVESTIMENTO,
    `<p><em>Isento de IVA ao abrigo do art. 9.º do CIVA. Proposta válida até ${c("validade")}.</em></p>`,
    "<p>Ficamos ao dispor para qualquer esclarecimento.</p>",
    `<p>Com os melhores cumprimentos,<br>${c("comercial")}</p>`,
  ].join("");
}

export function contratoInicial() {
  return [
    "<h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE FORMAÇÃO</h2>",
    `<p><strong>Primeira outorgante:</strong> ${c("entidade")}, entidade formadora certificada.</p>`,
    `<p><strong>Segunda outorgante:</strong> ${c("cliente")}, NIF ${c("nif")}, com sede em ${c("sede")}, representada por ${c("representante")}.</p>`,
    "<p>É celebrado o presente contrato, que se rege pelas cláusulas seguintes.</p>",
    '<h3 class="gf-clausula">Objecto</h3>',
    `<p>A primeira outorgante presta à segunda a formação ${c("curso")}, com ${c("horas")}, para ${c("formandos")}, em ${c("local")}, entre ${c("datas")}.</p>`,
    '<h3 class="gf-clausula">Preço e pagamento</h3>',
    `<p>O valor total é de ${c("valor")}, isento de IVA nos termos do art. 9.º do CIVA, ${c("plano")}.</p>`,
    '<h3 class="gf-clausula">Certificação</h3>',
    "<p>Cada formando com aproveitamento recebe certificado de formação profissional emitido através do SIGO.</p>",
    '<section data-opcional="cancelamento" data-ligada="1"><h3 class="gf-clausula">Cancelamento e reagendamento</h3><p>Qualquer das partes pode reagendar sessões com aviso de 10 dias úteis. O cancelamento depois do início não dá lugar a devolução.</p></section>',
    '<section data-opcional="rgpd" data-ligada="1"><h3 class="gf-clausula">Protecção de dados</h3><p>Os dados pessoais dos formandos são tratados apenas para gestão da formação e cumprimento de obrigações legais, nos termos do RGPD.</p></section>',
    '<section data-opcional="imagem" data-ligada="0"><h3 class="gf-clausula">Direitos de imagem</h3><p>A segunda outorgante autoriza o registo fotográfico das sessões para divulgação, sem identificação dos formandos.</p></section>',
    "<p>Feito em duplicado, ficando cada outorgante com um exemplar.</p>",
    BLOCO_ASSINATURAS,
  ].join("");
}
