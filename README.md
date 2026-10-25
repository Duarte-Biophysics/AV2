# GreenCode AV2

API REST monolitica para cadastro e rastreabilidade de equipamentos eletronicos, baseada nas entidades e regras da AV1. A AV1 permanece separada e nao e modificada.

## Requisitos

- Node.js 20 ou superior (desenvolvimento realizado com Node 24).
- PostgreSQL 14 ou superior com o banco `greencode` criado.
- Windows 10+ ou Ubuntu 24.04.3+ (e distribuicoes derivadas).

## Configuracao inicial

Abra um terminal nesta pasta `AV2` e instale as dependencias:

```sh
npm install
```

Copie `.env.example` para `.env`, mantenha o `DATABASE_URL` com a senha do usuario PostgreSQL e ajuste se necessario. Defina `JWT_SECRET` com pelo menos 32 caracteres. A aplicacao le `PORT` (padrao `3333`) e `JWT_EXPIRES_IN` (padrao `1h`). O `.env` local nao deve ser enviado ao Git.

Crie as tabelas a partir das migracoes versionadas e gere o client:

```sh
npx prisma migrate dev
npx prisma generate
```

Compile antes do seed e da primeira inicializacao:

```sh
npm run build
npx prisma db seed
```

O seed cria organizacao, contrato, lote, equipamentos em estados diferentes e quatro usuarios. Por padrao, todos usam a senha `GreenCode123!`. Para escolher outra senha antes do seed, configure `SEED_PASSWORD` no ambiente. Essa massa e apenas demonstrativa; altere as credenciais para qualquer uso real.

| Login | Papel |
| --- | --- |
| `admin@greencode.local` | `ADMINISTRADOR` |
| `cadastro@greencode.local` | `OPERADOR_CADASTRO` |
| `almoxarifado@greencode.local` | `GESTOR_ALMOXARIFADO` |
| `auditor@greencode.local` | `AUDITOR` |

## Executar

Modo de desenvolvimento com recarga:

```sh
npm run dev
```

Build e execucao compilada:

```sh
npm run build
npm start
```

O servidor escuta na porta configurada. `GET /health` e publico; a documentacao Swagger UI fica em `/docs`. Use `Ctrl+C` para encerrar: o servidor fecha conexoes HTTP e desconecta o Prisma.

## Autenticacao e exemplos

Obtenha um token:

```sh
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin@greencode.local","senha":"GreenCode123!"}'
```

Envie o token em `Authorization: Bearer <token>` nas demais rotas. Exemplo de consulta:

```sh
curl http://localhost:3333/organizacoes \
  -H "Authorization: Bearer <token>"
```

Rotas principais: `POST /organizacoes`, `POST /contratos`, `POST /lotes`, `POST /equipamentos`, `PATCH /equipamentos/:id/movimentacoes`, `GET /equipamentos/:codigoBarras/rastreabilidade`, `GET /movimentacoes` e `PATCH /configuracao-global`. Exclusoes retornam `204` quando possiveis; se houver historico ou dependencias, a constraint referencial retorna `409`. A API valida os corpos conforme JSON Schema e responde erros como `{ "error": "...", "statusCode": 409 }`. Atualizacoes recebem `versao` lida; conflito de versao retorna `409`.

## Persistencia e desenvolvimento

Para criar uma nova migracao:

```sh
npx prisma migrate dev --name nome_da_migracao
```

Para abrir o banco:

```sh
npx prisma studio
```

As migrations guardam as restricoes de valor e intervalo do contrato, parametros globais entre 0 e 1, formato de CNPJ e codigo de barras. As operacoes de cadastro de lote/equipamentos e atualizacao de status/movimentacao usam transacoes.

Para rodar a suite automatizada, use `npm test`. Ela compila o projeto, prepara o banco isolado `greencode_av2_test`, aplica as migracoes e o seed nesse banco e executa os testes sem escrever no banco principal `greencode`.

## Compatibilidade

Os scripts npm e caminhos do projeto sao portaveis entre Windows e Linux. Foi implementado e conferido neste ambiente Windows; a execucao em Ubuntu deve usar Node.js e PostgreSQL instalados no sistema. Configure `DATABASE_URL` localmente em cada sistema e aplique `npx prisma migrate deploy` em ambiente de implantacao.
