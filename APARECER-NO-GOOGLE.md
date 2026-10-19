# Encontrar o Itext no Google e no Bing

O endereço gratuito **https://itext-1b9da.web.app/** pode ser indexado. Não precisa comprar domínio nem pagar anúncios. A preparação técnica não garante inclusão, posição ou prazo nos resultados: cada buscador decide quando rastrear e indexar. Pesquisar “Itext” também encontra produtos com nomes semelhantes.

## Primeiro: publicar esta versão

Use o bloco completo **Atualizar o Itext já publicado** de [PUBLICAR-NO-WINDOWS.md](PUBLICAR-NO-WINDOWS.md). Depois de **Deploy complete!**, confira no navegador:

- https://itext-1b9da.web.app/ — página pública de apresentação do Itext, com título **Itext**.
- https://itext-1b9da.web.app/robots.txt — deve mostrar o endereço do sitemap, não a tela do aplicativo.
- https://itext-1b9da.web.app/sitemap.xml — deve mostrar uma lista XML contendo a página inicial.

O build gera HTML público com o nome e a descrição do Itext antes do JavaScript, endereço canônico, dados estruturados WebSite e metadados de compartilhamento. Somente a apresentação pública entra no sitemap. Perfis, mensagens, stories e links com parâmetros de login não são listados. Isso não muda as permissões do banco nem publica conteúdo privado.

## Verificação por arquivo HTML já preparada para este Itext

O arquivo original enviado pelo proprietário foi incluído como `public/google26f7c0968812bad2.html`, com o nome e os 53 bytes preservados. O build copia esse arquivo para a raiz publicada. Mantenha-o no projeto e nos próximos deploys para conservar a verificação.

1. Execute o bloco completo **Atualizar o Itext já publicado** do guia do Windows. Aguarde **Deploy complete!**.
2. Abra https://itext-1b9da.web.app/google26f7c0968812bad2.html. Deve aparecer somente `google-site-verification: google26f7c0968812bad2.html`. Se aparecer a página de entrada do Itext, o arquivo ainda não chegou à hospedagem; confira se atualizou o código antes do deploy.
3. Volte ao Search Console, selecione a propriedade **https://itext-1b9da.web.app/** e conclua o método **Arquivo HTML** com **Verificar**. Para esse método, não precisa configurar a variável de tag HTML descrita abaixo.
4. Após confirmar a propriedade, envie o sitemap e solicite a indexação, conforme os passos 5 e 6 da seção seguinte.

O arquivo foi validado no pacote de publicação. A confirmação na hospedagem e na conta Google depende do deploy e do clique em Verificar; não foi feita automaticamente pelo chat.

## Google Search Console: gratuito

1. Abra https://search.google.com/search-console com sua conta Google.
2. Em **Adicionar propriedade**, escolha **Prefixo do URL** e informe **https://itext-1b9da.web.app/**. Essa opção funciona com o endereço gratuito; a opção Domínio exige acesso ao DNS de um domínio próprio.
3. Se a propriedade já for verificada automaticamente, prossiga. No Itext atual, use o **Arquivo HTML** preparado acima. Como alternativa para outras configurações, escolha **Tag HTML** em Outros métodos de verificação. A tag `google-site-verification` é um código público de comprovação, não uma senha. Ela pode ser enviada aqui para inclusão na próxima versão.
4. Para configurá-la por conta própria, copie somente o valor de `content` e acrescente `VITE_GOOGLE_SITE_VERIFICATION=SEU_CODIGO_PUBLICO` ao arquivo `.env.independent.local` da pasta correta. Substitua o exemplo pelo valor real, sem colar a tag HTML inteira. Preserve as linhas do Supabase. Publique novamente e então clique em **Verificar** no Search Console. O código deve continuar presente nos próximos deploys; não remova a linha.
5. Em **Sitemaps**, envie **https://itext-1b9da.web.app/sitemap.xml**.
6. Em **Inspeção de URL**, informe **https://itext-1b9da.web.app/**, escolha **Testar URL publicada** e, quando disponível, **Solicitar indexação**.

Não use a URL do Supabase, o callback OAuth nem o link do projeto no ChatGPT para esse cadastro. Não envie senhas, Client Secret, cookies ou tokens de login. A confirmação da propriedade e o pedido de indexação são feitos dentro da sua conta Google.

Acompanhe a Inspeção de URL e o relatório de indexação; isso pode levar dias ou mais. O operador `site:itext-1b9da.web.app` ajuda a conferir resultados, mas não substitui o Search Console.

## Bing e outros buscadores

Abra https://www.bing.com/webmasters/, adicione o mesmo endereço e importe a propriedade já verificada do Search Console, ou escolha o método de tag HTML oferecido pelo Bing. Para a configuração manual, o build aceita `VITE_BING_SITE_VERIFICATION=CODIGO_PUBLICO` em `.env.independent.local`. Depois de publicar e verificar, envie o mesmo sitemap. Outros buscadores podem usar seus próprios índices ou o índice do Bing; não há um cadastro único que garanta aparecer em todos.

## Quando houver domínio próprio

Primeiro configure o domínio e o HTTPS no Firebase. Depois defina `VITE_SITE_URL=https://seu-dominio` em `.env.independent.local` e publique para atualizar canonical, sitemap e metadados juntos. Cadastre o novo endereço no Search Console e no Bing. Não coloque caminhos, parâmetros nem credenciais nessa variável.
