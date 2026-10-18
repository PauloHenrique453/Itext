# Publicar o Itext pelo Windows

O Itext já foi publicado em https://itext-1b9da.web.app. O Supabase já recebeu as atualizações de comentários/respostas, notificações, presença, espaços, curtidas rápidas, visualizador de fotos, temas e novos formatos de stories. Para atualizar a instalação existente, use a seção **Atualizar o Itext já publicado**, ao final desta página. As etapas iniciais abaixo servem para preparar uma instalação nova.

## 1. Conferir o Node.js

Pressione **Windows + R**, digite `powershell` e pressione Enter. Na janela, execute:

```powershell
node --version
```

Use Node.js **22.13 ou mais recente**. Se o comando não existir ou a versão for anterior, instale a versão **LTS** em <https://nodejs.org/>, mantendo as opções padrão. Depois feche e abra o PowerShell novamente.

## 2. Baixar o código e publicar

Cole o bloco completo abaixo no PowerShell. Ele baixa uma versão fixa e revisada do código para uma pasta nova em Documentos, configura apenas a chave pública do Supabase, instala as dependências e inicia o login oficial do Firebase. Não altera a política de execução do Windows, não pede senha pelo chat e não modifica uma pasta existente.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Instale o Node.js LTS em https://nodejs.org/, reabra o PowerShell e tente novamente.'
    }
    $itextNodeVersion = [version](node -p 'process.versions.node')
    if ($LASTEXITCODE -ne 0 -or $itextNodeVersion -lt [version]'22.13.0') {
        throw 'Atualize o Node.js para a versao LTS e reabra o PowerShell.'
    }
    $itextDocuments = [Environment]::GetFolderPath('MyDocuments')
    if (-not $itextDocuments) { throw 'Nao foi possivel localizar a pasta Documentos.' }
    $itextSuffix = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
    $itextDestination = Join-Path $itextDocuments ('Itext-' + $itextSuffix)
    $itextZip = $itextDestination + '.zip'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/PauloHenrique453/Itext/archive/b029a1f58748732e4c75dff65f365b6076a615de.zip' -OutFile $itextZip
    Expand-Archive -LiteralPath $itextZip -DestinationPath $itextDestination
    $itextFolders = @(Get-ChildItem -LiteralPath $itextDestination -Directory)
    if ($itextFolders.Count -ne 1) { throw 'A estrutura do arquivo baixado nao era a esperada.' }
    Set-Location -LiteralPath $itextFolders[0].FullName
    $itextConfig = @(
        'VITE_SUPABASE_URL=https://qnjanobhsnvrxoraifcc.supabase.co',
        'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ca57AxlLvRBQYlXNX3NGSg_tN8iXTeW'
    ) -join [Environment]::NewLine
    Set-Content -LiteralPath '.env.independent.local' -Value $itextConfig -Encoding ascii
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'A instalacao das dependencias falhou. Copie a mensagem de erro.' }
    npx.cmd --no-install firebase login
    if ($LASTEXITCODE -ne 0) { throw 'O login do Firebase nao foi concluido.' }
    npm.cmd run deploy:firebase
    if ($LASTEXITCODE -ne 0) { throw 'A publicacao foi interrompida. Copie a mensagem de erro; nao envie tokens.' }
    Write-Host ('Pasta do projeto: ' + (Get-Location).Path)
    Write-Host 'Confira a Hosting URL retornada acima. Depois configure as URLs permitidas no Supabase.'
}
```

Quando o navegador abrir, entre com a conta Google que possui o projeto **itext-1b9da** e conclua a autorização. Se houver uma pergunta opcional sobre coleta de dados de uso ou ferramentas adicionais, você pode recusá-la; o site não precisa desses recursos. O terminal prossegue depois da conclusão do login.

O comando publica somente o Hosting. Não ativa faturamento, Functions, App Hosting nem plano Blaze. Mantenha o projeto no plano Spark.

A chave `sb_publishable_` acima é a configuração pública do aplicativo, não uma senha. Ela pode estar no cliente e continua dependendo das permissões do banco. Nunca substitua por `service_role`, `sb_secret_` ou pelo Client Secret do Google.

Se o Firebase informar que o Hosting não foi configurado, abra <https://console.firebase.google.com/>, selecione o projeto **itext-1b9da**, abra **Hosting** e conclua **Começar**, mantendo o plano Spark. Volte à pasta do projeto no PowerShell e execute `npm.cmd run deploy:firebase`.

Se algum comando falhar, pare nessa etapa e compartilhe somente o texto do erro, sem credenciais. Não altere as permissões do banco nem pule a verificação de publicação para contornar um erro.

## 3. Autorizar a URL no Supabase

Depois que o terminal confirmar o deploy, copie a **Hosting URL** exibida por ele. O endereço esperado é `https://itext-1b9da.web.app`, mas só considere publicado após o sucesso do deploy.

