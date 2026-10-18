# Itext — Firebase + Supabase

Rede social sem dados de demonstração, com Google Auth e mensagens privadas em tempo real. O frontend é hospedado no Firebase Hosting; dados, autenticação e arquivos usam Supabase. Não precisa de servidor próprio, Cloudflare, R2, Firebase Functions ou plano Blaze.

No Windows, siga [PUBLICAR-NO-WINDOWS.md](PUBLICAR-NO-WINDOWS.md) para baixar uma versão fixa e publicar pelo PowerShell com sua própria conta Google.

## Configuração

1. No Supabase SQL Editor, execute uma vez, nesta ordem: `supabase/google-chat.sql`, `supabase/social.sql` e `supabase/creator-privacy.sql`. Pule apenas os arquivos já aplicados. Depois, execute `supabase/migrations/20261017192931_restrict_itext_api_privileges.sql` e `supabase/migrations/20261017223908_improve_social_and_chat.sql`, nessa ordem. Execute também `20261018022252_profile_likes_privacy.sql` e `20261018040725_optional_chat_protection.sql`. A migração de proteção opcional permite mensagens padrão sem códigos e exige a escolha dos dois participantes para novos envios com proteção adicional. Mensagens antigas e chaves não são alteradas. Depois, aplique `20261018044842_stories_requests_and_message_actions.sql` para stories, solicitações, bloqueios e ações de conteúdo. Finalize com `20261018051650_comments_notifications_presence_spaces.sql` para comentários com respostas, notificações, presença e espaços com imagens/categorias. Aplique em seguida `20261018054035_media_viewer_themes_and_story_formats.sql` para curtidas rápidas, visualizador de fotos, temas e novos formatos de stories.
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
8. Para mensagens padrão, basta entrar na conta. A proteção adicional é opcional: em Configurações, o criador pode ativá-la e cadastrar sua chave; os participantes que escolherem esse modo também cadastram suas próprias chaves.
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

Perfis sociais são públicos. Mensagens padrão são transmitidas por HTTPS e armazenadas como texto no Supabase, com acesso controlado por autenticação e RLS. Quando os participantes escolhem a proteção adicional, OpenPGP.js assina e criptografa o texto no navegador para remetente, destinatário e a conta de criador declarada. **O criador pode ler todas as conversas. Isso não é criptografia ponta a ponta exclusiva dos participantes.** A tela explica esse acesso antes da ativação e mantém o aviso durante o uso.

A conta do criador é escolhida no SQL Editor pelo UID Google verificado. Nome, e-mail informado no perfil e configurações do navegador não concedem privilégios. Usuários comuns não podem alterar a designação nem substituir chaves cadastradas. O criador possui uma tela de revisão de mensagens, e a RLS libera os registros somente para participantes e criador.

Cada chave privada é armazenada no banco protegida por um código aleatório de 256 bits. O código nunca vai ao banco nem ao Git; a chave desbloqueada fica em memória até bloquear as mensagens, sair da conta ou recarregar/fechar a página. É preciso guardar o código e usá-lo em outros aparelhos. Não existe redefinição automática ou rotação de chave nesta versão. O login Google sozinho não recupera a chave perdida. A conta do criador também precisa guardar seu próprio código.

Mensagens padrão, antigas ou novas, são identificadas como padrão. Mensagens com proteção adicional mantêm seu formato e dependem da chave original. Nenhuma mensagem foi convertida retroativamente. Perfis, publicações e arquivos não recebem essa camada adicional; continuam protegidos pelas permissões e pela infraestrutura dos serviços. O dono do projeto tem acesso administrativo a esses registros pelo Supabase. Proteger esse painel e a conta de hospedagem continua necessário: quem controla o site pode alterar o código entregue aos usuários. Não há promessa de acesso exclusivo absoluto contra comprometimento da infraestrutura ou dos dispositivos.

Antes de liberar o chat aos usuários, aplique as migrações, ative a conta e a chave do criador e valide no projeto real o login Google, a entrega por WebSocket e o isolamento entre participantes, criador e outra conta. Os testes locais e a verificação de dependências reduzem riscos, mas não constituem garantia de ausência de falhas.

