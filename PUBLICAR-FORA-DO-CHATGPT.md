# Publicar Itext sem o ChatGPT — Firebase Hosting + Supabase

## Situação

O código está preparado para Firebase Hosting clássico e Supabase Free. A publicação depende de vincular o projeto à sua conta Firebase. Não há cobrança ou domínio adquirido por este código.

O site antigo do Sites continua separado. Seus dados não são migrados automaticamente: a identidade Google no Supabase é diferente da antiga identidade do ChatGPT. As migrações desta versão não apagam os dados do site antigo.

## Contas e banco

1. Crie o projeto Supabase no plano Free.
2. No SQL Editor, execute `supabase/google-chat.sql` uma única vez. Se `chat_profiles` e `direct_messages` já existem, essa etapa está concluída.
3. Execute **supabase/social.sql** uma vez. Esse arquivo acrescenta perfis sociais, publicações, curtidas, comentários, grupos, páginas, conexões e o bucket privado de mídia, sem dados fictícios. As conversas existentes ficam preservadas.
4. Copie Project URL e Publishable key de Settings → API Keys. O código usa somente a chave pública `sb_publishable_`.

## Google

1. No Google Cloud Console, selecione o projeto do aplicativo.
2. Configure Google Auth Platform: nome Itext, e-mail de suporte e público Externo.
3. Crie cliente OAuth do tipo Aplicativo da Web.
4. Cadastre a callback fornecida pelo Supabase como URI de redirecionamento autorizada.
5. Coloque Client ID e Client Secret apenas em Supabase → Authentication → Providers → Google e ative o provedor.
6. Enquanto o aplicativo OAuth estiver em teste, cadastre os e-mails que vão testar. Para público geral, finalize a configuração de publicação no Google conforme as exigências do painel.

A callback deste projeto é:

```text
https://qnjanobhsnvrxoraifcc.supabase.co/auth/v1/callback
```

## Firebase gratuito

1. Abra <https://console.firebase.google.com/> e crie ou selecione o projeto Itext.
2. Mantenha o plano **Spark**, sem ativar faturamento.
3. Use **Hosting** clássico. Esta versão não usa App Hosting, Functions nem Firebase Storage.
4. Copie o ID do projeto em Configurações do projeto → Geral. O ID é diferente do nome de exibição.

## Código e publicação

Instale Node.js 22.13 ou mais recente. Na pasta do código:

```sh
npm ci
```

Copie `.env.independent.example` para `.env.independent.local` e preencha a Publishable key real. Não coloque chaves secretas nesse arquivo.

Depois:

```sh
npm test
npx firebase login
npm run deploy:firebase
```

O projeto `itext-1b9da` já está vinculado em `.firebaserc`. Entre com a conta dona desse projeto. O deploy gera `dist/` e publica somente o Hosting. O terminal exibirá o endereço real. A URL esperada é `https://itext-1b9da.web.app`, mas ela só deve ser considerada ativa após o deploy bem-sucedido.

Para atualizar o site depois, execute novamente `npm run deploy:firebase` na pasta do projeto. A publicação não exige ChatGPT.

## Autorizar o endereço do site

Em Supabase → Authentication → URL Configuration:

- Site URL: a origem real retornada pelo Firebase, usando HTTPS.
- Redirect URLs: a mesma origem seguida de `/`.
- Para desenvolvimento, pode incluir `http://localhost:4317/`.

A callback do provedor Google continua sendo a do Supabase. Não a substitua pelo endereço do Firebase.

## Testar de verdade

1. Abra o endereço publicado em dois navegadores usando contas Google diferentes.
2. Entre nas contas e conclua os interesses iniciais.
3. Publique, curta e comente. Recarregue e confirme que os dados continuam salvos.
4. Abra Mensagens e envie entre as duas contas. O status “Conectado” depende da confirmação real do WebSocket.
5. Feche e reabra o site para conferir o histórico.
6. Verifique com uma terceira conta que conversas alheias não estão acessíveis.
7. Teste um grupo privado/não listado: quem não participa não deve acessar posts nem arquivos desse grupo.

Os testes automatizados executam as políticas SQL em PostgreSQL local. Eles não substituem o teste final de Google OAuth e WebSocket nas suas contas.

## Domínio e limites

O endereço `web.app` dispensa compra de domínio. Um domínio próprio pode ser comprado e conectado ao Hosting depois; nessa etapa, inclua também o novo endereço nas URLs permitidas do Supabase.

Os planos gratuitos têm limites e podem ter regras de pausa por inatividade. Arquivos usam a franquia gratuita do Supabase, não o Firebase Storage. Nenhum script deste projeto ativa plano pago, cartão ou faturamento.
