# GesForma — protótipo ENA

Backoffice de gestão de formação (Gold / autofinanciada e Financiada).

A ENA trata por **turma**, não por “ação de formação”. Existe um código interno (`VNG-SM-07/09`, `UFCD 3564`), mas o objeto de gestão é a turma.

O **dossiê técnico-pedagógico (DTP) vive dentro da turma** (separador no cockpit):

- **Gold / CCP** — núcleo DGERT + PIP, simulações, 5 anos de experiência, recibos
- **Financiada / UFCD** — núcleo DGERT + elegibilidade, IBAN, horas, relatório de execução

O menu **Dossiês das turmas** lista as turmas com a completude do DTP e abre o dossiê dessa turma.

## Correr localmente

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:43147](http://127.0.0.1:43147).

Atalhos na demo: cockpit da turma (Gold e Financiada) → **Dossiê da turma**; lista **Dossiês das turmas** no menu; notificações de DTP incompleto abrem a turma certa.