O comando de publicação executa `npm run check:deployment` antes do build. Ele exige que o provedor Google e a estrutura social e de criptografia estejam disponíveis e que as tabelas privadas recusem acesso anônimo. A primeira publicação permite criar a identidade Google e usar mensagens padrão. Somente a proteção adicional depende da configuração de chaves. O comando informa se a chave pública do criador foi cadastrada; isso não prova que o código de recuperação funciona. Falha de rede ou verificação incompleta interrompe a publicação. O teste com contas reais continua necessário para verificar o isolamento entre usuários autenticados.

As funções privilegiadas ficam em `itext_private`, que deve permanecer fora dos schemas expostos na Data API do Supabase. As funções públicas são wrappers com permissões do chamador. As visualizações públicas projetam somente campos públicos; configurações completas do perfil e cofres de chaves ficam restritos à própria conta. A migração de permissões revoga também concessões diretas de `anon`/`authenticated`, pois os padrões do Supabase podem concedê-las independentemente de `PUBLIC`.

## Página de entrada e outras contas

Antes da interface social, visitantes veem uma página de entrada. Uma sessão válida abre a comunidade; sair da conta retorna à entrada. O feed só começa a carregar depois da autenticação. Isso controla a entrada na interface; conteúdos definidos como públicos no banco continuam públicos conforme suas políticas.

O Google sempre abre a seleção de conta. A página consulta as configurações públicas do Supabase e exibe somente provedores habilitados, com suporte para Google, GitHub, Microsoft (Azure), Facebook, Apple, Discord e LinkedIn OIDC. Adicionar um botão não ativa um provedor: as credenciais devem ser configuradas no painel do Supabase e no serviço correspondente. A página passa a oferecer o provedor habilitado ao ser recarregada. Não coloque segredos no frontend.

Por exemplo, para habilitar GitHub, crie um OAuth App em GitHub → Settings → Developer settings → OAuth Apps, usando a URL publicada como Homepage URL e a callback `https://qnjanobhsnvrxoraifcc.supabase.co/auth/v1/callback`. Configure o Client ID e o segredo somente em Supabase → Authentication → Sign In / Providers → GitHub e habilite o provedor. Microsoft usa o provedor Azure e exige registro de aplicativo correspondente na plataforma Microsoft. Cada provedor deve ser testado com uma conta real antes de ser anunciado como disponível.

Erros OAuth ficam visíveis na entrada, com mensagens compreensíveis, e parâmetros temporários de autenticação são removidos do endereço. Um novo login conserva os parâmetros dos convites de grupos. A proteção do chat e a designação do criador não foram alteradas por esta página.

## Pessoas, perfis, conversas e novas versões

A área Pessoas permite buscar perfis cadastrados, seguir/deixar de seguir e abrir uma conversa. As listas de seguidores e seguindo são filtradas e paginadas no banco; os contadores vêm de registros reais. O próprio perfil permite editar nome, biografia, foto, capa e tema, incluindo remover imagens. A navegação oferece esses recursos em celular, tablet e computador.

O chat inclui contagem de não lidas, recibos de leitura persistidos, busca no histórico carregado, texto com várias linhas, emojis e cópia. Uma mensagem só é marcada como vista quando o destinatário a abre em uma conversa desbloqueada, com a aba visível e o fim da conversa à vista. A revisão do criador não marca mensagens de outras pessoas como lidas. As chaves desbloqueadas podem ser reutilizadas durante a navegação da mesma conta somente em memória; para a proteção adicional, o acesso pode ser salvo opcionalmente no aparelho como descrito abaixo. Mensagens padrão não dependem da chave. Rascunhos de conversa ficam em memória, sem salvar texto privado no armazenamento do navegador.

O build gera um identificador próprio e `dist/version.json`. A página verifica esse arquivo sem cache a cada minuto enquanto está visível e ao recuperar foco/conexão. Se o servidor tiver outra versão, aparece um aviso com Atualizar agora. A atualização depende de uma ação do usuário e pede confirmação quando detecta conteúdo em edição. O Firebase precisa receber também o novo `firebase.json` e o script de build, além de `src/`. O aviso só funcionará para futuras publicações depois da primeira instalação desta funcionalidade.

