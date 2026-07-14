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

## Filtro de situacao do cliente (revendedoras)
> ℹ️ Em **todas** as rotas que retornam clientes/revendedoras — `/listas/corrida`, `/listas/top30`, `/listas/super-ofensiva`, `/listas/aniversariantes`, `/listas/desativacao`, `/clientes/compras-mes`, `/clientes/ativos`, `GET /fashionstars` e `GET /fashionstars/:cpfcnpj` — são **omitidos** os clientes com `erp_clientes_real.clientes_id_situacao` (ou `view_base_12meses.situacao`, mesma coluna) em **6 (ABERTO), 8 (EM ATENDIMENTO), 9 (AGENDADO) e 95**.
> O total de vendas de `/meta-vendedoras/liga` **não** aplica esse filtro (soma o valor faturado da Liga).
> Telefone retornado = **celular** (`clientes_telefone2`) com fallback para o fixo (`clientes_telefone1`).

## Respostas padrão
- `200/201` sucesso · `400` validação · `401` credenciais · `404` não encontrado · `409` login duplicado.
- Nenhuma resposta inclui `usu_senha` (ver [[Convenções]]).
