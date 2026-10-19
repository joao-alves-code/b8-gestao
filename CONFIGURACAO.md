# Conversor B8 – Cadastro central Google Sheets (versão 1.2)

## Estrutura

- `public/index.html`: interface do wizard. Borderôs, extratos e recompras são processados no navegador.
- `netlify/functions/fornecedores.mjs`: endpoint autenticado no próprio domínio Netlify. Verifica identidade Google do usuário antes de permitir leitura/gravação.
- `apps-script/Code.gs`: backend Apps Script vinculado ao Google Sheets, com auditoria de inclusão/alteração e bloqueio de conflitos de CNPJ.
- `netlify.toml`: configura site estático e função serverless.

**Não basta publicar somente `index.html` para salvar no Google Sheets.** O site precisa ser implantado como projeto Netlify completo, com a função e as variáveis de ambiente.

## 1. Criar a planilha

Crie uma planilha privada no Google Sheets chamada, por exemplo, `B8 - Cadastro de Cedentes`. No menu **Extensões > Apps Script**, cole o conteúdo de `apps-script/Code.gs` no arquivo `Code.gs`. O script utiliza a planilha à qual está vinculado: não há necessidade de colar o ID da planilha no HTML.

Em **Configurações do projeto > Propriedades do script**, crie uma propriedade chamada `B8_SHARED_SECRET` com uma chave longa e aleatória. Essa mesma chave será cadastrada em `B8_APPS_SCRIPT_SECRET` no Netlify. Não coloque essa chave no HTML ou no GitHub.

Execute manualmente `setupCadastro()` uma única vez e aceite as permissões solicitadas. Ela cria duas abas: `Fornecedores` (codigo, nome, cnpj, atualizado_em, atualizado_por, origem) e `Auditoria` (histórico de alterações).

Depois faça **Implantar > Nova implantação > App da Web**, com **Executar como: Eu** e **Quem tem acesso: Qualquer pessoa**. Copie a URL que termina em `/exec` (não use a URL `/dev`). O Apps Script recebe chamadas via POST **somente do backend do Netlify**, verificando o segredo em cada chamada; não a exponha em páginas públicas. A configuração “Qualquer pessoa” é necessária para o endpoint server-to-server sem Google OAuth do proprietário e precisa ser usada com segredo forte, proteção da função e auditoria. Se sua política de TI não permitir esta publicação, use a Google Sheets API com conta de serviço em vez de Apps Script.

## 2. Autenticação Google dos usuários

No Google Cloud, configure a tela de consentimento OAuth e crie um **Client ID OAuth do tipo Aplicação Web**, destinado ao Google Identity Services. Em **Origens JavaScript autorizadas**, inclua a origem HTTPS real do Netlify (`https://seu-site.netlify.app`, sem caminho) e o domínio próprio se houver.

Adicione à variável `ALLOWED_GOOGLE_EMAILS` os endereços Google específicos autorizados, separados por vírgula. Apenas as contas desta lista poderão consultar ou modificar a base. O Netlify verifica o **ID token Google**, a audiência, a assinatura por validação remota no Google e o prazo antes de chamar o Apps Script. Uma conta fora da lista recebe `403`.

Observação: o acesso à planilha Google não precisa ser concedido a todos os usuários do conversor. O Apps Script executa como o proprietário autorizado. O proprietário deve proteger a planilha e a implantação. **Não inclua tokens, senhas, client secret ou URLs com segredo no HTML.**

## 3. Netlify

Publique a pasta/projeto completo que contém `netlify.toml`, `public/` e `netlify/functions/`. Preferencialmente conecte ao GitHub e habilite deploy contínuo. O upload por arrastar apenas o `index.html` **não** instala Netlify Functions.

Configure no painel Netlify > *Site configuration > Environment variables*:

| Variável | Valor |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | Client ID OAuth público terminado em `.apps.googleusercontent.com` |
| `ALLOWED_GOOGLE_EMAILS` | Lista exata de contas autorizadas separadas por vírgula |
| `B8_APPS_SCRIPT_URL` | URL de produção `/exec` obtida no Apps Script |
| `B8_APPS_SCRIPT_SECRET` | Mesmo segredo da propriedade `B8_SHARED_SECRET` |

Realize um novo deploy após configurar as variáveis. Confirme que `/.netlify/functions/fornecedores?action=config` retorna `configured:true`, **sem expor segredos**. Nunca use essa rota para testar gravações com credenciais falsas.

## 4. Fluxo de usuários

1. Clique **Cadastro de fornecedores**, no menu lateral, e faça login Google com uma conta permitida. O cadastro é consultado do Sheets.
2. O menu **Atualizar via PDF WBA** funciona fora do wizard. Anexe a relação de fornecedores quando desejar atualizar a base; pré-visualize e confirme. Os registros sem CNPJ válido são ignorados e conflitos entre CNPJs não são sobrescritos.
3. No wizard mensal, importe **apenas o relatório de aquisições** e, opcionalmente, extratos, WBA e recompras.
4. Na etapa 2, se o fornecedor estiver sem CNPJ, use **Cadastrar CNPJ**. O formulário já mostra código e nome; forneça o CNPJ, clique salvar e aguarde a confirmação do Google. A operação é recalculada com a informação persistida, sem mudar valores de face/deságio.
5. Continue a conciliação financeira e exporte o Excel. O cadastro estará disponível nas próximas sessões porque fica na planilha Google.

## 5. Regras e pendências de homologação

- A chave lógica de fornecedor é o `codigo` do WBA; CNPJ precisa conter dígitos verificadores válidos (14 dígitos) para ser salvo.
- Não grava CNPJ vazio; não exclui fornecedores ausentes em uma importação e não sobrescreve um CNPJ diferente sem revisão fora do wizard.
- O banco Google Sheets armazena **apenas código, nome, CNPJ e metadados de auditoria**; PDFs financeiros não são enviados.
- Tokens Google só ficam em memória. O login deve ser renovado após expirar (normalmente uma hora).
- Houve teste automatizado local de 64 borderôs, 23 PDFs de recompra com 33 títulos e código compilado. A conexão com a planilha Google ainda depende da implantação e não foi testada com credenciais reais.
- O reconhecimento de extratos Caixa/Bradesco e do relatório WBA ainda apresenta limitações anteriores e não deve ser considerado prova bancária completa; a homologação contábil para importação no ERP também permanece pendente.
