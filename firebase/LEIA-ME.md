# Ativar contas (login) no Devorando ENEM com Firebase

O site já tem tela de entrada, cadastro, recuperação de senha, sincronização dos dados e o painel "Alunos" do administrador. Para ligar tudo isso é preciso criar um projeto gratuito no **Firebase** (Google). Enquanto o arquivo `site/config.js` estiver vazio, o site funciona como antes, sem login.

## Passo a passo (cerca de 10 minutos)

1. Acesse https://console.firebase.google.com e entre com uma conta Google.
2. **Adicionar projeto** → nome `devorando-enem` → (pode desativar o Google Analytics) → **Criar projeto**.
3. **Authentication** → **Vamos começar** → aba **Método de login** → ative **E-mail/senha** (somente a primeira opção) → **Salvar**.
4. Ainda em Authentication → **Configurações** → **Domínios autorizados** → **Adicionar domínio**: `matheusmbm100.github.io`.
5. **Firestore Database** → **Criar banco de dados** → local `southamerica-east1 (São Paulo)` → modo de **produção** → **Criar**.
6. No Firestore, aba **Regras**: apague o conteúdo, cole todo o arquivo `firebase/firestore.rules` e clique em **Publicar**.
7. Engrenagem ao lado de "Visão geral do projeto" → **Configurações do projeto** → role até **Seus apps** → ícone **</>** (Web) → apelido `site` → **Registrar app** (não precisa configurar o Hosting). Aparece um bloco `const firebaseConfig = { ... }`: copie os valores `apiKey`, `authDomain`, `projectId` e `appId`.
8. Preencha `site/config.js` com esses quatro valores (ou me envie que eu coloco) e publique com `~/atualizar-enem-site.sh "Ativa contas"`.
9. No site publicado, **crie a sua conta** (com matheusbrizolamontanher@gmail.com).
10. **Torne-se administrador:** no Console do Firebase → Authentication → **Usuários**, copie o **UID** da sua conta. Em Firestore Database → **Iniciar coleção** → ID da coleção `admins` → ID do documento = o **UID** copiado → adicione qualquer campo (por exemplo `ativo` = `true`) → **Salvar**. Saia e entre de novo no site: aparece a aba **Alunos**.

## Observações importantes

- **A chave do Firebase no código não é um segredo.** Ela só identifica o projeto; quem protege os dados são as regras do passo 6. Não altere essas regras sem testar.
- **Cota gratuita (plano Spark):** cobre dezenas de milhares de leituras e milhares de gravações por dia, suficiente para uma turma. Se o uso crescer muito, o Firebase passa a cobrar apenas o excedente (plano Blaze, que exige cartão); você pode definir um orçamento com alerta.
- **E-mails:** o Firebase envia o e-mail de verificação de cadastro e o de redefinição de senha com limites generosos e sem configuração extra. O site não bloqueia quem ainda não verificou o e-mail.
- **Privacidade (LGPD):** ao criar a conta, a pessoa marca que concorda que nome, e-mail e desempenho por matéria sejam vistos pelo administrador. O administrador vê só o resumo (respondidas, acertos, simulados, acerto por matéria), não as respostas questão a questão. Vale publicar uma política de privacidade e um e-mail para pedir exclusão de dados.
- **Dados antigos:** quem já usava o site sem conta tem os dados locais enviados para a conta no primeiro login.
- **Excluir uma conta:** Authentication → Usuários → excluir (os documentos dela em Firestore, `users`, `userStats` e `userData`, devem ser apagados à mão).
