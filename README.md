# GreenCode AV2

GreenCode AV2 é uma API REST para cadastro e rastreabilidade de equipamentos eletrônicos. Ela permite organizar dados de organizações, contratos, lotes, equipamentos e movimentações, com acesso controlado por usuários e permissões.

A AV2 é um serviço HTTP. Para consultar e usar as operações, acesse a documentação interativa da API pelo navegador, use um cliente HTTP ou inicie a interface CLI incluída no projeto.

## O que você precisa

- Node.js 20 ou superior e npm.
- PostgreSQL 14 ou superior, em execução.
- Um banco PostgreSQL chamado `greencode` (ou outro nome, informado na configuração).

## Baixar o projeto

Com Git, abra um terminal no local onde deseja guardar o projeto e execute:

```sh
git clone <URL_DO_REPOSITORIO> AV2
cd AV2
```

Troque `<URL_DO_REPOSITORIO>` pelo endereço HTTPS do repositório no GitHub. Se baixou o projeto como ZIP, extraia-o e abra um terminal dentro da pasta `AV2`.

## Configurar e iniciar pela primeira vez

Na pasta `AV2`, instale as dependências:

```sh
npm install
```

Crie o arquivo `.env` a partir do modelo `.env.example` (no Windows PowerShell):

```powershell
Copy-Item .env.example .env
```

No macOS ou Linux, use `cp .env.example .env`.

Edite `.env` e configure:

- `DATABASE_URL`: endereço de conexão do PostgreSQL, com usuário, senha, endereço, porta e nome do banco. O valor de exemplo usa `localhost:5432` e o banco `greencode`.
- `JWT_SECRET`: uma chave aleatória com pelo menos 32 caracteres, usada para proteger as sessões.
- `PORT`: porta HTTP da aplicação (opcional; o padrão é `3333`).

Mantenha o `.env` apenas na sua máquina; não compartilhe nem publique esse arquivo. O PostgreSQL precisa estar ligado e o banco indicado em `DATABASE_URL` precisa existir.

Prepare o banco e os dados iniciais:

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
npx prisma db seed
```

O seed cria dados demonstrativos para você conseguir experimentar a API, incluindo usuários de cada papel. Por padrão, a senha desses usuários é `GreenCode123!`; altere-a antes de usar a aplicação em um ambiente real. Para trocar a senha dos usuários criados pelo seed, configure `SEED_PASSWORD` antes de executar o seed.

Agora inicie a aplicação:

```sh
npm start
```

O servidor ficará disponível na porta configurada. Para encerrar, use `Ctrl+C` no terminal.

## Usar a interface CLI

A CLI é uma interface de terminal para testar as operações da API. Ela se conecta ao servidor HTTP; portanto, mantenha o servidor em execução em um terminal e abra outro terminal na pasta `AV2`.

Depois de compilar o projeto, inicie a CLI:

```sh
npm run build
npm run cli
```

Informe o login e a senha de um usuário cadastrado. O seed fornece contas demonstrativas listadas abaixo, com senha padrão `GreenCode123!`. Após autenticar, a CLI mostra os comandos disponíveis para o papel da conta. Use `ajuda` para exibir o menu novamente e `sair` para encerrar a sessão.

Os comandos aceitam opções como `--nome valor`; coloque entre aspas os valores com espaços. Por exemplo:

```text
org criar --razao "Universidade Exemplo" --nome "Exemplo" --cnpj 11222333000181
org listar
```

Por padrão, a CLI se conecta a `http://127.0.0.1:3333`. Para usar outra URL ou porta, configure `GREENCODE_API_URL` ou `PORT` no ambiente antes de iniciá-la.

## Acessar e usar a API

Com o servidor em execução:

- Documentação interativa: `http://localhost:3333/docs`
- Verificação de funcionamento: `http://localhost:3333/health`

Abra `/docs` no navegador para conhecer as operações e enviar requisições. Para acessar as rotas protegidas, primeiro faça login pela operação `POST /auth/login` com um dos usuários de demonstração. Use o token retornado no cabeçalho `Authorization` das requisições seguintes.

### Fazer login e autorizar chamadas no Swagger

1. Abra `POST /auth/login`, clique em **Try it out** e informe o login e a senha de uma conta cadastrada. Por exemplo, se os dados demonstrativos foram preparados e a senha padrão não foi alterada:

   ```json
   {
     "login": "admin@greencode.local",
     "senha": "GreenCode123!"
   }
   ```

2. Clique em **Execute**. Se o login der certo, a resposta terá código `200`. Na seção **Response body**, localize o campo `"token"` e copie somente o valor entre aspas (a sequência longa que começa normalmente com `eyJ`).

3. Clique em **Authorize** (ícone de cadeado do Swagger), cole o valor do token e confirme. No campo de autorização do Swagger, não inclua aspas nem escreva `Bearer`.

4. Agora execute as operações protegidas, como `GET /usuarios` (somente administrador) ou `GET /organizacoes`. Se o token expirar ou a API responder `401`, faça login novamente e autorize com o token novo.

Se `POST /auth/login` responder `401`, confira o login e a senha. Os usuários de demonstração só existem depois que os dados iniciais foram criados; a senha pode ter sido definida pela variável `SEED_PASSWORD`. Trate o token como uma credencial: não o compartilhe nem publique capturas que o mostrem.

Usuários de demonstração:

| Login | Papel |
| --- | --- |
| `admin@greencode.local` | `ADMINISTRADOR` |
| `cadastro@greencode.local` | `OPERADOR_CADASTRO` |
| `almoxarifado@greencode.local` | `GESTOR_ALMOXARIFADO` |
| `auditor@greencode.local` | `AUDITOR` |

As permissões dependem do papel do usuário. Entre as operações disponíveis estão cadastro de organizações, contratos, lotes e equipamentos, registro de movimentações e consulta de rastreabilidade.

## Inícios seguintes

Depois da configuração inicial, com o PostgreSQL em execução, basta abrir um terminal na pasta `AV2` e executar:

```sh
npm start
```

Se alterar `PORT` no `.env`, use a porta configurada ao abrir a documentação e a verificação de funcionamento.
