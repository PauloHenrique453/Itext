# Publicar o Itext pelo Windows

O banco do projeto Supabase já recebeu a estrutura social, a criptografia e o ajuste de permissões. O código está preparado para Firebase Hosting clássico no projeto `itext-1b9da`. A publicação ainda precisa ser concluída com a conta Google dona desse projeto.

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
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/PauloHenrique453/Itext/archive/45ef4d1f0b6baef675f560e801851064122d37d3.zip' -OutFile $itextZip
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
