// Pagamento em prestações: ao anexar o comprovativo, a comercial ou a coordenação confirma em quantas vezes é o
// pagamento (1x por omissão) e escreve o valor de cada prestação. Também serve para corrigir depois («Alterar»).
import { useEffect, useState } from "react";
import { Botao, Campo, Entrada, Modal } from "../../../../partilhado/ui";

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const numero = (v: string) => Number(v.replace(",", "."));

export function JanelaPrestacoes({ aberto, preco, atuais, comFicheiro, rotuloFicheiro, aGravar, onFechar, onConfirmar }: {
  aberto: boolean;
  preco: number;
  /** Prestações já confirmadas (vazio = ainda não). */
  atuais: number[];
  /** Pede também o ficheiro do comprovativo (o da 1.ª prestação). */
  comFicheiro: boolean;
  rotuloFicheiro?: string;
  aGravar: boolean;
  onFechar: () => void;
  onConfirmar: (valores: number[], ficheiro: File | null) => void;
}) {
  const [vezes, setVezes] = useState(1);
  const [valores, setValores] = useState<string[]>([]);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  useEffect(() => {
    if (!aberto) return;
    const base = atuais.length ? atuais : [preco];
    setVezes(base.length);
    setValores(base.map(v => (v ? String(v).replace(".", ",") : "")));
    setFicheiro(null);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  function mudarVezes(n: number) {
    const v = Math.min(12, Math.max(1, n || 1));
    setVezes(v);
    // 1x: o preço todo; mais vezes: a equipa escreve cada valor (os já escritos ficam).
    setValores(v === 1 ? [String(preco || "").replace(".", ",")] : Array.from({ length: v }, (_, i) => (vezes > 1 ? valores[i] ?? "" : "")));
  }
  const nums = valores.map(numero);
  const validos = nums.length === vezes && nums.every(n => Number.isFinite(n) && n > 0);
  const total = nums.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const difere = preco > 0 && Math.abs(total - preco) > 0.005;

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Pagamento em quantas vezes?"
      subtitulo={preco ? `Valor do curso: ${eur(preco)}.` : undefined}
      rodape={<>
        <Botao onClick={onFechar}>Cancelar</Botao>
        <Botao variante="primario" aCarregar={aGravar} disabled={!validos || (comFicheiro && !ficheiro)}
          onClick={() => onConfirmar(nums.map(n => Math.round(n * 100) / 100), ficheiro)}>
          {comFicheiro ? "Confirmar e anexar" : "Confirmar"}
        </Botao>
      </>}>
      <div className="space-y-4">
        <Campo rotulo="Número de prestações" ajuda="Por omissão, uma só vez. Confirme sempre com a pessoa.">
          {p => <Entrada {...p} type="number" min={1} max={12} className="w-24" value={vezes} onChange={e => mudarVezes(Number(e.target.value))} />}
        </Campo>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: vezes }, (_, i) => (
            <Campo key={i} rotulo={vezes === 1 ? "Valor" : `${i + 1}.ª prestação (€)`}>
              {p => <Entrada {...p} inputMode="decimal" value={valores[i] ?? ""} placeholder="0,00"
                onChange={e => setValores(vs => vs.map((x, j) => (j === i ? e.target.value : x)))} />}
            </Campo>
          ))}
        </div>
        <p className={`m-0 text-xs ${difere ? "font-semibold text-aviso" : "text-tinta-suave"}`}>
          Total: {eur(total)}{difere ? ` (diferente do valor do curso: ${eur(preco)})` : ""}
        </p>
        {comFicheiro && (
          <Campo rotulo={rotuloFicheiro ?? "Comprovativo de pagamento"} ajuda="O comprovativo desta prestação. Os das seguintes anexam-se depois, na ficha.">
            {p => <input {...p} type="file" accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.jfif,.png,.webp" className="block text-sm"
              onChange={e => setFicheiro(e.target.files?.[0] ?? null)} />}
          </Campo>
        )}
      </div>
    </Modal>
  );
}

/** «2 prestações: 65,00 € + 65,00 €». */
export function resumoPrestacoes(valores: number[]) {
  if (!valores.length) return "";
  return valores.length === 1 ? `Pagamento de uma vez: ${eur(valores[0]!)}` : `${valores.length} prestações: ${valores.map(eur).join(" + ")}`;
}