Em Supabase → Authentication → URL Configuration:

- **Site URL:** a origem HTTPS que o Firebase retornou.
- **Redirect URLs:** a mesma origem seguida de `/`.

A callback do Google continua sendo `https://qnjanobhsnvrxoraifcc.supabase.co/auth/v1/callback`. Não substitua essa callback pela URL do site.

## 4. Primeiro login e conta de criador

Abra a URL publicada e entre com sua própria conta Google. Sua conta aparecerá automaticamente em Supabase → Authentication → Users. Mensagens padrão já podem ser usadas sem chaves. A configuração do criador é necessária para a proteção adicional opcional.

Copie o **User UID** da sua conta e siga a seção “Ativar sua conta de criador” em [PUBLICAR-FORA-DO-CHATGPT.md](PUBLICAR-FORA-DO-CHATGPT.md). Não envie códigos de recuperação, senhas ou tokens ao chat.

Depois da publicação e da configuração, usuários entram diretamente no site. O ChatGPT e os plugins não são necessários para usar o Itext.

## Atualizar o Itext já publicado

No PowerShell, entre na mesma pasta onde publicou o Itext:

```powershell
Set-Location -LiteralPath 'C:\Users\paulo\OneDrive\Documentos\Itext-7c599abb\Itext-45ef4d1f0b6baef675f560e801851064122d37d3'
```

