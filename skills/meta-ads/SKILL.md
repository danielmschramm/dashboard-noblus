---
name: meta-ads
description: >
  Fetches Meta Ads performance metrics for Noblus® and displays a formatted
  dashboard with ROAS, CAC, CPA (add-to-cart), Hook Rate, Hold Rate, CTR Link,
  Frequency, and CPM — with visual status indicators per metric.
description_pt-BR: >
  Busca métricas de performance do Meta Ads para a Noblus® e exibe um dashboard
  formatado com ROAS, CAC, CPA (carrinho), Hook Rate, Hold Rate, CTR Link,
  Frequência e CPM — com indicadores visuais de status por métrica.
type: script
version: "1.0.0"
script:
  path: scripts/fetch.js
  runtime: node
  invoke: "node --env-file=.env {skill_path}/scripts/fetch.js --days {days} --level {level}"
env:
  - META_ACCESS_TOKEN
  - META_AD_ACCOUNT_ID
categories: [marketing, analytics, meta-ads, paid-traffic]
---

# Meta Ads — Noblus® Dashboard

## Quando usar

Use essa skill sempre que o usuário pedir para ver métricas do Meta Ads, analisar campanhas, verificar ROAS, checar criativos ou monitorar saúde das campanhas.

## Métricas monitoradas

### Eficiência e Lucro
- **ROAS** — Retorno sobre investimento (meta: ≥ 4x)
- **CAC** — Custo por compra realizada
- **CPA (carrinho)** — Custo por adição ao carrinho

### Criativo
- **Hook Rate** — % que assistiu ≥ 3s (meta: ≥ 30%)
- **Hold Rate** — % que assistiu ≥ 15s (meta: ≥ 20%)
- **CTR Link** — % que clicou no link (meta: ≥ 1.5%)

### Saúde da Entrega
- **Frequência** — Exibições por pessoa (meta: ≤ 3x por 7 dias)
- **CPM** — Custo por mil impressões

## Instruções

1. Se `META_AD_ACCOUNT_ID` não estiver no `.env`, o script lista as contas disponíveis automaticamente e usa a primeira.
2. Execute o script com os parâmetros desejados.
3. Apresente os resultados ao usuário com análise dos pontos críticos (❌ ou ⚠️).
4. Se houver métricas críticas, sugira ajustes (público, criativo, frequência, etc.).

## Como executar

```bash
# Últimos 7 dias por campanha (padrão)
node --env-file=.env skills/meta-ads/scripts/fetch.js

# Últimos 30 dias
node --env-file=.env skills/meta-ads/scripts/fetch.js --days 30

# Por conjunto de anúncios
node --env-file=.env skills/meta-ads/scripts/fetch.js --level adset

# Visão geral da conta
node --env-file=.env skills/meta-ads/scripts/fetch.js --level account
```

## Setup (.env)

```
META_ACCESS_TOKEN=seu_token_aqui
META_AD_ACCOUNT_ID=seu_account_id_aqui   # opcional — autodetectado se vazio
```

### Como obter META_AD_ACCOUNT_ID

No Graph API Explorer, faça GET em `/me/adaccounts?fields=name,account_id` — o `account_id` retornado (sem o prefixo `act_`) é o valor para o `.env`.

## Níveis disponíveis

| `--level`  | Agrupa por       |
|------------|------------------|
| `account`  | Conta toda       |
| `campaign` | Campanha (padrão)|
| `adset`    | Conjunto de anúncio |
| `ad`       | Anúncio individual |
