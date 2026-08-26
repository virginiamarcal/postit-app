# Som do lembrete

O gatinho mia baixinho quando o lembrete de água aparece. O miado já vem junto
com o programa — não precisa fazer nada.

- **Arquivo:** `miau.mp3`
- **Origem:** [Pixabay](https://pixabay.com/sound-effects/), por *sound_garage*
- **Licença:** [Pixabay Content License](https://pixabay.com/service/license-summary/)
  — livre para uso comercial e para redistribuir junto com um programa, sem
  precisar dar crédito.

O volume já sai baixo (35%) por código, então não precisa editar o arquivo.

## Colocar o seu miado no lugar

Dá para trocar pelo miado do seu gato, ou por qualquer som que você preferir.
Salve um MP3 chamado **`miau.mp3`** na pasta de dados do app: cole
`%APPDATA%\Post-it` na barra de endereço do Explorador de Arquivos e jogue o
arquivo lá dentro.

O que estiver ali **vence** o que veio junto com o programa — e continua lá
quando você atualizar para uma versão nova. Para voltar ao miado original, é só
apagar esse arquivo.

Prefira um miau **curto, de menos de 1 segundo**, e agudo: miado longo cansa
quando toca várias vezes por dia.

Quem roda pelo código pode trocar direto em `assets/sounds/miau.mp3`, mas aí
cuidado para não commitar áudio de terceiros — veja o aviso abaixo.

Depois é só reabrir o post-it. O botão 💧 → **"Ver como fica"** testa na hora.

## Cuidado: grátis para baixar ≠ livre para distribuir

São duas permissões diferentes, e é fácil confundir.

Sites de toque de celular (Zedge e parecidos) deixam **baixar** de graça, mas os
termos deles não permitem **redistribuir** — e boa parte do acervo é enviada por
usuários, muita coisa com dono. Um som desses pode ficar na sua máquina sem
problema nenhum; o que não pode é seguir junto num projeto público, porque aí
você passa a distribuí-lo para todo mundo que baixar.

Por isso o `.gitignore` barra `*.mp3` nesta pasta, abrindo exceção só para o
`miau.mp3` que veio do Pixabay. E o empacotador lista esse arquivo pelo nome, em
vez de levar a pasta inteira: som pessoal largado aqui não entra no instalador
nem por acidente.

Onde achar som realmente livre:

- [Pixabay Sounds](https://pixabay.com/sound-effects/search/cat/) — livre
  inclusive para redistribuir, sem precisar dar crédito
- [Freesound](https://freesound.org/search/?q=kitten+meow) — procure os marcados
  **CC0**