Cole o bloco completo abaixo. Ele baixa a versão fixa revisada, guarda uma cópia dos arquivos anteriores e atualiza a interface, o título da aba, o favicon, os scripts de publicação e a configuração de cache. Preserva `.env.independent.local`, `.firebaserc`, dependências e login do Firebase. Não precisa executar `npm ci` novamente: as dependências desta atualização são as mesmas.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    if (-not (Test-Path -LiteralPath '.firebaserc') -or -not (Test-Path -LiteralPath 'src/App.jsx')) {
        throw 'Abra a pasta do projeto Itext antes de executar este bloco.'
    }
    $itextFirebase = Get-Content -LiteralPath '.firebaserc' -Raw | ConvertFrom-Json
    if ($itextFirebase.projects.default -ne 'itext-1b9da') { throw 'Esta pasta nao corresponde ao projeto Firebase esperado.' }
    $itextTemporario = Join-Path $env:TEMP ('Itext-atualizacao-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $itextTemporario | Out-Null
    $itextArquivo = Join-Path $itextTemporario 'codigo.zip'
    $itextExtraido = Join-Path $itextTemporario 'codigo'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/PauloHenrique453/Itext/archive/b029a1f58748732e4c75dff65f365b6076a615de.zip' -OutFile $itextArquivo
    Expand-Archive -LiteralPath $itextArquivo -DestinationPath $itextExtraido
    $itextFonte = @(Get-ChildItem -LiteralPath $itextExtraido -Directory)
    if ($itextFonte.Count -ne 1) { throw 'O arquivo baixado nao tem a estrutura esperada.' }
    $itextPastas = @('src', 'scripts', 'tests', 'supabase', 'public')
    $itextArquivos = @('firebase.json', 'index.html', 'README.md', 'PUBLICAR-FORA-DO-CHATGPT.md')
    foreach ($itextItem in ($itextPastas + $itextArquivos)) {
        if (-not (Test-Path -LiteralPath (Join-Path $itextFonte[0].FullName $itextItem))) { throw ('Arquivo ausente na atualizacao: ' + $itextItem) }
    }
    $itextBackup = Join-Path $itextTemporario 'anterior'
    New-Item -ItemType Directory -Path $itextBackup | Out-Null
    foreach ($itextItem in ($itextPastas + $itextArquivos)) {
        if (Test-Path -LiteralPath $itextItem) { Copy-Item -LiteralPath $itextItem -Destination $itextBackup -Recurse }
    }
    Write-Host ('Copia dos arquivos anteriores: ' + $itextBackup)
    foreach ($itextPasta in $itextPastas) {
        if (-not (Test-Path -LiteralPath $itextPasta)) { New-Item -ItemType Directory -Path $itextPasta | Out-Null }
        Copy-Item -Path (Join-Path $itextFonte[0].FullName ($itextPasta + '\*')) -Destination $itextPasta -Recurse -Force
    }
    foreach ($itextItem in $itextArquivos) {
        Copy-Item -LiteralPath (Join-Path $itextFonte[0].FullName $itextItem) -Destination $itextItem -Force
    }
    npm.cmd run deploy:firebase
    if ($LASTEXITCODE -ne 0) { throw 'A atualizacao parou. Envie somente o erro mostrado acima, sem tokens.' }
    Write-Host 'Atualizacao publicada. Abra https://itext-1b9da.web.app'
}
```

Aguarde **Deploy complete!**. Depois abra https://itext-1b9da.web.app em uma janela anônima para conferir a página antes do login. Quem já tem uma sessão válida continua entrando diretamente na comunidade. O Google oferece seleção de conta. Outros serviços aparecem somente depois de habilitar e configurar seus respectivos provedores no Supabase; veja a seção sobre outras contas no README.

A barra lateral do computador agora permite rolar até o perfil em telas baixas, preservando o tamanho dos botões. A atualização inclui navegação para celular, tablet e computador, curtidas, seguidores, busca de pessoas, edição de perfil, mensagens não lidas, confirmação de leitura, busca no histórico carregado, emojis e aviso de nova versão. A confirmação de leitura depende de a pessoa abrir e desbloquear a conversa. O aviso de atualização funcionará para publicações futuras, após instalar esta primeira versão que contém o aviso.

O bloco não executa migrações nem altera registros ou códigos de recuperação. A migração de seguidores e leitura já foi aplicada neste projeto Supabase. A conta do criador e sua chave continuam cadastradas; não precisa criá-las novamente. Mensagens padrão funcionam sem configurar código. Somente se escolher a proteção adicional em Configurações será necessário cadastrar ou recuperar uma chave.

Foram aprovados 48 testes automatizados e o build. Ainda falta conferir a interface nos aparelhos reais e trocar mensagens entre contas reais após a publicação. Não foram criados perfis, seguidores ou mensagens fictícios.


## Configurar identificação por e-mail para recuperar PIN

Esta versão inclui em **Configurações → Segurança deste aparelho** um PIN ou senha opcional. Em **Configurações → Proteção adicional das mensagens**, a opção **Quero ativar a proteção adicional com código** vem desativada. O formulário com código só aparece quando o usuário escolhe ativá-la. As mensagens padrão funcionam sem essa configuração e são armazenadas como texto no servidor, com autenticação e permissões de acesso. Os participantes precisam ativar a opção para novas mensagens com proteção adicional; se ela estiver indisponível, o remetente escolhe explicitamente o modo padrão ou configura o acesso. O bloqueio e a chave lembrada pertencem a este navegador/aparelho. A senha local não substitui o login Google.

O botão **Esqueci meu PIN: enviar solicitação de identificação** está implementado, mas o envio precisa da configuração de e-mail no Supabase:

1. Abra [Supabase → Authentication → Email Templates](https://supabase.com/dashboard/project/qnjanobhsnvrxoraifcc/auth/templates) e escolha **Magic Link**.
2. Use o conteúdo de [supabase/email-identification.html](supabase/email-identification.html) como modelo do e-mail. O endereço do botão inclui `token_hash` e `type=email`, que o Itext valida com o Supabase antes de autorizar uma nova senha. Não altere o modelo de recuperação de senha da conta: o recurso usa o modelo Magic Link.
3. Em Authentication → Providers → Email, mantenha o provedor de e-mail habilitado para Magic Links. Google continua sendo a forma de entrada na página inicial.
4. Confira Site URL `https://itext-1b9da.web.app` e Redirect URL `https://itext-1b9da.web.app/`.
5. Para entregar e-mails a pessoas fora da equipe do Supabase, configure SMTP nas opções de e-mail do projeto. O remetente e a senha SMTP ficam apenas no painel Supabase. Não envie senha ao chat. O envio padrão do Supabase pode ser usado somente para os destinatários que ele permite; ele não deve ser anunciado como entrega garantida para todos os usuários.
6. Depois de publicar, guarde seu código de recuperação das mensagens, ative uma senha de bloqueio, recarregue e teste **Esqueci meu PIN**. Abra o link no mesmo navegador e aparelho em até 15 minutos. Confira se ele permite definir uma nova senha e se o link não pode ser usado novamente.