### Bloqueio do aparelho, mensagens lembradas e curtidas privadas

Em Configurações, cada usuário pode ativar um PIN numérico de pelo menos 8 dígitos ou uma senha de pelo menos 12 caracteres. O bloqueio é local a este navegador/aparelho; não substitui Google, RLS, bloqueio do sistema operacional ou autenticação no servidor. Apagar os dados locais remove esse bloqueio. Nenhum sistema é impossível de invadir.

Mensagens padrão não pedem senha nem código. Em Configurações → Proteção adicional das mensagens, a opção “Quero ativar a proteção adicional com código” vem desativada. O formulário de configuração e recuperação só aparece após o usuário ativar essa opção. Se já houver uma chave da conta, ela é desbloqueada com o código original; a chave não é substituída. Depois disso, as conversas abrem automaticamente enquanto o acesso estiver salvo. Em aparelhos novos ou após esquecer o acesso, a recuperação fica nas Configurações. O código de recuperação é cifrado com AES-256-GCM em IndexedDB, vinculado à conta e à impressão da chave. Com senha de bloqueio, a chave AES é derivada por PBKDF2-SHA-256 (600.000 iterações, salt aleatório). Sem senha, uma CryptoKey local não exportável permite o acesso automático; scripts maliciosos na mesma origem ou alguém com acesso à sessão desbloqueada continuam sendo riscos. Nunca há código de recuperação em texto puro em localStorage nem envio desse código ao servidor. Não use em aparelho compartilhado. Guarde o código para aparelhos novos.

O PIN/senha e o código de recuperação são coisas diferentes. “Esqueci meu PIN” solicita um Magic Link ao e-mail já confirmado da própria conta. Só um callback novo validado pelo Supabase para essa mesma identidade concede uma autorização temporária para criar uma nova senha. Parâmetros de URL e uma sessão Google já existente não concedem essa autorização. A solicitação vale 15 minutos neste navegador. Redefinir remove o acesso de mensagens lembrado; o código de recuperação será necessário novamente. Não troca nem redefine a chave privada do servidor.

**Envio de e-mails requer configuração:** em Supabase → Authentication → Email Templates → Magic Link, use [supabase/email-identification.html](supabase/email-identification.html), mantendo Site URL `https://itext-1b9da.web.app` e Redirect URL `https://itext-1b9da.web.app/`. O app também aceita callback PKCE com método de e-mail verificado. Habilite o provedor Email para o Magic Link. Para usuários fora da equipe do Supabase, configure um servidor SMTP próprio nas configurações de e-mail do projeto; o remetente e as credenciais ficam somente no painel Supabase, nunca no repositório ou no chat. Não foi ativado nenhum serviço pago. O envio e a entrega de um e-mail real ainda precisam ser validados com a conta do proprietário.

Curtidas ficam privadas por padrão. `likes_public` é atualizado apenas pelo dono do perfil. A política RLS de `itext_likes` oculta identidades privadas também em consultas diretas; os totais das publicações continuam corretos por uma função privada que só retorna o agregado de publicações acessíveis. O perfil próprio tem a aba Curtidas e o perfil de outras pessoas mostra apenas curtidas públicas de publicações permitidas ao visitante. Aplique a migração `20261018022252_profile_likes_privacy.sql` após as anteriores. Nenhum dado de exemplo é criado.

O acesso do criador às mensagens permanece informado na entrada e na ativação do chat. Os avisos foram resumidos; a criptografia continua incluindo o criador como destinatário declarado.


### Modos de mensagem e escolha do usuário

`chat_protection_enabled` é privado por padrão e só pode ser alterado pelo próprio usuário. A projeção autenticada `itext_chat_preferences` revela apenas a identificação e a disponibilidade do modo adicional. Novas mensagens padrão usam `encryption_version=0`, `owner_id=null` e limite de 4.000 caracteres; continuam restritas aos participantes e ao criador declarado. Novas mensagens OpenPGP exigem que os dois participantes tenham ativado a opção e que todas as chaves estejam cadastradas. Se o remetente escolheu proteção adicional e ela não estiver disponível, o envio aguarda configuração ou a escolha explícita “Usar conversa padrão”; não há conversão silenciosa do conteúdo cifrado.

