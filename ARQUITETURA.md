# Decisoes de arquitetura

## Monolito HTTP

O GreenCode AV2 e um monolito modular. Um unico processo Fastify atende a API, a autenticacao e o acesso ao PostgreSQL. Isso reduz a operacao e preserva as transacoes entre entidades relacionadas. O limite e o acoplamento de implantacao e escala: todos os modulos compartilham o processo e o banco. Se a carga exigir escala independente, sera necessario separar modulos, eventos e propriedade dos dados com cuidado.

## Controller, Service e Repository

Controllers declaram schemas HTTP, leem parametros e delegam. Services concentram validacoes, autorizacao, transicoes e transacoes sem depender de `request`/`reply`. Repositories isolam consultas Prisma e carregam relacionamentos usados pelas respostas. A divisao facilita substituir a interface e exercitar as regras sem transportar logica para rotas.

## Fastify

Fastify foi escolhido por plugins, hooks, schemas JSON e boa integracao com Swagger. Express seria uma alternativa familiar e flexivel, mas exigiria compor separadamente validacao, documentacao e plugins. Fastify requer manter schemas coerentes com tipos e a documentacao gerada.

## PostgreSQL e Prisma

PostgreSQL substitui os arquivos criptografados da AV1 como persistencia central para varios usuarios. Oferece chaves estrangeiras, tipos enumerados, JSONB para clausulas, UUID e constraints no banco. O Prisma fornece client tipado e migrations versionadas. O custo e manter migrations e client sincronizados e usar SQL manual quando a constraint nao cabe no schema Prisma.

## Modelo de dominio

Organizacao tem um contrato opcional e muitos lotes, como no enunciado. Lote referencia organizacao e contrato; equipamento pertence ao lote; movimentacao referencia equipamento e usuario. Contrato e unico por organizacao conforme o modelo solicitado, embora a AV1 permitisse mais contratos no armazenamento. Para representar historico contratual no futuro, a unicidade deve ser revista junto da regra de negocio.

## Validacoes transportadas da AV1

O CNPJ e normalizado e validado com digitos verificadores; codigo interno e uppercase com 4 a 40 caracteres alfanumericos ou hifen. A transicao de rastreamento segue `RECEBIDO -> EM_TRIAGEM -> APTO_REUSO/APTO_RECICLAGEM -> EM_DESMONTE -> DESCARTADO`, com o caminho de descarte permitido a partir dos estados aprovados. A triagem completa e exigida antes do desmonte e uma piora fisica de duas ou mais categorias pede justificativa. Contratos verificam organizacao ativa, datas e valor nao negativo.

## Senhas e JWT

A AV1 usa SHA-256 com salt aleatorio e comparacao em tempo constante. AV2 conserva a mesma implementacao para compatibilidade com o exercicio. O custo e que SHA-256 nao e uma funcao lenta de derivacao de senha; em uma evolucao de producao, migrar para Argon2id/bcrypt exigiria versionar hashes e rehash durante logins. JWT stateless substitui o mapa de sessoes da CLI e facilita requisicoes paralelas, mas nao revoga tokens emitidos antes de expirarem; reduzir expiracao ou adicionar lista de revogacao sao alternativas.

## Transacoes e concorrencia

Criar lote com equipamentos e adicionar equipamento com a primeira movimentacao sao atomicos. Mudanca de equipamento e sua movimentacao tambem sao atomicas. Updates usam `id` e `versao` e incrementam a versao; zero linhas atualizadas resulta em `409`, evitando sobrescrever uma edicao concorrente. O cliente deve recarregar e reaplicar uma alteracao conflitante.

## Constraints

As validacoes HTTP e de service retornam erros legiveis, enquanto constraints no PostgreSQL tambem protegem dados inseridos por scripts ou outras interfaces. Unicidade, chaves estrangeiras, valores nao negativos, datas coerentes, faixas de configuracao e formato de CNPJ/codigo de barras sao impostas no banco. A validacao repetida tem custo de manutencao, mas impede inconsistencias fora do servidor.

## Decimais globais

AV1 armazena aliquota de imposto e coeficiente de depreciacao e exige valores de 0 a 1. AV2 preserva os campos e a faixa em `ConfiguracaoGlobal`; a AV1 nao define calculo monetario aplicado a esses coeficientes, portanto a API nao inventa uma formula financeira.
