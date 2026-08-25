# Post-it 🐱

Um post-it de lembretes para Windows que fica na barra de tarefas e **pisca quando há tarefa pendente no dia** — para não precisar lembrar de conferir, nem deixar uma nota aberta por cima das outras janelas.

![post-it com gatinho](assets/skins-src/gatinho-laranja.png)

## O que faz

- **Alerta na barra de tarefas.** Havendo pendência para hoje, o botão do app pisca em laranja e ganha um selo vermelho sobre o ícone. O ícone da bandeja (perto do relógio) também pisca.
- **Painel do dia.** Um clique abre o post-it sobre as janelas, com as tarefas de hoje e um campo para adicionar novas.
- **Fixar na tela 📌.** Por padrão a nota sai da frente sozinha ao clicar fora. Fixada, ela fica presa por cima das janelas até você desafixar — e volta no mesmo canto onde foi largada.
- **Agenda.** Toda tarefa tem data; o horário é opcional — "qualquer horário" ou uma hora marcada.
- **Notificação do Windows.** Tarefa com horário definido dispara um toast na hora marcada.
- **Quadro "Ver todos".** Mostra os agendamentos futuros como post-its espalhados, que podem ser arrastados e ficam onde você soltar.
- **Inicia com o Windows** (pode ser desligado no menu do ícone da bandeja).

## Como rodar

Precisa de [Node.js](https://nodejs.org) instalado.

```bash
npm install
npm start
```

## Trocar o papel do post-it 🐾

Ninguém tem um gato só. Dá para ter vários papéis e trocar quando quiser — pelo
botão 🐾 no post-it ou pelo menu **Trocar o papel** no ícone da bandeja. O ícone
na barra de tarefas muda junto.

### Adicionar um papel novo

1. Jogue o PNG em `assets/skins-src/`. O nome do arquivo vira o nome do papel
   (`gatinho-cinza.png` → "Gatinho cinza").
2. Rode:

   ```powershell
   powershell -File scripts/build-skins.ps1
   ```

3. Reinicie o app.

O script **encontra sozinho** onde fica o papel dentro da arte e recorta as três
fatias (topo com o bichinho, meio esticável, base com a dobrinha), mais as
miniaturas e os ícones. Não é preciso medir nada na mão.

O nome que aparece no menu sai de `assets/skins-src/names.json` (o nome do arquivo
vira identificador e não pode ter acento; o `names.json` é onde mora o nome
bonito). Sem entrada lá, o script usa o próprio nome do arquivo.

**A arte precisa ser:** um PNG **com fundo transparente**, com o bichinho em cima
e o papel embaixo ocupando quase toda a largura — é assim que o script separa um
do outro.

### Se a arte vier com o xadrez pintado

Geradores de imagem às vezes exportam o quadriculado cinza como pixel de verdade,
em vez de transparência — na tela parece igual, mas o recorte não funciona. O
sintoma é o `build-skins.ps1` reportar o papel ocupando a imagem inteira
(`papel x 0..<largura>`). Conserto:

```powershell
powershell -File scripts/fix-transparency.ps1 -Path assets/skins-src/arte.png
```

O fundo é apagado por preenchimento a partir das bordas, então só sai o que está
ligado ao contorno. O original é guardado ao lado como `arte.original.png`.

⚠️ **É um remendo, não substitui alfa de verdade.** Funciona bem em desenho com
contorno definido. Em **foto real** o pelo branco claro (patinha, queixo) se
dissolve no fundo sem fronteira nítida, e o preenchimento atravessa a beirada e
come o pelo por dentro. Se a arte for foto, peça ao gerador um PNG com fundo
transparente em vez de usar o script — e confira o resultado abrindo o PNG sobre
um fundo colorido antes de gerar as fatias.

Se numa arte a dobrinha do canto ficar por baixo dos botões, ajuste `curl` (em
pixels da arte original) no papel correspondente dentro de
`assets/skins/skins.json`. Valor maior afasta mais o conteúdo do canto.

## Uso

| Ação | Como |
|---|---|
| Abrir o post-it | Clicar no ícone do gatinho na barra de tarefas ou na bandeja |
| Fechar / sair da frente | Clicar fora, ou no ✕ — minimiza e continua na barra |
| Fixar / desafixar | Botão 📌 no post-it (fica laranja quando fixado) ou o menu da bandeja |
| Trocar o papel | Botão 🐾 no post-it, ou **Trocar o papel** no menu da bandeja |
| Nova tarefa | Digitar, escolher a data, marcar `hora?` se tiver horário, e Adicionar |
| Concluir | Clicar na bolinha ao lado da tarefa |
| Ver agendamentos futuros | Botão **Ver todos** |
| Iniciar com o Windows / Sair | Botão direito no ícone da bandeja |

## Onde ficam os dados

As tarefas ficam em `tasks.json`, dentro da pasta de dados do app no Windows
(`%APPDATA%/Post-it/`). Nada sai da máquina — não há servidor nem conta.

## Estrutura

```
main.js                  processo principal: bandeja, barra de tarefas, alertas, notificações
preload.js               ponte segura entre a interface e o processo principal
store.js                 persistência das tarefas em JSON
renderer/skin.js         traduz as medidas do papel escolhido em variáveis de CSS
renderer/panel.*         painel "Hoje" (janela transparente)
renderer/board.*         quadro com os post-its espalhados
scripts/build-skins.ps1  detecta e recorta os papéis a partir de assets/skins-src
assets/skins-src/        as artes originais (PNG com fundo transparente)
assets/skins/            fatias, miniaturas, ícones e o manifesto skins.json
```

Cada arte é fatiada em três — topo (o bichinho), meio (esticável) e base (a
dobrinha) — para a nota crescer conforme a lista sem distorcer o desenho. O
manifesto guarda as medidas em pixels da arte original, e a interface converte
para proporção na hora de desenhar; é isso que faz qualquer arte funcionar sem
ajuste manual.
