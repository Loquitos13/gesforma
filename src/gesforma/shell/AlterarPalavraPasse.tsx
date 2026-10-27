// «Alterar palavra-passe» da conta autenticada (equipa e formadores): a actual e a nova, com as regras da plataforma.
// As outras sessões abertas da conta fecham (o servidor trata disso); esta fica.
import { useEffect, useState } from "react";
import { apiAlterarMinhaPalavraPasse } from "../../partilhado/api";
import { errosPalavraPasse } from "../../partilhado/passwordPolicy";
import { toastOk } from "../../partilhado/toastBus";
import { Aviso, Botao, Campo, Entrada, Modal } from "../../partilhado/ui";

export function AlterarPalavraPasse({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState("");
  const [aGravar, setAGravar] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setAtual(""); setNova(""); setRepetir(""); setErro("");
  }, [aberto]);

  const faltas = nova ? errosPalavraPasse(nova) : [];

  async function gravar() {
    if (!atual) { setErro("Escreva a palavra-passe actual."); return; }
    if (faltas.length || !nova) { setErro(`A palavra-passe nova tem de incluir ${errosPalavraPasse(nova).join(", ")}.`); return; }
    if (nova !== repetir) { setErro("As duas palavras-passe novas não são iguais."); return; }
    if (nova === atual) { setErro("A palavra-passe nova tem de ser diferente da actual."); return; }
    setErro("");
    setAGravar(true);
    try {
      await apiAlterarMinhaPalavraPasse(atual, nova);
      toastOk("Palavra-passe alterada. As outras sessões abertas desta conta foram terminadas.");
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar a palavra-passe.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Alterar palavra-passe" largura="sm"
      rodape={<>
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao variante="primario" aCarregar={aGravar} onClick={() => void gravar()}>Alterar</Botao>
      </>}>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); void gravar(); }}>
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        <Campo rotulo="Palavra-passe actual">
          {p => <Entrada {...p} type="password" autoComplete="current-password" value={atual} onChange={e => setAtual(e.target.value)} />}
        </Campo>
        <Campo rotulo="Palavra-passe nova" ajuda={faltas.length ? `Falta: ${faltas.join(", ")}.` : "Pelo menos 10 caracteres, com maiúscula, minúscula, algarismo e símbolo."}>
          {p => <Entrada {...p} type="password" autoComplete="new-password" value={nova} onChange={e => setNova(e.target.value)} />}
        </Campo>
        <Campo rotulo="Repetir a palavra-passe nova">
          {p => <Entrada {...p} type="password" autoComplete="new-password" value={repetir} onChange={e => setRepetir(e.target.value)} />}
        </Campo>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