A entrega de e-mail e o fluxo completo em aparelho real ainda não foram testados. A verificação automatizada confirma que sessão Google existente, e-mail diferente, callback inválido e solicitação expirada não concedem autorização de redefinição. Não foi contratado nenhum serviço pago.

Redefinir o PIN remove o acesso de mensagens lembrado neste aparelho. O código guardado continua necessário para abrir as conversas uma vez e lembrar o acesso novamente. Ele não é enviado ao servidor e não é recuperado por e-mail.

Em **Configurações → Privacidade das curtidas**, cada usuário pode mostrar ou ocultar suas curtidas no perfil. Por padrão elas são privadas. A atualização do banco correspondente já foi aplicada no projeto atual; o bloco de publicação não reaplica migrações.


As verificações desta versão passaram em 48 testes e no build. A renderização do código confirma que o formulário só aparece com a opção ativada e que as conversas comuns não pedem senha/código. Ainda falta conferir os dois modos entre contas reais após publicar. A migração `20261018040725_optional_chat_protection.sql` já foi aplicada neste projeto Supabase, sem apagar ou converter mensagens e chaves. O bloco acima não reaplica migrações.


Depois de **Deploy complete!**, abra o site e recarregue. Você pode usar **Mensagens** diretamente. Para conferir a escolha opcional, abra Configurações: deverá aparecer somente a opção de proteção adicional desativada, sem o formulário de código. Uma chave antiga só é necessária para ler mensagens antigas que já tenham sido criptografadas ou para escolher o modo adicional. O PIN de bloqueio do aparelho permanece separado e opcional.


O título da aba agora é apenas **Itext**, e o favicon usa o símbolo azul da marca. Esta revisão foi compilada; o HTML gerado referencia o favicon, cujo SVG foi validado e incluído no build. O bloco de atualização acima copia também `index.html` e `public/`, necessários para essas alterações. Depois de publicar, recarregue a página; se o ícone antigo persistir, feche e reabra a aba.


## Novidades desta atualização

