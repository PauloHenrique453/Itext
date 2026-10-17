# Itext — Firebase + Supabase

Rede social sem dados de demonstração, com Google Auth e mensagens privadas em tempo real. O frontend é hospedado no Firebase Hosting; dados, autenticação e arquivos usam Supabase. Não precisa de servidor próprio, Cloudflare, R2, Firebase Functions ou plano Blaze.

## Configuração

1. No Supabase SQL Editor, execute `supabase/google-chat.sql` e depois `supabase/social.sql`. **Se as tabelas do chat já existem, execute apenas social.sql.**
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
7. Teste com duas contas Google em navegadores diferentes. A mensagem só deve aparecer como enviada após o Supabase confirmar. Recarregue e confira o histórico. Uma terceira conta não deve conseguir ler a conversa.

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

Perfis sociais são públicos. Mensagens têm acesso restrito aos participantes pelas políticas do Postgres. O chat não implementa criptografia ponta a ponta: administradores com acesso ao banco ainda têm acesso técnico aos registros.

Antes de abrir o site aos usuários, aplique `supabase/social.sql` e valide no projeto real o login Google, a entrega por WebSocket e o isolamento entre três contas. Os testes locais e a verificação de dependências reduzem riscos, mas não constituem garantia de ausência de falhas.
