# Publicar Itext sem o ChatGPT — Firebase Hosting + Supabase

## Situação

O código está preparado para Firebase Hosting clássico e Supabase Free. A publicação depende de vincular o projeto à sua conta Firebase. Não há cobrança ou domínio adquirido por este código.

O site antigo do Sites continua separado. Seus dados não são migrados automaticamente: a identidade Google no Supabase é diferente da antiga identidade do ChatGPT. As migrações desta versão não apagam os dados do site antigo.

## Contas e banco

1. Crie o projeto Supabase no plano Free.
2. No SQL Editor, execute `supabase/google-chat.sql` uma única vez. Se `chat_profiles` e `direct_messages` já existem, essa etapa está concluída.
3. Execute **supabase/social.sql** uma vez. Esse arquivo acrescenta perfis sociais, publicações, curtidas, comentários, grupos, páginas, conexões e o bucket privado de mídia, sem dados fictícios. As conversas existentes ficam preservadas.
4. Execute **supabase/creator-privacy.sql** uma vez. Ele acrescenta as chaves protegidas e as políticas de acesso declarado do criador. Mensagens antigas ficam preservadas. Depois das migrações de permissões, seguidores e curtidas, aplique também `supabase/migrations/20261018040725_optional_chat_protection.sql`, que permite mensagens padrão e torna a camada adicional uma escolha dos participantes.
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

A primeira publicação permite entrar com Google e conversar no modo padrão, sem configurar chaves. Não crie uma senha manual no Supabase para substituir esse login.

1. Depois de autorizar o endereço do site, entre no Itext com **sua própria conta Google**.
2. No Supabase → Authentication → Users, copie o **User UID** dessa conta.
3. Em `supabase/activate-creator.sql`, substitua `PREENCHER_USER_UID` pelo UID. Execute o arquivo no SQL Editor do seu projeto. O script exige uma identidade Google verificada e recusa uma segunda designação. Nenhum usuário pode se promover pelo navegador.
4. Se desejar a proteção adicional, abra Configurações → Proteção adicional das mensagens, ative a opção e gere seu código de recuperação. Guarde-o em um gerenciador de senhas ou local seguro, confirme o aviso de acesso e ative a chave.
5. **Não envie o código de recuperação pelo chat, GitHub ou e-mail.** Ele abre sua chave, inclusive seu acesso de criador. O Google não recupera esse código. Não há redefinição automática ou rotação de chaves nesta versão.
6. Outras pessoas podem escolher a proteção adicional e cadastrar suas chaves. Somente esse modo exige a escolha dos participantes e as chaves de remetente, destinatário e criador; as mensagens padrão funcionam sem essas etapas.
7. Sua conta verá “Revisar todas as mensagens”. As demais contas só veem as próprias conversas.

No modo adicional, OpenPGP.js criptografa e assina o texto no navegador para os dois participantes e para o criador. A interface informa claramente que o criador tem acesso. Não anuncie o produto como criptografia exclusiva entre os participantes. Outros conteúdos mantêm as permissões sociais e o acesso técnico do dono pelo painel Supabase; não recebem a criptografia adicional das mensagens.

O repositório guarda somente o modelo SQL de ativação, nunca sua chave privada ou código. Uma chave privada protegida fica no banco; o código e a chave desbloqueada ficam no aparelho. Acesso à proteção adicional pode ser salvo opcionalmente no aparelho. Mensagens padrão não exigem código. A navegação dentro da mesma sessão conserva a chave somente em memória. A proteção também depende da segurança das contas administrativas, do código hospedado e dos aparelhos.

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


A configuração e a recuperação da camada adicional ficam em **Configurações → Proteção adicional das mensagens**. O formulário só aparece após ativar a opção, com o botão **Salvar acesso neste aparelho**. Não há campo de senha/código na tela de conversas. A chave original continua exigindo o código guardado para habilitar um aparelho novo. Esta mudança de interface não altera o PIN do aparelho nem o banco de dados.


A migração `20261018040725_optional_chat_protection.sql` habilita o modo padrão autenticado, limitado aos participantes e ao criador. A coluna de escolha é desativada por padrão; as chaves e o histórico existente são preservados. Esta migração deve preceder a publicação da nova interface. As mensagens padrão ficam em texto no servidor; não as anuncie como OpenPGP ou criptografia exclusiva entre participantes.