A migração `20261018044842_stories_requests_and_message_actions.sql` já foi aplicada ao Supabase deste projeto. O bloco **Atualizar o Itext já publicado** acima baixa a interface correspondente. Execute o bloco completo; publicar apenas a pasta antiga não instala os novos recursos.

- No início e no perfil, **Seu story** publica uma foto ou um vídeo por 24 horas. Curtidas são salvas e comentários chegam como mensagens ao dono.
- Mensagens tem **Conversas**, **Desconhecidos** com contador e **Bloqueados**. Você pode aceitar, apagar só para si, bloquear, bloquear e apagar ou desbloquear.
- **Apenas conversas** bloqueia o chat. **De tudo** também oculta posts, vídeos e stories e impede curtidas/comentários entre as contas. O perfil continua pesquisável, com foto, capa e fotos publicadas na galeria, conforme solicitado.
- Posts próprios têm **Editar** e **Apagar**, também no perfil. O menu de três pontos de cada mensagem permite responder àquela mensagem, reagir, copiar, editar o próprio envio ou escolher entre apagar só para si e apagar para todos.

O modo padrão continua sem código; a proteção adicional mantém as chaves atuais e só é usada por escolha do usuário. Os testes automatizados verificam as regras do banco e da criptografia; a conferência em aparelhos e a troca entre duas contas reais devem ser feitas depois do deploy. O lint geral não está configurado neste projeto e não foi considerado aprovado.

Stories expiram para visualização após 24 horas. A limpeza física dos arquivos não é automática e exige manutenção da franquia gratuita. O bloqueio vale para as contas envolvidas; arquivos já baixados e URLs assinadas ainda válidas não são revogados imediatamente. O README detalha esses limites. Nenhum serviço pago foi ativado.


## Incluído antes de publicar: comentários, sino e editor atualizado

Esta versão reúne os recursos anteriores e os novos pedidos. Use o mesmo bloco **Atualizar o Itext já publicado** acima: ele já está apontado para a versão completa.

- **Comentários:** ao tocar no ícone do post, abre a tela com comentários, respostas, curtidas e botão Responder. O histórico pode ser carregado por completo em páginas.
- **Mensagens e sino:** o ícone de mensagens mostra não lidas; o sino tem seu próprio contador e histórico. As notificações incluem interações recebidas reais, com opção de marcar como lidas.
- **Online/offline:** aparece na conversa. Cada aba tem seu próprio sinal; quedas de conexão podem levar até 90 segundos, mais o intervalo de consulta, para aparecer offline.
- **Perfis:** tocar no avatar de uma pessoa abre seu perfil, com publicações, fotos e curtidas conforme a privacidade dela.
- **Publicação:** editor com fotos, vídeos, áudios, arquivos, cartões de links e escolha de destino. O botão Criar usa o mesmo editor.
- **Grupos e páginas:** foto/thumbnail, capa e categoria ao criar ou editar; opções Criar categoria e Não definido.

A migração `20261018051650_comments_notifications_presence_spaces.sql` já foi aplicada ao banco. Não é preciso executar SQL ou cadastrar chaves outra vez. As notificações começam nas novas atividades reais; não foram inventadas notificações antigas. Ocultar curtidas no perfil não impede avisar ao autor que seu conteúdo foi curtido. O sistema de presença exige que as contas estejam usando esta versão.

Passaram 48 testes, build, verificações estáticas e renderização SSR. Ainda precisa conferir em aparelhos e contas reais depois de **Deploy complete!**: siga os testes da seção correspondente em PUBLICAR-FORA-DO-CHATGPT.md. A publicação continua pelo seu PowerShell, onde está o login do Firebase. Não foi ativado serviço pago.


## Nova versão: comentários corrigidos, fotos em tela cheia e temas

O bloco **Atualizar o Itext já publicado** acima agora baixa a versão completa revisada desta atualização. Rode o bloco inteiro, e não somente `npm run deploy:firebase`: é preciso copiar o código novo antes de publicar.

Inclui:

