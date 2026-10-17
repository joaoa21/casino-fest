# Casino Fest

Cassino de brincadeira que roda direto no navegador, sem servidor, sem build e sem dinheiro de verdade.
As fichas são uma carteira única salva no próprio navegador e valem em todos os jogos.

**Site:** https://joaoa21.github.io/casino-fest/

## Jogos

| Jogo | Página | Resumo |
| --- | --- | --- |
| Poker Fest | `poker.html` | Texas Hold'em sem limite contra 3 adversários com estilos diferentes |
| Blackjack | `blackjack.html` | 6 baralhos, seguro, dobrar e dividir; blackjack paga 3:2 |
| Roleta Europeia | `roleta.html` | Um zero só, roda em 3D (Three.js) |
| Bac Bo | `bacbo.html` | Dados no estilo bacará, copos em 3D com física (cannon-es) |
| Paciência | `paciencia.html` | Klondike nos modos Clássico e Vegas |
| Rei da Fortuna | `fortuna.html` | Slot 3×3 com bônus surpresa |
| Rei da Folia | `folia.html` | Slot 6×5, cascatas e bolas de multiplicador |
| Coroa da Sorte / Sete Clássico | `maquinas.html` | Slots de 5 e 3 rolos |
| Space Fest | `crash.html` | Crash: retire antes de o astronauta sumir |

## Como rodar

É um site estático: basta servir a pasta com qualquer servidor de arquivos, por exemplo:

```bash
npx serve .
```

Abrir os arquivos direto do disco (`file://`) não funciona para a roleta e o Bac Bo, que carregam módulos por `import`.

## Estrutura

- `casino.js` + `style.css`: base compartilhada (cabeçalho, carteira, cartas, fichas, sons, avisos).
- `<jogo>.html` / `<jogo>.js` / `<jogo>.css`: cada jogo.
- `*-math.js`: a matemática dos slots, separada da tela para ser simulada no Node.
- `rei.js`: o rei animado em 2D (Rei da Folia e Rei da Fortuna).
- `avatars/`, `crash/`, `folia/`, `fortuna/`, `lobby/`: imagens.

Os resultados de cada rodada são sorteados com `crypto.getRandomValues` e decididos antes da animação.
