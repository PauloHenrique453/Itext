# Itext — Firebase + Supabase

Rede social sem dados de demonstração, com Google Auth e mensagens privadas em tempo real. O frontend é hospedado no Firebase Hosting; dados, autenticação e arquivos usam Supabase. Não precisa de servidor próprio, Cloudflare, R2, Firebase Functions ou plano Blaze.

## Configuração

1. No Supabase SQL Editor, execute uma vez, nesta ordem: `supabase/google-chat.sql`, `supabase/social.sql` e `supabase/creator-privacy.sql`. Pule apenas os arquivos já aplicados. A última migração preserva mensagens antigas e bloqueia novas mensagens sem criptografia.
2. Configure Google em Authentication → Providers. A callback é a indicada pelo Supabase.
3. Copie `.env.independent.example` para `.env.independent.local` e preencha a chave pública `sb_publishable_`. Nunca use Client Secret ou service_role no frontend.
4. Crie um projeto Firebase no plano Spark, usando Hosting clássico, sem App Hosting e sem ativar faturamento.
5. Instale Node.js 22.13 ou mais recente e execute:

```sh
npm ci
npm test
npx firebase login
npm run deploy:firebase
```

O projeto `itext-1b9da` já está vinculado em `.firebaserc`. Entre com a conta dona desse projeto. O deploy publica somente Hosting.

6. Depois do deploy, em Supabase → Authentication → URL Configuration, preencha Site URL com a origem real do Firebase e inclua essa origem seguida de `/` em Redirect URLs. A callback cadastrada no Google continua sendo a do Supabase.
7. Entre primeiro com sua própria conta Google no site. Ela aparecerá em Supabase → Authentication → Users. Copie seu User UID para o campo indicado em `supabase/activate-creator.sql` e execute esse arquivo no SQL Editor. Nunca escolha o UID de outra pessoa.
8. Na sua conta, abra Mensagens, gere e guarde o código de recuperação e ative a chave do criador. Até essa ativação, o chat permanece bloqueado. Outras pessoas também precisam ativar suas próprias chaves.
9. Teste com duas contas participantes, sua conta de criador e uma conta alheia. Somente participantes e criador devem abrir a conversa. Recarregue, desbloqueie novamente e confirme o histórico; a mensagem só deve aparecer como enviada depois da confirmação do Supabase.

Leia `PUBLICAR-FORA-DO-CHATGPT.md` para o passo a passo completo.

## Desenvolvimento

```sh
npm run dev
```

A sessão usa OAuth PKCE e o token do usuário; as permissões são verificadas pelo Supabase/Postgres. O chat usa WebSocket (Realtime). O feed consulta atualizações a cada 30 segundos.

O bucket Supabase `itext-media` é privado. Fotos e vídeos autorizados são exibidos por URLs assinadas com duração de uma hora. Perfis não criados por usuários e conversas fictícias não são inseridos.

Firebase Spark e Supabase Free têm limites de uso, armazenamento e transferência. Ao atingir os limites, pode ser necessário reduzir uso ou escolher um plano pago. Este projeto não ativa faturamento automaticamente.

## Privacidade e publicação do código

O repositório contém somente configuração pública do cliente. A chave `sb_publishable_` identifica o projeto e depende das políticas de acesso; ela não é uma senha de administrador. Client Secret do Google, service_role, chaves privadas e dados reais de usuários não devem entrar no Git.

Perfis sociais são públicos. Mensagens novas usam OpenPGP.js no navegador: o texto é assinado pelo remetente e criptografado para remetente, destinatário e a conta de criador declarada. **O criador pode ler todas as conversas. Isso não é criptografia ponta a ponta exclusiva dos participantes.** A tela explica esse acesso antes da ativação e mantém o aviso durante o uso.

A conta do criador é escolhida no SQL Editor pelo UID Google verificado. Nome, e-mail informado no perfil e configurações do navegador não concedem privilégios. Usuários comuns não podem alterar a designação nem substituir chaves cadastradas. O criador possui uma tela de revisão de mensagens, e a RLS libera os registros somente para participantes e criador.

Cada chave privada é armazenada no banco protegida por um código aleatório de 256 bits. O código nunca vai ao banco nem ao Git; a chave desbloqueada fica em memória até bloquear as mensagens ou sair da tela. É preciso guardar o código e usá-lo em outros aparelhos. Não existe redefinição automática ou rotação de chave nesta versão. O login Google sozinho não recupera a chave perdida. A conta do criador também precisa guardar seu próprio código.

Mensagens anteriores à migração continuam em texto no banco e são marcadas na interface. Elas não são criptografadas retroativamente. Perfis, publicações e arquivos não recebem essa camada adicional; continuam protegidos pelas permissões e pela infraestrutura dos serviços. O dono do projeto tem acesso administrativo a esses registros pelo Supabase. Proteger esse painel e a conta de hospedagem continua necessário: quem controla o site pode alterar o código entregue aos usuários. Não há promessa de acesso exclusivo absoluto contra comprometimento da infraestrutura ou dos dispositivos.

Antes de liberar o chat aos usuários, aplique as migrações, ative a conta e a chave do criador e valide no projeto real o login Google, a entrega por WebSocket e o isolamento entre participantes, criador e outra conta. Os testes locais e a verificação de dependências reduzem riscos, mas não constituem garantia de ausência de falhas.

O comando de publicação executa `npm run check:deployment` antes do build. Ele exige que o provedor Google e a estrutura social e de criptografia estejam disponíveis e que as tabelas privadas recusem acesso anônimo. A primeira publicação permite criar a identidade Google do criador, com o chat bloqueado até sua configuração. O comando informa se a chave pública do criador foi cadastrada; isso não prova que o código de recuperação funciona. Falha de rede ou verificação incompleta interrompe a publicação. O teste com contas reais continua necessário para verificar o isolamento entre usuários autenticados.
