---
title: Rotas
tags: [rotas, endpoints, api]
---

# 🛣️ Rotas (Endpoints)

Veja também: [[Início]] · [[Autenticação]] · [[Convenções]]
Base URL: `http://localhost:3354` · Swagger: `/doc`

## Aplicação
| Método | Rota | Descrição | Módulo |
|---|---|---|---|
| GET | `/` | Status/healthcheck da API | RootController ([[Arquitetura]]) |

## [[Vendedoras]]
| Método | Rota | Descrição |
|---|---|---|
| POST | `/vendedoras/login` | Login da vendedora; retorna `usuario` + `vendedora` |

Body: `{ "usu_login": "JULIANA.FERREIRA", "usu_senha": "12345" }`

## [[Usuarios]]
| Método | Rota | Descrição |
|---|---|---|
| POST | `/usuarios` | Cria usuário (senha→MD5, login→MAIÚSCULO) |
| GET | `/usuarios/login` | **Login por query** `?usu_login=...&usu_senha=...` |
| GET | `/usuarios` | Lista ativos (`usu_ativo = 1`) |
| GET | `/usuarios/:usu_cod` | Busca por código |
| PATCH | `/usuarios/:usu_cod` | Atualiza (parcial) |
| DELETE | `/usuarios/:usu_cod` | **Soft delete** (`usu_ativo = 0`) |

> ⚠️ `GET /usuarios/login` foi declarado **antes** de `GET /usuarios/:usu_cod` no controller
> para a palavra `login` não cair na rota de busca por id.

## [[Fashionstars]]
| Método | Rota | Descrição |
|---|---|---|
| GET | `/fashionstars` | Lista ativos (`ativo = 'S'`) |
| GET | `/fashionstars/:cpfcnpj` | Busca por CPF/CNPJ + cálculo de saldo |

## Clientes
| Método | Rota | Descrição |
|---|---|---|
| POST | `/clientes/compras-mes` | Compra por mês do cliente (líquido = vendas − trocas), somando vinculados (matriz) |
| GET | `/clientes/ativos` | Clientes ativos: compras líquidas ≥ R$1 nos últimos 6 meses-calendário fechados (mês corrente excluído); 1 linha por cliente (registro mais recente da janela) |

`GET /clientes/ativos` não recebe parâmetros. Fonte: `view_base_12meses` (agregação ao vivo,
sem cache/job agendado). Campos: `codparc, nome, cpfcnpj, telefone, situacao, vendedora`.

## [[CentralAuth]]
| Método | Rota | Descrição |
|---|---|---|
| POST | `/central-auth/login` | Login delegado ao CentralBabita (bridge servidor-a-servidor) |

Body: `{ "login": "...", "senha": "..." }` (senha em texto puro, hasheada em MD5 antes de
sair para o Central). Subdivisão de **integração** para apps Lovable além da Liga Fashion
Stars — hoje usada por contas do setor Fornecedores. Ver [[CentralAuth]] para o fluxo
completo e a limitação de segurança herdada do Central.

## FichaRisco
Clientes em risco de perder ficha (compra líquida < R$3.200 nos 2 meses-calendário
fechados anteriores ao mês de referência). Diferente das demais rotas: **tem histórico
persistido** (tabela `lovable_ficha_risco_historico` em **bd_babitacentral**, servidor 251
— não em bd_think), com snapshot congelado no início do mês e fechamento no fim; nunca
recalcula ou sobrescreve depois de gravado. Oculta situação 6/8/9/95 (mesmo critério das
outras rotas). Fonte de leitura: `view_base_12meses` (bd_think).

| Método | Rota | Descrição |
|---|---|---|
| POST | `/ficha-risco/snapshot` | Dispara o snapshot de início de mês (idempotente — se já existir, só retorna) |
| POST | `/ficha-risco/fechamento` | Fecha o mês (grava valor_realizado/atingiu/vendedora/loja de fechamento) |
| GET | `/ficha-risco/atual` | Snapshot do mês corrente já persistido (não calcula ao vivo) |
| GET | `/ficha-risco/historico` | Histórico com filtros opcionais `mesReferencia`, `vendedora`, `loja` |

Query opcional `mesReferencia` (YYYY-MM) nas rotas POST — default = mês corrente
(`snapshot`) ou o mês aberto mais antigo (`fechamento`). `vendedora`/`loja` no registro
histórico são as do **fechamento** (fim do mês), não as do início — se o cliente mudar de
vendedora/loja no meio do mês, prevalece a última. Resposta de `atual`/`historico`: lista
de clientes (`codparc, nome, vendedora, loja, lojas_nome, valor_necessario,
valor_realizado, atingiu`) + agregações `porVendedora`/`porLoja` (contagem em risco, quantos
atingiram, soma valor_necessario/valor_realizado) + totais gerais.

Agendado no crontab do root (202), dia 1 de cada mês: fecha o mês anterior e abre o
snapshot do novo mês no mesmo disparo.

## Filtro de situacao do cliente (revendedoras)
> ℹ️ Em **todas** as rotas que retornam clientes/revendedoras — `/listas/corrida`, `/listas/top30`, `/listas/super-ofensiva`, `/listas/aniversariantes`, `/listas/desativacao`, `/clientes/compras-mes`, `/clientes/ativos`, `/ficha-risco/*`, `GET /fashionstars` e `GET /fashionstars/:cpfcnpj` — são **omitidos** os clientes com `erp_clientes_real.clientes_id_situacao` (ou `view_base_12meses.situacao`, mesma coluna) em **6 (ABERTO), 8 (EM ATENDIMENTO), 9 (AGENDADO) e 95**.
> O total de vendas de `/meta-vendedoras/liga` **não** aplica esse filtro (soma o valor faturado da Liga).
> Telefone retornado = **celular** (`clientes_telefone2`) com fallback para o fixo (`clientes_telefone1`).

## Respostas padrão
- `200/201` sucesso · `400` validação · `401` credenciais · `404` não encontrado · `409` login duplicado.
- Nenhuma resposta inclui `usu_senha` (ver [[Convenções]]).
