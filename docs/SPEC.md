# Especificação de bbdw-storefront

## Escopo técnico

Aplicação com dados fictícios em memória, contratos HTTP/JSON, build e CI próprios. Autenticação real, banco de dados, pagamentos e mensageria ficam fora do escopo.

## Objetivo e responsabilidade

Permitir selecionar cliente, navegar pelo catálogo, montar carrinho, escolher entrega ou retirada e visualizar o pedido.

É dona da interface e do estado local do carrinho. O checkout calcula os totais finais. Também abriga a composição local e o smoke test integrado.

Tecnologia: React e TypeScript com Vite. Porta local padrão: `3000`. Clientes e produtos vêm das APIs. Carrinho e confirmação permanecem apenas no estado local da página.

## Interface e regras de negócio

| Tela ou fluxo | Comportamento esperado |
| --- | --- |
| Catálogo | Consumir `GET /products`, mostrar preço e imagem ou placeholder |
| Cliente | Selecionar `customer-pickup` ou `customer-delivery` e consultar seu perfil |
| Carrinho | Quantidades inteiras de 1 a 99; agregar adições do mesmo produto em uma linha |
| Finalização | Enviar `POST /orders`; mostrar erros 422 e 500 sem quebrar a tela, preservando o carrinho e permitindo nova tentativa manual |
| Confirmação | Exibir ID, total, modalidade e endereço somente quando for entrega |

Consumir os contratos dos três backends por HTTP/JSON, com URLs configuráveis. Os backends devem permitir a origem local configurada via CORS. Exibir moeda BRL em pt-BR; manter centavos inteiros no estado. Manter o carrinho após erro e impedir submissões simultâneas na mesma tela.

Recursos visuais de demonstração são locais. O caminho `/demo-assets/caneca.svg` do catálogo é servido pela interface. Um produto sem miniatura usa placeholder acessível. A interface não substitui as validações do servidor.

### Loja e checkout lateral

O catálogo é uma lista vertical em uma coluna, com identidade própria em azul e amarelo inspirada no BB. O botão **Carrinho** informa o total de unidades e abre um diálogo modal à direita (até 480 px); no celular, ele ocupa a tela inteira. O painel começa fechado, contém foco e bloqueia a rolagem da página; pode ser fechado pelo botão, Escape ou fundo, devolvendo foco ao acionador.

O painel reúne itens, cliente, recebimento, pagamento demonstrativo e resumo em uma única sequência. Quantidades de 1 a 99 podem ser editadas; a remoção é explícita. Carrinho vazio impede finalização. Total estimado e ação principal permanecem no rodapé, separados da área rolável. O endereço cadastrado aparece somente na modalidade de entrega; endereço ausente continua sujeito à validação do servidor.

**Pix de demonstração** (padrão) e **Cartão de teste** são escolhas locais, sem dados bancários editáveis, QR Code pagável, cobrança ou novas propriedades em `POST /orders`. Não acrescentam descontos, frete ou alterações ao total. A confirmação usa o ID, total e recebimento retornados pela API e identifica o pagamento como demonstrativo.

Durante o envio, as edições e novas submissões ficam bloqueadas. Fechar o painel não cancela a requisição: escolhas, erro ou confirmação permanecem ao reabrir. Erros preservam o carrinho para nova tentativa manual. Após sucesso, o formulário dá lugar à confirmação e as adições ficam bloqueadas até **Continuar comprando**, que limpa carrinho, resultado e seleção de pagamento e fecha o painel. Cliente e modalidade são mantidos para a próxima compra. O estado dura apenas durante a sessão da página, sem persistência em armazenamento local.

## Contratos comuns

Cada intenção de compra usa um UUID no cabeçalho `Idempotency-Key` de `POST /orders`. A chave é preservada após falha, ao fechar/reabrir o painel e ao trocar o pagamento demonstrativo. Alterar cliente, modalidade ou itens renova a intenção; **Continuar comprando** também a limpa. O corpo JSON e os totais permanecem iguais. `X-Request-ID` é novo a cada tentativa; `X-Client-Release` informa `VITE_SENTRY_RELEASE` quando configurada. Nenhum desses cabeçalhos contém dados bancários ou pessoais. A chave dura somente durante a sessão da página.

- HTTP/JSON, IDs como strings, valores monetários em centavos inteiros e moeda BRL.
- Envelope de erro: `{"error":{"code":"CODIGO_ESTAVEL","message":"Mensagem legível"},"requestId":"identificador"}`.
- Propagar `X-Request-ID` nas chamadas e respostas; gerar um identificador quando ausente.
- Dados exclusivamente fictícios. Não incluir tokens, cabeçalhos de autenticação ou dados pessoais reais nos eventos.
- Cada serviço possui projeto Sentry próprio e identifica ambiente, release e serviço. Consulte [SENTRY.md](SENTRY.md).
- Contratos de erro esperados (4xx) não são falhas inesperadas por padrão. Exceções inesperadas devem ser instrumentadas explicitamente.
- A implementação deve evitar captura duplicada da mesma exceção.

## Observabilidade

Cada serviço usa projeto Sentry próprio. Identificar ambiente, release e serviço; propagar o request ID e evitar eventos duplicados. Publicar source maps associados à mesma release nos projetos TypeScript. Testes de telemetria usam coletores locais, sem credenciais reais.

## Build e CI

O CI instala pelo lockfile, instala Chromium e executa `npm run check`: lint, tipos, build e testes Playwright com APIs simuladas. O workflow [ci.yml](../.github/workflows/ci.yml) também verifica o build da imagem Docker.

Os comandos locais estão no [README](../README.md). A imagem é construída pelo [Dockerfile](../Dockerfile); não há workflow de deploy remoto configurado neste repositório.

## Automação compartilhada

Integração com o Patchwork configurada no workflow local. Consulte [operação, skills e MCP](PATCHWORK.md).