O histórico pode conter os dois tipos. Sem a chave, mensagens cifradas mostram um aviso individual; não são exibidas como texto nem impedem uma conversa padrão. Desativar a opção não apaga chaves nem reescreve mensagens antigas. O código não é necessário para mensagens padrão.


## Stories, desconhecidos e ações de conteúdo

A migração `20261018044842_stories_requests_and_message_actions.sql` deve ser aplicada após as anteriores, antes de publicar esta interface. Não insere perfis ou atividades de demonstração e não altera os cofres de chaves.

- Stories aceitam texto com fundo e fonte, foto (até 8 MB), vídeo (até 50 MB) ou áudio (até 18 MB), com legenda opcional. Ficam disponíveis por 24 horas, verificadas pelo banco. Aparecem no início e no perfil. Curtidas são registros reais; comentários são mensagens privadas enviadas ao autor real do story e seguem a preferência de proteção do remetente. Stories expirados ou apagados deixam de poder receber respostas.
- Desconhecidos reúne conversas recebidas quando ninguém segue a outra pessoa. O contador mostra mensagens não lidas. Aceitar move para Conversas; enviar uma mensagem também aceita a conversa para o remetente. Solicitações não geram confirmação de leitura enquanto não forem aceitas. Apagar conversa oculta o histórico apenas para quem apagou; não apaga a cópia do outro participante. Mensagens novas podem reaparecer.
- Bloqueio Apenas conversas impede novos envios, respostas aos stories e reações nas mensagens entre as contas. Bloqueio De tudo também oculta posts, vídeos, stories, biografia e curtidas do perfil entre as contas e impede novas curtidas/comentários/seguidores. O perfil segue pesquisável, com avatar, capa e uma galeria somente de fotos publicadas fora de grupos. A galeria não retorna legendas, código, vídeos nem arquivos de grupos privados. É uma exceção solicitada pelo proprietário. O bloqueio vale para as contas envolvidas; não impede outra conta ou acesso a conteúdo público fora da sessão. Não revoga arquivos já baixados ou URLs de mídia assinadas ainda válidas (stories: no máximo 5 minutos; outras mídias: até 1 hora).
- O autor pode editar texto, código e mídias ou apagar suas publicações. Excluir post remove suas curtidas e comentários por cascata. No chat, qualquer participante pode apagar uma mensagem só para si; apenas o remetente pode editá-la ou apagar para todos. A exclusão para todos substitui o corpo por “Mensagem apagada” e remove reações, mantendo o identificador necessário às respostas. Cópias já feitas por destinatários não são apagadas.
- Respostas vinculam o identificador da mensagem selecionada. Edição e respostas do modo OpenPGP mantêm o tipo de proteção; os identificadores de resposta/story fazem parte do conteúdo assinado. Chaves existentes são preservadas. Não há conversão silenciosa de mensagens cifradas para texto.

As mudanças de mensagens, inclusive edições, exclusões e reações, usam eventos UPDATE do registro autorizado aos participantes, com reconciliação pela API. A tabela de reações não é publicada diretamente: eventos DELETE do Realtime não oferecem o mesmo filtro RLS. Solicitações, bloqueios e alterações de outras sessões também são reconciliados a cada 30 segundos. Stories são atualizados a cada 45 segundos, e a interface fecha a mídia ao passar da expiração.

Expiração de stories e exclusão lógica não prometem remoção física imediata de arquivos. Objetos no Storage e registros apagados de stories permanecem até a manutenção pelo administrador e contam para a franquia gratuita. Não foi configurado um serviço de limpeza automática. Nenhum plano pago foi ativado.

Validação: testes de permissões PostgreSQL, criptografia e publicação; build de produção e renderização SSR. A interface em aparelhos reais e o envio via WebSocket entre duas contas continuam dependendo do teste após publicar. O comando `npm run lint` ainda não tem um arquivo de configuração ESLint neste projeto; não é declarado como aprovado.


