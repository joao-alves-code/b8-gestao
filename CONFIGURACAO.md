# Conversor B8 — MVP sem login Google (v1.2.1)

## O que mudou

- Removido o login Google e a lista de e-mails autorizados.
- Qualquer visitante com acesso ao site pode consultar, cadastrar e importar fornecedores.
- Os dados cadastrais (código, nome e CNPJ) continuam persistidos no Google Sheets.
- A integração continua protegida contra chamadas **diretas** ao Apps Script pela chave compartilhada servidor-servidor. **Isso NÃO impede que visitantes utilizem a função pública do Netlify.**
- O Google Sheets mantém as abas `Fornecedores` e `Auditoria`; o autor registrado será `MVP - acesso público`, pois não há identificação individual.
- O wizard mensal continua sem necessidade de anexar a relação de fornecedores; a atualização pelo PDF WBA fica no menu lateral.

## 1. Google Sheets + Apps Script

1. Crie uma planilha Google `B8 - Cadastro de Fornecedores`.
2. Na planilha, abra **Extensões > Apps Script**. Cole o arquivo `apps-script/Code.gs`.
3. Em **Configurações do projeto > Propriedades do script**, adicione a propriedade `B8_SHARED_SECRET` com uma chave longa e aleatória.
4. Execute `setupCadastro()` uma vez e autorize o script. Serão criadas `Fornecedores` e `Auditoria`.
5. Em **Implantar > Nova implantação > App da Web**, selecione `Executar como: Eu` e `Quem tem acesso: Qualquer pessoa`. Copie a URL terminada em `/exec`.
6. Se já tinha o Apps Script antigo publicado, **atualize também o código e crie uma nova versão da implantação**, para eliminar a exigência anterior de e-mail.

## 2. Netlify — apenas duas variáveis

Envie o projeto completo ao Netlify via GitHub (não somente `index.html`). `netlify.toml` configura `public/` e `netlify/functions/`.

| Variável | Valor | Secreta |
|---|---|---|
| `B8_APPS_SCRIPT_URL` | URL do Apps Script finalizada em `/exec` | Opcional |
| `B8_APPS_SCRIPT_SECRET` | A **mesma** chave de `B8_SHARED_SECRET` | **Sim** |

**Remova** `GOOGLE_OAUTH_CLIENT_ID` e `ALLOWED_GOOGLE_EMAILS` se já estiverem cadastradas no Netlify: a aplicação não as usa mais. Realize um novo deploy depois.

## 3. Como testar

1. Abra `https://seu-site.netlify.app/.netlify/functions/fornecedores?action=config`. Deve retornar `ok:true`, `configured:true` e `mode:'public-mvp'`. Não retorna segredo.
2. Abra o site. A lista de fornecedores será carregada automaticamente, sem login.
3. No menu **Cadastro de fornecedores**, cadastre um fornecedor de teste com CNPJ válido. Confira as abas `Fornecedores` e `Auditoria`.
4. Teste uma importação do PDF WBA no menu administrativo. Registros conflitantes não devem sobrescrever CNPJ diferente.
5. Na etapa 2 do wizard, abra um borderô cujo cedente ainda não tenha CNPJ, cadastre na modal e confirme persistência na planilha e nova consulta ao recarregar o site.

## Cuidados importantes

- **Qualquer pessoa que saiba o endereço do site pode modificar o cadastro por meio do endpoint público.** A chave Netlify/Apps Script protege o Apps Script de invocação direta, mas não controla quem chama a função do Netlify.
- A planilha contém dados cadastrais; mantenha backups e monitore a aba Auditoria. Sem login, não há como atribuir alterações a uma pessoa específica.
- Quando o MVP for divulgado, adicione autenticação ao cadastro ou restrinja o acesso ao site. Uma chave escondida no JavaScript **não é** uma solução segura.
- Permanecem limites de 100 registros por chamada, 290 KB por request, validação de CNPJ e prevenção de sobrescrita de CNPJ conflitante. Esses limites não substituem proteção contra uso abusivo ou rate limit na borda.
- Os PDFs financeiros continuam processados localmente no navegador, mas os cadastros serão consultados por qualquer visitante com acesso à aplicação.
- A homologação contábil e de leitura dos extratos permanece pendente de testes finais com os documentos de julho.
