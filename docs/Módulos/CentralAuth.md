---
title: Módulo CentralAuth
tags: [módulo, login, integração, central]
---

# 🔗 Módulo CentralAuth

Pasta: `src/modules/routes/centralAuth/` · Depende de: CentralBabita (sistema externo, não é banco desta API)
Veja também: [[Rotas]] · [[Autenticação]] · [[Usuarios]]

## Responsabilidade
Subdivisão de **integração**: login delegado ao CentralBabita, para apps Lovable que devem
autenticar contra contas já cadastradas lá (hoje, principalmente contas do setor
**Fornecedores**, que passaram a receber no Central a mesma senha real do ERP — ver
[[erp_usuario]]).

Diferença para [[Vendedoras]]/[[Usuarios]]: aqueles validam direto contra `erp_usuario`
nesta própria API; o CentralAuth **não toca no banco** — é uma ponte HTTP
servidor-a-servidor até o CentralBabita, que é quem guarda/valida essas contas.

## Endpoint
| Método | Rota | Service |
|---|---|---|
| POST | `/central-auth/login` | `login` |

Body: `{ "login": "...", "senha": "..." }` (senha em texto puro — protegida pelo HTTPS).

## Fluxo do `login`
1. Hasheia a senha em MD5 (mesmo formato usado em toda a API — ver [[Autenticação]]).
2. `POST` para o CentralBabita: `Personalizado/AuthExterno/Login`, no IP **interno**
   `192.168.0.204:3010` (não o domínio público `api.central.babita.com.br` — esse teve
   incidentes de 503 e de servir código desatualizado em 14/07/2026).
3. Autentica a chamada com o header `X-Integracao-Chave` (env `CENTRAL_AUTH_SECRET`,
   validado no Central contra `INTEGRACAO_AUTH_SECRET`).
4. `401` do Central → `UnauthorizedException` aqui. Erro de rede/config → `502 BadGatewayException`.
5. Sucesso → `{ autenticado: true, usuario: {...perfil do Central, sem senha...} }`.

## ⚠️ Limitação herdada
O CentralBabita hoje **não tem sessão/token real pós-login** (backend confia em campos do
próprio corpo da requisição, sem validar quem está de fato chamando — achado crítico de
14/07/2026). A chave de integração aqui só autentica **este servidor** como chamador
legítimo; não é, e não substitui, uma sessão de usuário final. Não expor esta rota nem o
endpoint do Central em domínio público sem revisar essa limitação primeiro.

## Segurança/senha
MD5 é hash de **mão única** — em nenhum ponto desta cadeia (aqui, no Central ou no ERP) há
"descriptografia". `pw_md5` no Central e `erp_usuario.usu_senha` usam o mesmo algoritmo
(`md5(senha)`, sem sal); por isso a senha real do ERP pôde ser copiada direto para as
contas de Fornecedores no Central sem nunca precisar ser revertida.