O verificador de segurança do Supabase não encontrou novos alertas de banco após esta migração. Permanece o aviso anterior de [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), referente a senhas do Supabase Auth. A entrada atual usa OAuth/Magic Link, e o PIN deste aparelho é uma proteção local separada.


## Comentários, perfis globais, notificações e presença

A migração `20261018051650_comments_notifications_presence_spaces.sql` vem após todas as anteriores. No projeto atual foi aplicada pelo conector antes da publicação do frontend. Não cria comentários, notificações históricas, usuários ou presença fictícios.

Comentários abrem em uma tela completa e paginada, com curtidas reais, respostas ao comentário escolhido, níveis visuais de resposta e acesso a páginas anteriores/seguintes do histórico. As referências são verificadas no banco: não é permitido responder a um comentário de outro post, de grupo sem acesso ou de um autor bloqueado de tudo. O botão Atualizar comentários consulta o banco novamente. Novas respostas próprias e comentários abertos pelas notificações são localizados mesmo fora da primeira página. O feed não baixa todos os comentários de todos os posts antecipadamente.

Os avatares de pessoas compartilham a mesma navegação: feed, perfil, busca, sugestões, conversas, comentários, stories e membros de grupos abrem o perfil correspondente. O perfil mostra posts paginados, fotos e curtidas públicas; curtidas privadas e posts de grupos sem acesso permanecem restritos pelo banco. O próprio usuário abre seu perfil editável. Fotos de grupos/páginas e prévias dos editores não são identidades de pessoas.

O sino e sua caixa de entrada mostram notificações recebidas de curtidas de posts/comentários/stories, comentários/respostas, seguidores, mensagens, seguidores de páginas e solicitações/aprovações de grupos. Os registros são produzidos por triggers de ações reais, não por requisições que possam escolher um destinatário arbitrário. A notificação de mensagem não contém o texto da conversa. Curtidas removidas retiram o aviso correspondente; posts e mensagens indisponíveis deixam de liberar o aviso. Novas atividades são sinalizadas por uma tabela privada de versões por usuário, com reconciliação periódica; a tabela de notificações não é publicada diretamente. Abrir uma notificação ou Marcar todas como lidas atualiza o banco. Os totais do sino e do ícone de mensagens representam não lidas, separadamente. Não foram configurados e-mails nem push do sistema operacional para esses avisos.

Ocultar curtidas no perfil não impede que o autor receba a notificação de uma curtida. O aviso aparece também nas configurações de privacidade para tornar essa escolha clara.

A presença usa uma concessão por aba/aparelho com horário do servidor. Uma aba visível e desbloqueada renova sua atividade a cada 25 segundos; o chat consulta estados a cada 15 segundos. Fechar/ocultar uma aba não derruba as outras sessões abertas da mesma conta. Sem renovação por 90 segundos, o estado passa a offline, incluindo queda de conexão ou navegador encerrado sem avisar. Isso é um sinal aproximado de atividade, não garantia de disponibilidade para responder. Uma conta não pode alterar o horário ou a presença de outra; contatos bloqueados não recebem seu status. Clientes anteriores a esta atualização não enviam esse sinal.

## Publicação com anexos, links e espaços

O editor do início e do botão Criar aceita até seis anexos: fotos (8 MB), vídeos (50 MB), áudios (18 MB), documentos/planilhas/apresentações, PDF, texto/CSV/JSON e ZIP (15 MB). Mostra nomes, tamanho e prévias, permite remover anexos do rascunho e escolher perfil, grupo ou página. O texto tem limite de 10.000 caracteres. Links usam apenas HTTP/HTTPS sem credenciais embutidas, com cartões de endereço. Links públicos reconhecidos do YouTube, TikTok e Instagram oferecem o player oficial dentro do post; os demais mantêm a abertura externa. Não há busca de metadados em servidores externos. Arquivos são oferecidos para download por URL assinada, com as mesmas permissões do post. Não são executados nem embutidos como HTML pelo Itext. O bucket continua privado e no mesmo plano; arquivos consomem sua franquia de armazenamento. Não há promessa de verificação antivírus de arquivos de usuários.

