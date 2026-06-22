---
title: Autenticação
tags: [auth, login, md5, segurança]
---

# 🔐 Autenticação

Veja também: [[Rotas]] · [[erp_usuario]] · [[Convenções]] · [[Legado]]

## Onde acontece
Dois pontos de login, ambos sobre a tabela [[erp_usuario]] com a **mesma lógica**:
- [[Vendedoras]] → `POST /vendedoras/login` (retorna usuário + dados da [[erp_vendedores|vendedora]])
- [[Usuarios]] → `GET /usuarios/login` (retorna só o usuário)

## Regras de validação
1. Normaliza: `usu_login = login.trim().toUpperCase()`, `usu_senha = senha.trim()`.
2. Calcula `senhaHash = md5(usu_senha)`.
3. Busca por `usu_login` (campo **unique**).
4. Rejeita se não existe ou `usu_ativo !== 1` → `401`.
5. Compara `usu_senha (banco)` (lowercase) com `senhaHash` → `401` se diferente.
6. Sucesso → retorna o usuário **sem** `usu_senha`.

## Formato da senha
- `erp_usuario.usu_senha` é **MD5** (32 chars hex). Ex.: `md5("12345") = 827ccb0eea8a706c4c34a16891f84e7b`.
- Gerada com `node:crypto` → `createHash('md5').update(senha.trim()).digest('hex')`.
- ⚠️ MD5 é fraco (legado do ERP). Mantido por compatibilidade com a base existente.

## Notas de segurança
- `GET /usuarios/login` expõe a senha na URL (logs/histórico). Preferir POST fora de teste.
- **Não há `AuthGuard` global** ativo — as rotas atuais são públicas. O `services/auth.guard.ts`
  (JWT) existe mas não está plugado. JWT/bcrypt do [[Legado|auth legado]] não são usados aqui.
