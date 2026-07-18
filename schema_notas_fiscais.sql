-- ============================================================
-- V360 · Radar Fiscal — schema do banco de notas fiscais
-- Usado pelo assistente de dados (chatbot) via consultas SQL
-- em tempo real, rodando em SQLite no navegador (sql.js).
-- ============================================================

CREATE TABLE notas (
    id                  TEXT PRIMARY KEY,   -- número da nota fiscal, ex: NF-20260616-0001
    unidade             TEXT NOT NULL,      -- unidade de negócio (UN Leste, UN Centro, etc.)
    data                TEXT NOT NULL,      -- data de emissão, formato YYYY-MM-DD
    valor_erp           REAL,               -- valor registrado no sistema de origem (ERP)
    valor_nf            REAL,               -- valor da nota fiscal emitida (NULL se ainda pendente)
    diferenca           REAL,               -- valor_nf - valor_erp
    status              TEXT NOT NULL,      -- 'Conciliado' | 'Divergente' | 'Pendente'
    tipo_divergencia    TEXT,               -- 'Valor divergente' | 'Nota duplicada' |
                                             -- 'Nota faltante na origem' | 'Atraso na carga'
    dias_atraso         INTEGER DEFAULT 0,  -- dias de atraso na carga (quando aplicável)
    valor_risco         REAL DEFAULT 0      -- valor em risco (abs(diferenca) quando Divergente)
);

-- ============================================================
-- Exemplos de consultas que o assistente de dados executa
-- em resposta a perguntas em linguagem natural
-- ============================================================

-- Visão geral: quantas notas em cada status
SELECT status, COUNT(*) AS quantidade
FROM notas
GROUP BY status;

-- Taxa de conciliação
SELECT
    ROUND(100.0 * SUM(CASE WHEN status = 'Conciliado' THEN 1 ELSE 0 END) / COUNT(*), 1) AS taxa_conciliacao_pct
FROM notas;

-- Unidades com mais divergências (a pergunta mais comum)
SELECT unidade, COUNT(*) AS divergencias
FROM notas
WHERE status = 'Divergente'
GROUP BY unidade
ORDER BY divergencias DESC;

-- Valor total em risco
SELECT COALESCE(SUM(valor_risco), 0) AS valor_total_em_risco
FROM notas
WHERE status = 'Divergente';

-- Divergências por tipo
SELECT tipo_divergencia, COUNT(*) AS quantidade
FROM notas
WHERE status = 'Divergente'
GROUP BY tipo_divergencia
ORDER BY quantidade DESC;

-- Notas com atraso na carga acima de 4 dias
SELECT id, unidade, data, dias_atraso
FROM notas
WHERE tipo_divergencia = 'Atraso na carga' AND dias_atraso > 4
ORDER BY dias_atraso DESC;

-- Notas pendentes de conciliação
SELECT id, unidade, data, valor_erp
FROM notas
WHERE status = 'Pendente'
ORDER BY data DESC;

-- Possíveis notas duplicadas (valor da NF é o dobro do valor de origem)
SELECT id, unidade, data, valor_erp, valor_nf
FROM notas
WHERE tipo_divergencia = 'Nota duplicada';