Grupos e páginas podem receber foto/thumbnail, capa e categoria na criação e na edição pelo proprietário. A seleção oferece Não definido e Criar categoria. Uma categoria personalizada fica salva no espaço e volta às opções dos espaços visíveis ao usuário; não há catálogo global expondo categorias de grupos privados. O banco impede editar espaços de outros proprietários ou usar o caminho de upload pertencente a outra conta. Fotos de grupos privados seguem a permissão de leitura do grupo.

Validação da revisão anterior: 48 testes automatizados, build de produção, verificações estáticas de JavaScript/JSX e renderização SSR dos controles. O lint geral permanece sem configuração e não foi considerado aprovado. Não havia ferramenta de Browser disponível para controlar uma aba, e nenhum fallback externo foi autorizado: visual em celular/tablet/computador, seleção/envio de arquivos, Google OAuth e troca real entre contas precisam de conferência após o deploy.


## Fotos em tela cheia, temas e formatos de stories

Fotos das publicações e das galerias de perfil abrem um visualizador em tela cheia. Nome/avatar abrem o perfil; Seguir, compartilhar, comentar e curtir usam operações reais. Fechar (X ou Escape) mantém a página anterior. A rolagem carrega outras fotos de usuários reais, em páginas de vinte posts; não inclui grupos no fluxo de descoberta. Compartilhar usa `?foto=ID&indice=N`, sem expor URLs de mídia assinadas. O servidor verifica o acesso à foto, inclusive quando o link é aberto diretamente. Na exceção de bloqueio completo, somente as fotos públicas do perfil continuam acessíveis; o visualizador não revela legendas, vídeos ou grupos privados e desativa as interações.

A janela de comentários é renderizada diretamente no corpo da página para escapar do recorte dos cartões. A lista tem rolagem independente e carrega as próximas páginas ao se aproximar do fim; também oferece Carregar mais. O editor e o botão Fechar permanecem acessíveis. As respostas preservam o comentário de destino.

Curtir atualiza coração/contador imediatamente e confirma a intenção por uma única chamada idempotente ao banco, sem recarregar todo o feed. Erros restauram o estado anterior e mostram a falha. A resposta usa contagens reais. O evento local sincroniza os cartões/visualizador que mostram o mesmo post.

Configurações → Tema do Itext oferece Comum, Branco, Cinza grafite e Black. Salvar preferências grava a escolha na própria conta. Os temas usam superfícies, textos e bordas comuns; o visualizador de fotos mantém o fundo preto. As opções de publicação continuam disponíveis nas telas pequenas. Há ajustes para tablet, computador, telas grandes, orientação horizontal, teclado e áreas seguras do celular. A aparência depende do navegador; não é um aplicativo nativo para sistemas de Smart TV.

Vídeos enviados diretamente podem ter qualquer duração, desde que o arquivo tenha no máximo **50 MB**, teto por arquivo do Supabase Free. Fotos seguem em 8 MB, áudios em 18 MB e documentos em 15 MB. Formato/codec precisa ser compatível com o navegador. O envio é padrão e, se a conexão cair, pode precisar reiniciar. Vídeos maiores devem usar links públicos das plataformas; não foi ativado um plano pago nem transcodificação.

Links canônicos do YouTube (watch, youtu.be, shorts/live), TikTok (`/@usuario/video/ID`) e Instagram (p/reel/tv) oferecem um botão para carregar o iframe oficial no próprio post, com link externo sempre disponível. São usadas origens e IDs estritamente validados. A plataforma pode exigir login/cookies, impedir incorporação ou remover conteúdo; não há promessa de reprodução de todos os links. Links curtos de redirecionamento, como vm.tiktok.com, permanecem cartões externos: copie o endereço completo do vídeo. O Itext não baixa nem republica vídeos externos. A navegação e o player dependem da conexão e das regras da plataforma.

