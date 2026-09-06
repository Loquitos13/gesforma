# GesForma — protótipo ENA

Backoffice de gestão de formação (Gold / autofinanciada e Financiada).

A ENA trata por **turma**, não por “ação de formação”. Existe um código interno (`VNG-SM-07/09`, `UFCD 3564`), mas o objeto de gestão é a turma.

O **dossiê técnico-pedagógico (DTP) vive dentro da turma** (separador no cockpit):

- **Gold / CCP** — núcleo DGERT + PIP, simulações, 5 anos de experiência, recibos
- **Financiada / UFCD** — núcleo DGERT + elegibilidade, IBAN, horas, relatório de execução

O menu **Dossiê TP** lista as turmas com a completude do dossiê e abre o DTP dessa turma.

**Inquéritos** (Gold e Financiada) permitem montar questionários de satisfação com texto, escolha múltipla, escala 1–5 e sim/não.

No cockpit da turma: plano de sessão completo (introdução / desenvolvimento / conclusão), folha de presenças por sessão, perfil do formador com documentos, e upload de certificados.

## Correr localmente

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:43147](http://127.0.0.1:43147).
