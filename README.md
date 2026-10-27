# Urna eletrônica escolar (rede local)

Projeto independente de urna escolar, inspirado no visual da urna brasileira. **Não é software do TSE** e não deve ser usado em eleições oficiais.

## Recursos

- Cédula para chapas de **2 dígitos**, com BRANCO, CORRIGE, CONFIRMA e voto nulo.
- Vários computadores de votação na rede local, acessando **o mesmo servidor central**.
- Contabilização central persistida em `dados/votos.json`, incluindo votos em branco e nulos.
- Votação direta, sem PIN: após exibir FIM por três segundos, a urna fica pronta para o próximo aluno.
- Sons de tecla e de confirmação gerados no navegador, sem arquivos externos.
- Imagem de cada chapa no visor ao digitar seu número, mantendo o cartaz inteiro e suas proporções.
- Apuração administrativa protegida por senha, exportação CSV e encerramento definitivo.
- Nova eleição pelo painel após encerrar a anterior, com backup automático dos votos e da configuração.
- Não armazena nomes de eleitores nem vincula votos a estudantes.
- Sem bibliotecas externas: requer apenas Node.js >= 20.

## Instalação no Windows

1. Instale a versão LTS do Node.js em https://nodejs.org/ no computador que será o **servidor**.
2. Antes da primeira eleição, configure o título e as chapas em `config.json`. Os números devem ser textos entre aspas, com **exatamente 2 dígitos**, como `"01"`, e não podem repetir. Salve o arquivo. Não altere o banco `dados/votos.json` para cadastrar chapas.
3. Dê duplo clique em `INICIAR-WINDOWS.bat`. Crie uma senha administrativa forte (mínimo 8 caracteres).
4. No console aparecerá o endereço do computador servidor (exemplo: `http://192.168.1.20:3000`). **Não é necessariamente esse endereço; use o mostrado na sua máquina.**
5. Se o Firewall do Windows solicitar, autorize o Node.js somente na **rede privada** da escola.
6. Nos seis computadores de votação, conectados à mesma rede, abra **o mesmo endereço** no navegador. Não copie o servidor nem inicie servidores independentes nos terminais.
7. No computador da comissão, abra `http://ENDERECO-DO-SERVIDOR:3000/admin.html`.

Mantenha a janela do servidor aberta durante a votação. Os computadores de votação só precisam do navegador; o Node.js é necessário no servidor.

Se já existir uma eleição salva, o servidor carrega a contagem e a situação anteriores. Abrir o iniciador **não zera os votos nem reabre uma eleição encerrada**.

## Baixar e usar em outro computador

1. No GitHub, abra o repositório do projeto. Se ele for privado, entre na conta que tem acesso.
2. Clique em **Code > Download ZIP** e extraia o arquivo para uma pasta local.
3. Instale Node.js 20 ou superior no computador que será o servidor.
4. Entre na pasta que contém `INICIAR-WINDOWS.bat`, confira as chapas em `config.json` e abra o iniciador.
5. Informe uma senha administrativa de pelo menos oito caracteres. Ela será usada no painel dessa execução.
6. Use o endereço de rede mostrado no console para conectar os computadores de votação ao mesmo servidor.

As três imagens das chapas estão incluídas no projeto. Os dados e backups de eleições, as senhas e as dependências locais não são enviados ao GitHub. A pasta `dados` e o arquivo `dados/votos.json` são criados automaticamente, com contagem zerada, na primeira inicialização.

Baixar o projeto em outro computador inicia uma instalação independente; isso não transfere uma eleição em andamento. Para continuar usando a mesma contagem, os terminais devem acessar o servidor que mantém essa eleição. Mantenha os resultados e backups fora do repositório, conforme o `.gitignore`.

## Após atualizar o projeto

1. Aguarde até que nenhum aluno esteja confirmando voto.
2. Pare a versão antiga do servidor com **Ctrl + C** na janela do Prompt de Comando.
3. Abra `INICIAR-WINDOWS.bat` novamente e informe a senha administrativa.
4. Pressione **Ctrl + F5** no painel de apuração e em todos os navegadores de votação.

Essa reinicialização serve para carregar alterações no programa. Depois de instalar a atualização, a troca entre eleições com as mesmas chapas é feita pelo painel, sem reiniciar o servidor.

## Como votar

1. A comissão confere o eleitor na lista de presença. A urna já fica pronta para votar, sem PIN.
2. Aluno digita o número da chapa no teclado virtual ou físico.
3. Se o número não corresponder a chapa cadastrada, a tela indica voto nulo.
4. BRANCO marca um voto branco; CORRIGE reinicia a escolha; CONFIRMA registra o voto.
5. Após o servidor confirmar o registro, a urna toca o som de conclusão e mostra FIM por três segundos. Em seguida, fica pronta para o próximo aluno.

