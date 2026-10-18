# Publicar o Itext pelo Windows

O Itext já foi publicado em https://itext-1b9da.web.app. O Supabase recebeu também a atualização de seguidores e leitura de mensagens. Para atualizar a instalação existente, use a seção **Atualizar o Itext já publicado**, ao final desta página. As etapas iniciais abaixo servem para preparar uma instalação nova.

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
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/PauloHenrique453/Itext/archive/dc6327f177827b3b0d085814d136b76c1d9a7caf.zip' -OutFile $itextZip
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

Abra a URL publicada e entre com sua própria conta Google. Sua conta aparecerá automaticamente em Supabase → Authentication → Users. O chat continua bloqueado até selecionar essa conta e ativar a chave do criador.

Copie o **User UID** da sua conta e siga a seção “Ativar sua conta de criador” em [PUBLICAR-FORA-DO-CHATGPT.md](PUBLICAR-FORA-DO-CHATGPT.md). Não envie códigos de recuperação, senhas ou tokens ao chat.

Depois da publicação e da configuração, usuários entram diretamente no site. O ChatGPT e os plugins não são necessários para usar o Itext.

## Atualizar o Itext já publicado

No PowerShell, entre na mesma pasta onde publicou o Itext:

```powershell
Set-Location -LiteralPath 'C:\Users\paulo\OneDrive\Documentos\Itext-7c599abb\Itext-45ef4d1f0b6baef675f560e801851064122d37d3'
```

Cole o bloco completo abaixo. Ele baixa a versão fixa revisada, guarda uma cópia dos arquivos anteriores e atualiza a interface, os scripts de publicação e a configuração de cache. Preserva `.env.independent.local`, `.firebaserc`, dependências e login do Firebase. Não precisa executar `npm ci` novamente: as dependências desta atualização são as mesmas.

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
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/PauloHenrique453/Itext/archive/dc6327f177827b3b0d085814d136b76c1d9a7caf.zip' -OutFile $itextArquivo
    Expand-Archive -LiteralPath $itextArquivo -DestinationPath $itextExtraido
    $itextFonte = @(Get-ChildItem -LiteralPath $itextExtraido -Directory)
    if ($itextFonte.Count -ne 1) { throw 'O arquivo baixado nao tem a estrutura esperada.' }
    $itextPastas = @('src', 'scripts', 'tests', 'supabase')
    $itextArquivos = @('firebase.json', 'README.md', 'PUBLICAR-FORA-DO-CHATGPT.md')
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

O bloco não executa migrações nem altera registros ou códigos de recuperação. A migração de seguidores e leitura já foi aplicada neste projeto Supabase. A conta do criador e sua chave continuam cadastradas; não precisa criá-las novamente. Para abrir mensagens, use seu código guardado no local seguro.

Foram aprovados 22 testes automatizados e o build. Ainda falta conferir a interface nos aparelhos reais e trocar mensagens entre contas reais após a publicação. Não foram criados perfis, seguidores ou mensagens fictícios.
