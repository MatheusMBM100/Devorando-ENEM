# Ativar contas (login) no Devorando ENEM

O site já tem tela de entrada, cadastro, recuperação de senha, sincronização dos dados e o painel "Alunos" do administrador. Para ligar tudo isso é preciso criar um projeto gratuito no **Supabase** (o serviço que guarda as contas e os dados). Enquanto o arquivo `site/config.js` estiver vazio, o site funciona como antes, sem login.

## Passo a passo (cerca de 10 minutos)

1. Acesse https://supabase.com, clique em **Start your project** e entre (pode usar sua conta do GitHub).
2. Clique em **New project**. Nome: `devorando-enem`. Região: **South America (São Paulo)**. Crie e **guarde a senha do banco** (não será usada no site).
3. No menu da esquerda, abra **SQL Editor → New query**, cole **todo** o conteúdo de `supabase/schema.sql` e clique em **Run**. Deve aparecer "Success".
4. **Authentication → URL Configuration**: em **Site URL** coloque `https://matheusmbm100.github.io/Devorando-ENEM/` e, em **Redirect URLs**, adicione o mesmo endereço.
5. **Project Settings → API** (ou **Data API**): copie a **Project URL** e a chave **anon / public**. (Não use a `service_role`, que é secreta.)
6. Abra `site/config.js` e preencha:
   ```js
   window.DEVORANDO_CFG = { supabaseUrl: "COLE_A_URL", supabaseKey: "COLE_A_CHAVE_ANON" };
   ```
   Depois publique com `~/atualizar-enem-site.sh "Ativa contas"`.
7. No site publicado, **crie a sua conta** (use matheusbrizolamontanher@gmail.com).
8. Volte ao **SQL Editor** e rode, para virar administrador:
   ```sql
   update public.profiles set is_admin = true where email = 'matheusbrizolamontanher@gmail.com';
   ```
   Saia e entre de novo: aparece a aba **Alunos**.

## Observações importantes

- **E-mails de confirmação:** o Supabase gratuito envia poucos e-mails por hora com o remetente padrão. Para muitas pessoas, configure um SMTP próprio (Authentication → SMTP Settings, por exemplo com Resend) ou, para começar, desligue **Confirm email** em Authentication → Sign In / Providers → Email (menos seguro: qualquer e-mail, mesmo de terceiros, consegue criar conta).
- **Privacidade (LGPD):** ao criar a conta a pessoa marca que concorda que nome, e-mail e desempenho por matéria sejam vistos pelo administrador. O administrador vê só o resumo (respondidas, acertos, simulados, acerto por matéria), não as respostas questão a questão. Vale publicar uma política de privacidade e um e-mail para pedir exclusão de dados.
- **Segurança:** as regras do `schema.sql` impedem que uma pessoa leia dados de outra e que alguém se torne administrador pelo site. Só o SQL acima (rodado por você no painel) promove administradores.
- **Dados antigos:** quem já usava o site sem conta tem os dados locais enviados para a conta no primeiro login.