- Comentários em janela sobre a página, sem o recorte do cartão, com botão X, lista rolável, carregamento ao descer e campo de resposta fixo.
- Ajustes para celular, tablet, computador e telas grandes/TV pelo navegador; os controles de publicação continuam disponíveis nas telas pequenas.
- Fotos em tela cheia com autor/perfil, Seguir, compartilhar, Comentar e curtir. Role para ver outras fotos reais da comunidade; X ou Escape retorna à página anterior.
- Curtidas com resposta imediata, confirmação idempotente pelo banco e restauração em caso de erro.
- Quatro temas em Configurações: Branco, Cinza grafite, Black e Comum; use Salvar preferências.
- Vídeos de até 50 MB, sem limite artificial de duração. Arquivos maiores podem ser publicados por link de vídeo.
- Player oficial para links completos reconhecidos do YouTube, TikTok e Instagram. O player depende da permissão da plataforma; links curtos não resolvidos e conteúdo privado podem exigir abrir o site original.
- Stories de texto com fundos/fontes, foto, vídeo ou áudio; player de áudio com progresso e duração reais.

A migração `20261018054035_media_viewer_themes_and_story_formats.sql` já foi aplicada ao seu Supabase. O bucket continua privado e o plano gratuito continua ativo. Não é preciso executar SQL novamente ou reenviar chaves. Os dados e a chave existente foram preservados.

Passaram **54 testes**, build de produção, renderização SSR e verificações estáticas. A publicação no Firebase ainda precisa ser executada no seu PowerShell. Esta sessão não teve Browser disponível para testar cliques, tamanhos de tela, reprodução externa ou uploads em aparelhos reais.

Após aparecer **Deploy complete!**, confira:

1. Abra https://itext-1b9da.web.app, aceite Atualizar agora ou use Ctrl+F5 no computador.
2. Abra os comentários de um post: role a lista, responda e feche com X. No celular, verifique se o teclado não cobre o campo.
3. Abra uma foto: siga o autor, curta, comente, compartilhe, role para outras fotos e feche. O perfil abre tocando no nome/avatar.
4. Troque o tema em Configurações, salve e recarregue para confirmar que permaneceu salvo.
5. Publique um story de texto, outro de áudio e confira a reprodução. Teste um vídeo compatível abaixo de 50 MB e um link completo público das plataformas.
6. Confira celular na vertical/horizontal, tablet e computador; em TV, use um navegador atualizado e confira foco/rolagem pelo controle ou teclado. O Itext continua sendo um site, sem aplicativo nativo de Smart TV.


## Rodapé do story e menu lateral recolhível

O bloco **Atualizar o Itext já publicado** acima agora inclui também esta revisão. Execute o bloco completo para baixar o código novo antes do deploy.

- Tocar no círculo ou foto de story abre o story publicado. O rodapé tem Comentar, coração com contador e Compartilhar à direita; a mídia rola separadamente.
- O comentário continua sendo uma mensagem privada para o dono do story, respeitando bloqueios e a proteção escolhida.
- Compartilhar abre a opção nativa do aparelho ou copia o link do story. O link abre o story depois de entrar na conta; expiração e permissões continuam valendo.
- Ao lado do logotipo, Recolher menu lateral deixa apenas os ícones e amplia o conteúdo. Expandir restaura os nomes. A escolha permanece neste navegador; os contadores de mensagens/notificações continuam visíveis.

Não há SQL novo para executar. **56 testes**, build, SSR e verificações estáticas passaram. A sessão não teve Browser disponível para validar cliques e aparência em aparelhos reais.

Depois de **Deploy complete!**, abra o site e aceite a atualização (ou use Ctrl+F5). Confira: clicar na foto do círculo de story abre a mídia; os controles inferiores permitem comentar/curtir/compartilhar; o menu recolhe e expande sem perder navegação e conserva a escolha ao recarregar. No celular, confira os controles com o teclado aberto.