No teclado físico, use os números para escolher a chapa, **Backspace** para corrigir e **Enter** para confirmar. Para votar em branco, clique em **BRANCO** e depois em **CONFIRMA**. Confirmar sem preencher os dois dígitos não registra voto, exceto quando BRANCO foi selecionado.

Mantenha o volume do computador ligado. O som é ativado ao interagir com as teclas da urna e depende do suporte do navegador à Web Audio API. Se o áudio estiver indisponível, a votação continua funcionando.

## Imagens das chapas

Os cartazes ficam em `public/imagens/` e aparecem junto ao nome quando o aluno digita os dois números de uma chapa cadastrada. A associação atual é:

| Número | Chapa | Imagem |
| --- | --- | --- |
| 01 | Heróis do Grêmio | `public/imagens/chapa-01.jpeg` |
| 02 | Unidos pela Escola | `public/imagens/chapa-02.jpeg` |
| 03 | Caminho Brilhante | `public/imagens/chapa-03.jpeg` |

O campo opcional `imagem` em cada chapa de `config.json` indica o endereço usado pelo navegador, por exemplo: `"imagem": "/imagens/chapa-01.jpeg"`. São aceitos arquivos JPEG, PNG e WebP nessa pasta, com nomes contendo letras sem acentos, números, pontos, hífens ou sublinhados.

Para substituir um cartaz, copie a nova imagem para essa pasta e mantenha o caminho correto na configuração. Se alterar `config.json`, reinicie o servidor para carregar a configuração. Depois pressione **Ctrl + F5** nos navegadores. Não é necessário zerar os votos para adicionar imagens às mesmas chapas. Chapas sem imagem continuam funcionando normalmente; branco e nulo não exibem cartaz.

## Painel de apuração

No próprio servidor, abra **http://localhost:3000/admin.html**. Em outro computador, substitua `localhost` pelo endereço IP do servidor, usando o mesmo endereço das urnas e acrescentando `/admin.html`.

1. Digite a senha administrativa informada ao iniciar o servidor nessa execução.
2. Clique em **Atualizar apuração** para consultar a situação, os votos por chapa, brancos, nulos e o total.
3. Clique em **Exportar resultado CSV** para baixar a tabela consultada.

A apuração não se atualiza continuamente: clique em **Atualizar apuração** antes de exportar para obter a contagem mais recente. O painel não mostra o voto de cada aluno.

## Encerrar uma eleição

1. Aguarde a conclusão das votações nos terminais.
2. No painel, clique em **Encerrar definitivamente a votação** e confirme.
3. Confira a situação **ENCERRADA** e exporte o resultado em CSV.

O encerramento impede novos votos nessa eleição e permanece salvo mesmo depois de fechar e reabrir o servidor. As urnas conectadas mostram o encerramento na próxima consulta ao servidor, normalmente em até três segundos.

## Iniciar uma nova eleição pelo painel

1. Acesse o painel, informe a senha e clique em **Atualizar apuração**.
2. Se a eleição estiver aberta, encerre-a primeiro. Se já estiver encerrada, não é necessário encerrá-la novamente.
3. Exporte o resultado anterior em CSV, se desejar guardá-lo também nesse formato.
4. Clique em **Iniciar nova eleição**, disponível após consultar uma eleição encerrada.
5. Confirme a criação da nova eleição com zero votos.
6. Confira a situação **ABERTA**, o total **0** e a mensagem com a localização do backup.

Antes de zerar a contagem, o sistema salva o resultado anterior e sua configuração em uma pasta própria dentro de `dados/backups/`. Cada pasta contém:

- `votos.json`: contagem e estado da eleição anterior.
- `config-salva.json`: título e chapas usados naquela eleição.

Se o backup ou a gravação da nova contagem falhar, a eleição anterior é mantida e o painel apresenta uma mensagem de erro.

A nova eleição usa **as mesmas chapas e nomes carregados no servidor**. As urnas conectadas reconhecem a troca na próxima consulta, limpam as escolhas pendentes e ficam prontas para votar, normalmente em até três segundos. Votos enviados com o identificador da eleição anterior são rejeitados.

**Não é necessário apagar arquivos, editar o código ou reiniciar o servidor entre essas eleições.** O botão não cadastra novas chapas nem carrega alterações feitas em `config.json` com o servidor ligado. Não altere as chapas durante uma eleição.