### Stories, solicitações e bloqueios

Aplique também `supabase/migrations/20261018044842_stories_requests_and_message_actions.sql` após as anteriores, antes de publicar esta versão. No projeto atual a aplicação é feita pelo conector e conferida separadamente; o atualizador do Windows só publica o frontend.

O início e o perfil têm stories de fotos/vídeos por 24 horas. Comentários do story chegam como mensagem ao dono. Mensagens recebidas de pessoas sem conexão ficam em Desconhecidos até aceitar, seguir ou responder. Os bloqueios têm os tipos Apenas conversas e De tudo; o segundo conserva o perfil pesquisável e a galeria de fotos publicadas fora de grupos, como solicitado. Abra o menu de três pontos da conversa ou da mensagem para administrar o conteúdo. No post próprio, use os ícones Editar e Apagar; o perfil também oferece esses controles.

Para conferir após publicar, use duas contas reais: teste cada direção de seguidor, aceitar/apagar solicitação, ambos os bloqueios, fotos visíveis no perfil com posts/stories ocultos, comentário de story recebido como mensagem, edição/reação/resposta a uma mensagem específica e exclusões para si ou para todos. Repita uma resposta protegida com as chaves já existentes, sem redefini-las. Confirme que uma terceira conta não acessa mensagens alheias. A revisão declarada do criador permanece com suas permissões anteriores.

Stories expiram no banco, mas os arquivos não são purgados automaticamente. Exclusão para todos substitui o corpo no banco; não revoga cópias já feitas ou arquivos já baixados. URLs assinadas de stories podem durar até 5 minutos; outras mídias, até 1 hora. Consulte o README para limites do bloqueio por conta e manutenção da franquia gratuita.


### Comentários, notificações, presença e espaços com imagens

Após as anteriores, aplique `supabase/migrations/20261018051650_comments_notifications_presence_spaces.sql`. No projeto atual essa aplicação já foi feita pelo conector. A publicação no Windows não repete migrações e não altera chaves de mensagens.

A atualização inclui comentários com curtidas/respostas, sino de notificações com marcação de leitura, contador de mensagens não lidas, sinal online/offline, navegação global de avatares ao perfil, editor de publicações com documentos e links e editor de grupos/páginas com foto, capa e categoria personalizada ou Não definido. As notificações se referem a ações reais a partir da instalação da migração; não foi criada atividade histórica fictícia.

Depois do deploy, teste em duas contas: curtir/responder um comentário, conferir o sino da conta destinatária, abrir a resposta pela notificação, marcar os avisos como lidos e confirmar os contadores. Teste presença com duas abas e uma queda de conexão (expiração em até 90 segundos, além do intervalo de consulta). Clique em avatares no feed, comentários e conversas para abrir o perfil correto. Confirme que curtidas privadas não aparecem no perfil para outra conta; o autor ainda pode receber avisos de curtida. Envie um PDF/áudio/vídeo e um link, confira o download após recarregar e negue o arquivo do grupo privado a uma conta não participante. Crie/edite um grupo e uma página com foto, capa, categoria nova e Não definido, confirmando que outra conta não consegue editar.

O status de presença é aproximado, notificações são internas ao site e arquivos não passam por antivírus neste aplicativo. As demais proteções e limites do README continuam valendo. Nenhum plano pago foi ativado.


## Editor de stories e descoberta do site

Após as migrações anteriores, aplique `supabase/migrations/20261019003517_story_editor_presentation.sql`. No projeto atual `qnjanobhsnvrxoraifcc` ela já foi aplicada e conferida. Acrescenta somente a apresentação validada do story e a preserva nas prévias autorizadas de respostas. As políticas de acesso, a expiração e as chaves de mensagens permanecem as anteriores.

O build passa a gerar a página pública de entrada em HTML, `robots.txt` e `sitemap.xml`. Consulte [APARECER-NO-GOOGLE.md](APARECER-NO-GOOGLE.md) para o cadastro gratuito no Google Search Console e no Bing. O site continua usando o nome Itext e o endereço gratuito do Firebase; solicitar indexação não garante posição ou prazo nos resultados.