Stories aceitam Texto, Foto, Vídeo ou Áudio, paleta de oito fundos, quatro fontes, texto de até 1.000 caracteres e legenda opcional. Texto é renderizado como texto, sem executar HTML. As mesmas regras de autor, expiração de 24 horas, bloqueio, curtidas e resposta privada ao dono se aplicam. Áudios usam player com duração e progresso reais, controle de reprodução e posição; não há ondas ou tempos simulados.

Validação desta revisão: 54 testes automatizados aprovados (incluindo permissões/RLS de curtidas, fotos, stories e temas), build, renderização SSR e verificações estáticas de JS/JSX. Sem ferramenta de Browser disponível, não foram testados visual/interação em aparelhos reais, reprodução dos provedores, upload de 50 MB ou entrega entre contas reais. O proprietário deve conferir esses fluxos após o deploy. O comando de lint geral ainda não possui configuração.

## Rodapé dos stories e menu lateral recolhível

Tocar no círculo/foto de um story abre o story publicado; esse avatar não intercepta o clique para abrir o perfil. O avatar dentro da visualização mantém a navegação ao perfil. A mídia e a legenda têm rolagem própria; o rodapé permanece visível com Comentar (mensagem privada ao dono), coração/contador e Compartilhar à direita. Enviar continua respeitando bloqueios e a proteção de mensagens escolhida. No próprio story aparecem as ações e o rótulo Seu story.

Compartilhar usa a folha nativa do aparelho ou copia um link `?story=UUID`, sem convite, código OAuth, fragmentos ou URL assinada de mídia. A abertura desse link conserva o destino após entrar com Google e consulta o story pelo ID com as permissões da conta. Stories expirados, apagados ou bloqueados seguem indisponíveis; compartilhar não prolonga as 24 horas nem torna o arquivo público. Não há tabela ou migração nova nesta revisão.

O botão Recolher menu lateral fica ao lado do logotipo; reduz a coluna esquerda a 84 px, mantém os ícones, os contadores, Criar e o próprio perfil. O botão Expandir restaura os nomes. A preferência é salva neste navegador em `itext:sidebar:v1`; o menu continua funcionando se o armazenamento local estiver indisponível. No celular continua disponível o menu próprio do aparelho. Os controles têm nomes acessíveis, dicas e indicação do estado expandido.

Validação desta revisão: **56 testes aprovados**, compilação de produção, verificações estáticas e SSR dos dois estados do menu, controles do rodapé, clique do círculo sem navegação de perfil e proteção do link compartilhado. Browser continua sem ferramenta de execução disponível nesta sessão; cliques completos na aplicação, tamanho/rolagem visual em aparelhos e compartilhamento nativo precisam ser conferidos após o deploy do Firebase no Windows.

## Revisão visual dos stories e correção do avatar

O avatar do cabeçalho estava atingido pela regra `.story-topline > span { flex:1 }`: como Avatar renderiza um span, a foto podia se esticar. Essa regra foi removida do avatar; o novo cabeçalho usa um contêiner próprio para o autor e mantém largura/altura de 38 px, proporção 1:1, recorte circular e object-fit:cover.

A visualização usa um palco vertical escuro, maior destaque para a mídia, nome/data reais, segmentos clicáveis dos stories daquela pessoa, setas discretas, fechar no canto e rodapé com resposta privada, coração/contador e compartilhar. Os segmentos indicam a posição e permitem abrir stories reais; não simulam um temporizador ou visualizações. O conteúdo conserva suas permissões, expiração e proteção das respostas. No celular a tela ocupa a altura disponível; no computador aparece um cartão central. Vídeos/fotos continuam com object-fit:contain para conservar a imagem inteira. Legenda longa e texto têm rolagem sem empurrar o rodapé para fora.

O editor de criação recebeu opções de formato com ícones, paleta, fonte e painel de prévia. A janela compartilhada ganhou cabeçalho opcional; comentários e outras janelas conservam o cabeçalho e botão Fechar usuais. Não houve mudança de dependências, banco ou permissões.

Validação: build de produção, verificações estáticas de JS/JSX, SSR do cabeçalho/autor, seleção de segmentos, fechar/apagar, prévia do editor, mídia indisponível, rodapé, galeria e comentários. Passaram também os testes focados de stories/RLS, conteúdo e links/login. Não há Browser executável nesta sessão; dimensões, capturas e interação completa em celular/computador ainda precisam ser conferidas após publicar. Compilação e SSR não são prova visual.