## Pausar e continuar a mesma eleição

Para fazer apenas uma pausa, **não clique em Encerrar definitivamente a votação nem em Iniciar nova eleição**.

1. Aguarde até que nenhum aluno esteja confirmando voto.
2. Feche o servidor com **Ctrl + C** na janela do Prompt de Comando.
3. Preserve `dados/votos.json` e mantenha as chapas de `config.json` sem alterações.
4. Para continuar, execute `INICIAR-WINDOWS.bat` e informe a senha administrativa que será usada nessa execução.
5. Atualize as páginas das urnas e consulte o painel para conferir a contagem.

O servidor carrega os votos salvos e mantém a situação da eleição. Uma eleição aberta continua aberta; uma encerrada continua encerrada. Se o IP do servidor mudar, use o novo endereço nos outros computadores.

## Problemas comuns

| Situação | O que fazer |
| --- | --- |
| A urna mostra ELEIÇÃO ENCERRADA | Para outra eleição, use **Iniciar nova eleição** no painel. Reabrir o servidor sozinho não muda a situação. |
| O botão Iniciar nova eleição está desabilitado | Digite a senha e clique em **Atualizar apuração**. O botão só é habilitado quando a eleição consultada está encerrada. |
| O botão novo não aparece ou os terminais não reconhecem a nova eleição | Após uma atualização do programa, reinicie o servidor e pressione **Ctrl + F5** no painel e nas urnas. |
| A urna não emite som | Confira o volume, o dispositivo de saída e se a aba está silenciada. Interaja com uma tecla da urna para ativar o áudio. |
| A urna não consegue se conectar | Confira se a janela do servidor está aberta, se o endereço está correto e se os computadores estão na mesma rede. |
| O iniciador não encontra o Node.js | O iniciador procura também nas pastas padrão de instalação do Windows. Se continuar falhando, instale Node.js 20 ou superior e abra novamente o iniciador. |
| A porta 3000 já está em uso | O servidor pode já estar aberto em outra janela. Acesse a urna existente ou feche o servidor anterior com **Ctrl + C** antes de abrir outro. |
| O painel informa senha incorreta | Use a senha digitada na inicialização atual do servidor. |
| O servidor informa que a configuração de chapas mudou | O cadastro não corresponde ao banco salvo. Restaure a configuração dessa eleição; não altere os números no banco para tentar corrigir. |
| A criação da nova eleição falha | Verifique espaço livre e permissão de escrita na pasta `dados`. A votação anterior deve ser preservada; confira a apuração antes de tentar novamente. |

## Procedimentos essenciais

- **Atenção:** a urna permite votos consecutivos sem liberação. A comissão precisa supervisionar os terminais e manter uma lista separada para garantir que cada aluno vote **uma única vez**, mesmo que mude de computador.
- Mantenha o servidor ligado e conectado à rede por toda a votação. Faça backup de `dados/votos.json` quando for apropriado e proteja esse arquivo de modificações.
- Use rede interna confiável, preferencialmente isolada da rede dos estudantes. Este protótipo usa HTTP sem criptografia e não é adequado para acesso pela Internet. Credenciais podem ser interceptadas em redes não confiáveis.
- Faça testes com todas as urnas e simule uma queda de rede **antes** da eleição oficial. Os testes devem ocorrer com banco de dados separado.
- Não altere as chapas depois de começar a votação. Após encerrar, use o CSV e a ata da comissão eleitoral.
- Em uma eleição real com centenas de alunos, faça validação independente do código e do procedimento de apuração. Este projeto é um protótipo educacional, não um sistema de votação certificado/auditado.

## Estrutura

- `server.js`: servidor HTTP local e contagem centralizada.
- `config.json`: cadastro de chapas e título da eleição.
- `public/index.html`, `public/style.css`, `public/urna.js`: interface da urna.
- `public/admin.html`, `public/admin.js`: apuração administrativa.
- `dados/votos.json`: criado automaticamente na primeira inicialização.
- `dados/backups/`: resultados e configurações arquivados ao iniciar novas eleições pelo painel.
- `tests/`: testes automatizados com dados simulados, sem modificar os votos da eleição em uso.

## Verificação automática

Com Node.js instalado, abra o terminal na pasta `urna-gremio` e execute:

```powershell
npm test
```

Os testes verificam votação, teclas, sons, encerramento e criação de novas eleições, incluindo proteção por senha e falhas de backup. Antes do uso com alunos, faça também um ensaio nos computadores reais, em uma eleição de teste separada da definitiva.