## Avatar corrigido e nova interface dos stories

O bloco **Atualizar o Itext já publicado** está apontado para a revisão que corrige o avatar esticado e reformula o story. Execute o bloco completo: ele baixa o código novo, guarda a cópia anterior e faz o deploy. Executar apenas `npm.cmd run deploy:firebase` usa os arquivos que já estão na sua pasta.

O story tem um cartão vertical, foto circular e nome no topo, indicadores clicáveis, mídia em destaque, navegação discreta e ações na parte inferior. A criação ganhou opções com ícones e prévia. O celular usa a tela disponível; no computador o story fica centralizado. Nome e imagem continuam abrindo o perfil dentro da visualização; o círculo da lista abre o story.

Build, verificações estáticas, SSR e testes focados passaram. Não foi possível testar o visual em Browser nesta sessão. Após **Deploy complete!**, aceite Atualizar agora ou use Ctrl+F5 e confira se o avatar continua circular, a foto/vídeo inteira aparece, o rodapé fica acessível com o teclado aberto e os segmentos/setas trocam o story. Não é preciso SQL ou instalar dependências outra vez.


## Ishort: publicar e assistir vídeos de até 10 minutos

O bloco **Atualizar o Itext já publicado** acima agora baixa o novo Ishort e todas as correções anteriores dos stories. Use o bloco deste guia atualizado: comandos antigos podem baixar versões anteriores. Execute na pasta que contém `.firebaserc` do projeto **itext-1b9da**. Não precisa executar npm ci, trocar chaves ou aplicar SQL.

O Ishort tem:

- Feed vertical com um vídeo ativo por vez, rolagem e botões para trocar de vídeo.
- Abas Explorar e Seguindo, paginação e botão Atualizar vídeos.
- Publicar vídeo com prévia, legenda e verificação de até **10 minutos e 50 MB**. MP4/H.264/AAC é recomendado; vertical é recomendado, horizontal também funciona.
- Controles reais de pausa/reprodução, som, progresso e tela cheia quando o navegador permitir. Começa sem som; toque em Ativar som. Quando autoplay não for permitido, toque em reproduzir.
- Curtidas, comentários/respostas, compartilhar, seguir e abrir o perfil, usando a mesma publicação que aparece no perfil.
- Pausa ao sair da tela, ocultar a aba ou abrir uma janela de comentários/publicação.

A aba começa vazia até existir publicação feita por **Publicar vídeo**, sem vídeos fictícios. Vídeos comuns já existentes no feed não foram reclassificados como Ishort. Vídeos mais longos continuam no feed normal. O limite de 50 MB vem do plano gratuito; não houve ativação de cobrança, compressão ou transcodificação.

Depois de **Deploy complete!**, abra https://itext-1b9da.web.app e aceite Atualizar agora ou use Ctrl+F5. Entre no Ishort pelo menu e faça esta conferência:

1. Publique um vídeo compatível abaixo de dez minutos/50 MB e confira se aparece no Ishort e no perfil.
2. Teste tocar para pausar/reproduzir, ativar som, mover o progresso e tela cheia.
3. Com dois vídeos reais, role para trocar e confira que apenas o visível continua tocando. Abra comentários e oculte a aba para conferir a pausa.
4. Com outra conta real, siga o autor, curta, comente e abra o link compartilhado. O comentário é público no post, diferente da resposta privada de story.
5. Confira a aba Seguindo, celular vertical/horizontal, tablet e computador. O botão Atualizar vídeos busca novas publicações.

Passaram **62 testes**, build de produção, verificações estáticas e SSR dos controles. Browser não tem ferramenta de execução disponível nesta sessão; a imagem apresentada foi referência de design e não captura do site em execução. Reprodução, uploads, rolagem e tamanho visual nos aparelhos ainda precisam desta conferência após publicar. O README detalha as verificações e os limites.