## Ishort: vídeos curtos de até 10 minutos

O Ishort tem publicação e feed próprios, com abas Explorar (ordem de publicação) e Seguindo, paginação por data/ID, atualização manual e links `?ishort=UUID`. Os links preservam o destino após entrar com Google. Não há conteúdo de demonstração: sem vídeos publicados no Ishort, aparece o convite para publicar. A imagem de referência visual criada durante o desenvolvimento não foi incluída como vídeo do site.

Publicar vídeo permite selecionar um arquivo, visualizar a prévia, conferir duração/dimensões/tamanho reais e escrever legenda. O limite escolhido é **10 minutos e 50 MB**. O navegador lê os metadados antes de enviar; o player também recusa duração maior que dez minutos ao carregar. Formato vertical é recomendado, mas horizontal é aceito e exibido inteiro. O arquivo precisa ter codec compatível com o navegador, por exemplo MP4/H.264/AAC. Não há transcodificação, compressão automática ou inspeção de duração no servidor; a duração salva é metadado fornecido pelo cliente e não constitui um controle antifraude do arquivo. O Storage conserva o teto por arquivo do plano gratuito.

Os vídeos publicados pelo Ishort são posts reais no perfil, com `media.short=true` e metadados do arquivo. Publicações de vídeos comuns e longos continuam no feed normal; não foram reclassificadas automaticamente. O feed do Ishort consulta posts marcados, fora de grupos, sob as mesmas permissões/RLS e bloqueios existentes. Curtidas e comentários são os do próprio post. O botão comentar abre a janela existente com respostas e curtidas. Avatares/nomes levam ao perfil; Seguir e compartilhar são operações reais. Compartilhar envia apenas o link do post no Ishort, sem códigos OAuth, convites ou URLs assinadas.

A reprodução acompanha o vídeo visível e é pausada ao sair da tela, ocultar a aba, abrir uma janela ou desmontar a página. Começa sem som para permitir autoplay quando o navegador aceitar. Se autoplay for bloqueado, a pessoa toca em reproduzir. Som, play/pausa, busca por posição e duração usam o elemento de vídeo real; existe opção de tela cheia quando suportada. O vídeo pode repetir ao terminar. Rolagem, botões e setas para cima/baixo trocam o item; espaço pausa/reproduz quando o feed está focado. Apenas o vídeo ativo e os vizinhos recebem URL no elemento; preload continua sujeito ao navegador.

O envio reutiliza o arquivo já enviado em uma tentativa e um UUID por publicação/legenda. Se a resposta de criação falhar, a repetição verifica o registro real do mesmo autor, conteúdo e mídia antes de confirmar um envio anterior; não sobrescreve outra publicação. A exclusão/edição continua disponível nas publicações do próprio perfil. Arquivos enviados e depois abandonados podem permanecer no Storage e consumir a franquia, como os demais anexos. Não foi ativado serviço pago, tabela nova ou migração nesta revisão.

Referência visual: player central com mídia vertical e fundo escuro, controles claros, ações à direita, autor na parte inferior, navegação vertical e adaptação móvel. A navegação/cores do Itext continuam disponíveis. A proposta usa Inter/Manrope, o azul e os componentes existentes. Não foi possível executar Browser para confrontar o layout com a referência ou verificar nativamente vídeo/rolagem/fullscreen em aparelhos reais; não é declarado resultado visual 10/10.

Validação: **62 testes aprovados**, incluindo limites, leitura/limpeza dos metadados, links/login, paginação sem duplicação, intenções de reprodução concorrentes e permissões de posts, grupos e bloqueios. Também passaram compilação, verificações estáticas de JS/JSX e SSR do player, controles, perfis/contagens reais, envio e estados vazios, junto das telas existentes de stories/comentários. Após publicar, conferir upload/reprodução real, troca vertical, som, comentários e tela cheia em celular/tablet/computador; essa validação não foi substituída por SSR.
