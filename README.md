# Devorando ENEM

Abra `site/index.html` no navegador (duplo clique). Não precisa de servidor nem de internet.

- `pdfs/`  provas e gabaritos oficiais do INEP (2020–2025, 1ª aplicação, caderno azul)
- `site/`  o site (HTML/CSS/JS puro). `data.js` = questões, `explicacoes.js` = explicações, `img/` = figuras e recortes
- `build/extract.py`  refaz `site/data.js` e `site/img/` a partir dos PDFs
- `build/partes/*.json`  explicações escritas em lotes (por questão: por que a certa está certa e por que cada outra está errada)
- `build/mesclar.py`  junta os lotes em `site/explicacoes.js`; `build/validar.py` confere se nenhuma alternativa ficou sem explicação
- `build/gerar_explicacoes.py`  alternativa que gera explicações pela API (precisa de `ANTHROPIC_API_KEY`); não foi usada

Fluxo: a página inicial (aba Simulado) mostra só um resumo: desempenho curto, simulados novos/em andamento (Começar ou Continuar) e os últimos concluídos. O formulário de preferências (nome, anos, matérias, assuntos, quantidade, cronômetro e opções) só aparece ao clicar em “Criar novo simulado”; ao criar, volta ao resumo com o simulado na lista. Ao finalizar aparecem acertos, porcentagem, evolução em relação aos anteriores e os botões “Criar outro simulado” e “Ir à página inicial”; também dá para revisar com explicações ou refazer só os erros. Qualquer questão pode ser marcada para revisar ou ter um erro reportado: o botão “Reportar erro” envia a descrição automaticamente para o e-mail do responsável pelo site, via serviço FormSubmit (https://formsubmit.co). Na primeira vez que alguém enviar um reporte, o FormSubmit manda um e-mail de ativação para esse endereço, e é preciso clicar no link dele uma única vez para que os próximos cheguem. O simulado pode ser pausado, e há dois modos de correção: gabarito logo após cada resposta, ou modo prova (marcar tudo, finalizar e só então ver gabarito e explicações em Revisar questões).

Matérias e assuntos: `build/classificar.py` gera `site/meta.js` a partir de `build/classificacao_manual.json` (classificação feita questão a questão) e de palavras-chave nas poucas sem ajuste manual (inglês/espanhol são classificados pela língua).

Cobertura: 1.110 questões (2020–2025). Questões anuladas pelo INEP (9) não têm gabarito nem explicação.
Em 2021 as questões aparecem como imagem do caderno (a extração de texto dessa prova é ilegível).

Contas e administração: veja `supabase/LEIA-ME.md` (login por e-mail e senha via Supabase, dados na nuvem e aba “Alunos” para o administrador). Enquanto `site/config.js` estiver vazio, o site funciona sem login.
