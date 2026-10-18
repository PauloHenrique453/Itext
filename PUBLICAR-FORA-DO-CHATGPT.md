# Publicar Itext sem o ChatGPT — Firebase Hosting + Supabase

## Situação

O código está preparado para Firebase Hosting clássico e Supabase Free. A publicação depende de vincular o projeto à sua conta Firebase. Não há cobrança ou domínio adquirido por este código.

O site antigo do Sites continua separado. Seus dados não são migrados automaticamente: a identidade Google no Supabase é diferente da antiga identidade do ChatGPT. As migrações desta versão não apagam os dados do site antigo.

## Contas e banco

1. Crie o projeto Supabase no plano Free.
2. No SQL Editor, execute `supabase/google-chat.sql` uma única vez. Se `chat_profiles` e `direct_messages` já existem, essa etapa está concluída.
3. Execute **supabase/social.sql** uma vez. Esse arquivo acrescenta perfis sociais, publicações, curtidas, comentários, grupos, páginas, conexões e o bucket privado de mídia, sem dados fictícios. As conversas existentes ficam preservadas.
4. Execute **supabase/creator-privacy.sql** uma vez. Ele acrescenta as chaves protegidas e as políticas de acesso declarado do criador. Mensagens antigas ficam preservadas e identificadas como anteriores à criptografia; não há novos envios em texto simples.
5. Execute `supabase/migrations/20261017192931_restrict_itext_api_privileges.sql`. Esse ajuste restringe as funções privilegiadas, as configurações privadas de perfil e as chaves. Não acrescente `itext_private` aos schemas expostos pela Data API. Depois, execute `supabase/migrations/20261017223908_improve_social_and_chat.sql`, que acrescenta contadores de seguidores e recibos de leitura. A ordem dos scripts acima é necessária; a migração de permissões sozinha não instala um banco vazio.
6. Copie Project URL e Publishable key de Settings → API Keys. O código usa somente a chave pública `sb_publishable_`.

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

## Ativar sua conta de criador

A primeira publicação permite entrar com Google, mas o chat permanece bloqueado. Não crie uma senha manual no Supabase para substituir esse login.

1. Depois de autorizar o endereço do site, entre no Itext com **sua própria conta Google**.
2. No Supabase → Authentication → Users, copie o **User UID** dessa conta.
3. Em `supabase/activate-creator.sql`, substitua `PREENCHER_USER_UID` pelo UID. Execute o arquivo no SQL Editor do seu projeto. O script exige uma identidade Google verificada e recusa uma segunda designação. Nenhum usuário pode se promover pelo navegador.
4. No Itext → Mensagens, gere seu código de recuperação. Guarde-o em um gerenciador de senhas ou local seguro, confirme o aviso de acesso e ative a chave.
5. **Não envie o código de recuperação pelo chat, GitHub ou e-mail.** Ele abre sua chave, inclusive seu acesso de criador. O Google não recupera esse código. Não há redefinição automática ou rotação de chaves nesta versão.
6. Outras pessoas ativam suas próprias chaves e guardam seus códigos. Só é possível enviar quando remetente, destinatário e criador têm chaves cadastradas.
7. Sua conta verá “Revisar todas as mensagens”. As demais contas só veem as próprias conversas.

OpenPGP.js criptografa e assina o texto novo no navegador para os dois participantes e para o criador. A interface informa claramente que o criador tem acesso. Não anuncie o produto como criptografia exclusiva entre os participantes. Outros conteúdos mantêm as permissões sociais e o acesso técnico do dono pelo painel Supabase; não recebem a criptografia adicional das mensagens.

O repositório guarda somente o modelo SQL de ativação, nunca sua chave privada ou código. Uma chave privada protegida fica no banco; o código e a chave desbloqueada ficam no aparelho. Bloquear as mensagens, sair da conta ou recarregar a página exige desbloquear novamente. A navegação dentro da mesma sessão conserva a chave somente em memória. A proteção também depende da segurança das contas administrativas, do código hospedado e dos aparelhos.

## Testar de verdade

1. Abra o endereço publicado em dois navegadores usando contas Google diferentes.
2. Entre nas contas e conclua os interesses iniciais.
3. Publique, curta e comente. Recarregue e confirme que os dados continuam salvos.
4. Ative as chaves nas duas contas participantes e envie uma mensagem. O status “Conectado” depende da confirmação real do WebSocket. Confira no SQL Editor que `body` contém `BEGIN PGP MESSAGE`, sem o texto enviado, e `encryption_version = 1`.
5. Feche e reabra o site para conferir o histórico usando o código de recuperação. Um código incorreto deve falhar.
6. Entre com sua conta de criador e use “Revisar todas as mensagens”: ela deve abrir a conversa mesmo sem participar dela.
7. Verifique com uma quarta conta que conversas alheias e cofres de chaves privadas não estão acessíveis. Alterar o nome para “Criador” não pode conceder acesso.
8. Teste um grupo privado/não listado: quem não participa não deve acessar posts nem arquivos desse grupo.

Os testes automatizados executam as políticas SQL em PostgreSQL local. Eles não substituem o teste final de Google OAuth e WebSocket nas suas contas.

## Domínio e limites

O endereço `web.app` dispensa compra de domínio. Um domínio próprio pode ser comprado e conectado ao Hosting depois; nessa etapa, inclua também o novo endereço nas URLs permitidas do Supabase.

Os planos gratuitos têm limites e podem ter regras de pausa por inatividade. Arquivos usam a franquia gratuita do Supabase, não o Firebase Storage. Nenhum script deste projeto ativa plano pago, cartão ou faturamento.

### Atualização de bloqueio e curtidas

Após as migrações anteriores, aplique `supabase/migrations/20261018022252_profile_likes_privacy.sql` uma vez. No projeto `qnjanobhsnvrxoraifcc`, essa migração já foi aplicada. Ela não altera a chave do criador nem o conteúdo das mensagens.

A recuperação de PIN usa o envio de Magic Link do Supabase. Configure o modelo [supabase/email-identification.html](supabase/email-identification.html) em Authentication → Email Templates → Magic Link e habilite Email. O envio padrão do Supabase atende apenas endereços permitidos da equipe; para os demais usuários é necessário configurar SMTP. Não coloque a senha SMTP no código nem a envie ao chat. O app mostra erro se o provedor recusar o envio e só libera a nova senha após verificar o link da conta correta. Faça um teste de entrega e redefinição no mesmo aparelho após a publicação, guardando antes o código de recuperação das mensagens.


A configuração inicial e a recuperação de mensagens ficam em **Configurações → Acesso às mensagens**, com o botão **Salvar acesso neste aparelho**. Não há campo de senha/código na tela de conversas. A chave original continua exigindo o código guardado para habilitar um aparelho novo. Esta mudança de interface não altera o PIN do aparelho nem o banco de dados.
