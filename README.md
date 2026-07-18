# V360 · Radar Fiscal

Protótipo de monitoramento de integração de notas fiscais, desenvolvido como estudo de caso para uma vaga de Analista de Dados focada em qualidade de dados, integrações e automação na área financeira.

## O problema

Em ecossistemas de dados grandes, com múltiplas fontes (ERP, sistema fiscal, CRM), é comum surgirem divergências entre o que é faturado e o que é escriturado: notas duplicadas, registros faltantes na origem, valores divergentes ou atrasos na carga. Esse projeto simula um painel de reconciliação para monitorar esse tipo de problema em tempo real, com um assistente de dados para consultas em linguagem natural.

## Componentes

| Pasta/arquivo | Descrição |
|---|---|
| `dados/notas_fiscais_v360.xlsx` | Base simulada de 173 notas fiscais (30 dias), com status de conciliação, tipo de divergência e valor em risco. |
| `powerbi/v360_radar_fiscal.pbix` | Dashboard completo em Power BI: cartões de KPI, volume diário por status, divergências por unidade e por tipo, com segmentadores e tabela detalhada. |
| `powerbi/v360_tema_powerbi.json` | Tema de cores customizado usado no dashboard acima. |
| `dashboard/v360_radar_fiscal.jsx` | Protótipo de dashboard interativo (React) com KPIs, gráficos de volume/divergência e um assistente de IA integrado. |
| `chatbot/v360_assistente.jsx` | Versão standalone do assistente de dados (React), com os mesmos dados da planilha. |
| `n8n/workflow.json` | Workflow do n8n que implementa o mesmo assistente usando um Chat Trigger + AI Agent + Google Gemini (gratuito). |
| `sql/schema_notas_fiscais.sql` | Schema da tabela `notas` e exemplos das consultas SQL usadas pelo assistente para responder perguntas. |
| `index.html` | Chatbot público (GitHub Pages): SQLite rodando no navegador (sql.js) + IA (Groq, modelo gpt-oss-20b) que escreve e executa SQL de verdade para responder perguntas sobre os dados. |

## Principais indicadores simulados

- Total de notas no período e taxa de conciliação
- Valor total em risco (soma das divergências)
- Divergências por unidade de negócio e por tipo (valor divergente, nota duplicada, nota faltante na origem, atraso na carga)

## Stack

- **Dados**: Python (pandas/openpyxl) para geração e formatação da base
- **Dashboard**: Power BI (medidas DAX) e um protótipo React (Recharts)
- **Assistente de dados**: n8n (AI Agent) + Google Gemini API, respondendo perguntas em linguagem natural com base nos dados reais da planilha

## Como rodar o assistente (n8n)

1. Instale o Node.js (LTS) e rode `npx n8n`.
2. Crie uma API key gratuita em [Google AI Studio](https://ai.google.dev).
3. Importe `n8n/workflow.json` no n8n (Menu → Import from File).
4. Configure a credencial do Google Gemini com sua API key.
5. Publique o workflow e abra o chat.

## Contexto

Este é um projeto de portfólio/estudo de caso, com dados simulados — não representa nenhuma empresa real.

Este é um projeto de portfólio/estudo de caso, com dados simulados — não representa nenhuma empresa real.
