import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CheckCircle2,
  AlertTriangle,
  Wallet,
  FileText,
  Send,
  Bot,
  User,
  Loader2,
  LayoutDashboard,
  MessageSquare,
} from "lucide-react";

// ---------- deterministic pseudo-random generator (stable demo data) ----------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UNIDADES = ["UN Leste", "UN Oeste", "UN Norte", "UN Sul", "UN Centro", "UN Vale do Paraíba"];
const TIPOS_DIVERGENCIA = ["Valor divergente", "Nota duplicada", "Nota faltante na origem", "Atraso na carga"];

const STATUS_LABEL = { conciliado: "CONCILIADO", divergente: "DIVERGENTE", pendente: "PENDENTE" };

function formatBRL(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
function formatDateShort(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatDateFull(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function generateRecords() {
  const rand = mulberry32(1337);
  const records = [];
  let idx = 0;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    date.setDate(date.getDate() - dayOffset);
    const count = 4 + Math.floor(rand() * 5); // 4–8 notas/dia

    for (let c = 0; c < count; c++) {
      idx += 1;
      const unidade = UNIDADES[Math.floor(rand() * UNIDADES.length)];
      const valorOrigem = Math.round(30000 + rand() * 450000);
      const roll = rand();

      let status = "conciliado";
      let tipoDivergencia = null;
      let valorNF = valorOrigem;
      let diferenca = 0;
      let atrasoDias = null;
      let origemAusente = false;

      if (roll < 0.05) {
        status = "pendente";
        valorNF = null;
        diferenca = null;
      } else if (roll < 0.05 + 0.14) {
        status = "divergente";
        tipoDivergencia = TIPOS_DIVERGENCIA[Math.floor(rand() * TIPOS_DIVERGENCIA.length)];

        if (tipoDivergencia === "Valor divergente") {
          let pct = rand() * 0.16 - 0.08;
          if (Math.abs(pct) < 0.015) pct = pct >= 0 ? 0.03 : -0.03;
          valorNF = Math.round(valorOrigem * (1 + pct));
          diferenca = valorNF - valorOrigem;
        } else if (tipoDivergencia === "Nota duplicada") {
          valorNF = valorOrigem;
          diferenca = valorOrigem;
        } else if (tipoDivergencia === "Nota faltante na origem") {
          origemAusente = true;
          valorNF = valorOrigem;
          diferenca = valorOrigem;
        } else if (tipoDivergencia === "Atraso na carga") {
          valorNF = valorOrigem;
          diferenca = 0;
          atrasoDias = 2 + Math.floor(rand() * 5);
        }
      }

      const dateKey = isoDate(date);
      records.push({
        id: `NF-${dateKey.replace(/-/g, "")}-${String(idx).padStart(4, "0")}`,
        unidade,
        data: date,
        dateKey,
        valorOrigem,
        origemAusente,
        valorNF,
        status,
        tipoDivergencia,
        diferenca,
        atrasoDias,
      });
    }
  }
  return records;
}

function StatusStamp({ status }) {
  return <span className={`stamp stamp-${status}`}>{STATUS_LABEL[status]}</span>;
}

export default function V360RadarFiscal() {
  const records = useMemo(() => generateRecords(), []);
  const [activeTab, setActiveTab] = useState("painel");
  const [statusFilter, setStatusFilter] = useState("problemas");
  const [unidadeFilter, setUnidadeFilter] = useState("todas");
  const [syncMinAgo] = useState(() => 1 + Math.floor(Math.random() * 11));

  const aggregates = useMemo(() => {
    const total = records.length;
    const conciliadas = records.filter((r) => r.status === "conciliado");
    const divergentes = records.filter((r) => r.status === "divergente");
    const pendentes = records.filter((r) => r.status === "pendente");
    const taxaConciliacao = total ? (conciliadas.length / total) * 100 : 0;
    const valorEmRisco = divergentes.reduce((s, r) => s + Math.abs(r.diferenca || 0), 0);

    const porUnidade = {};
    UNIDADES.forEach((u) => (porUnidade[u] = 0));
    divergentes.forEach((r) => (porUnidade[r.unidade] += 1));

    const porTipo = {};
    TIPOS_DIVERGENCIA.forEach((t) => (porTipo[t] = 0));
    divergentes.forEach((r) => (porTipo[r.tipoDivergencia] += 1));

    const porDiaMap = {};
    records.forEach((r) => {
      if (!porDiaMap[r.dateKey]) porDiaMap[r.dateKey] = { dateKey: r.dateKey, conciliado: 0, divergente: 0, pendente: 0 };
      porDiaMap[r.dateKey][r.status] += 1;
    });
    const porDia = Object.values(porDiaMap)
      .sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1))
      .map((d) => ({ ...d, label: formatDateShort(new Date(d.dateKey)) }));

    return {
      total,
      conciliadas,
      divergentes,
      pendentes,
      taxaConciliacao,
      valorEmRisco,
      porUnidade,
      porTipo,
      porDia,
    };
  }, [records]);

  const unidadeChartData = useMemo(
    () => UNIDADES.map((u) => ({ unidade: u.replace("UN ", ""), divergencias: aggregates.porUnidade[u] })).sort(
      (a, b) => b.divergencias - a.divergencias
    ),
    [aggregates]
  );

  const tipoChartData = useMemo(
    () => TIPOS_DIVERGENCIA.map((t) => ({ tipo: t, qtd: aggregates.porTipo[t] })).sort((a, b) => b.qtd - a.qtd),
    [aggregates]
  );

  const filteredRows = useMemo(() => {
    let rows = records;
    if (statusFilter === "problemas") rows = rows.filter((r) => r.status !== "conciliado");
    else if (statusFilter !== "todas") rows = rows.filter((r) => r.status === statusFilter);
    if (unidadeFilter !== "todas") rows = rows.filter((r) => r.unidade === unidadeFilter);
    return [...rows].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 40);
  }, [records, statusFilter, unidadeFilter]);

  // ---------------- chat ----------------
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      seed: true,
      content:
        "Oi! Sou o assistente de dados do V360. Posso responder perguntas sobre as notas fiscais dos últimos 30 dias — divergências, valores em risco, atrasos, unidades com mais problemas, entre outros. O que você quer saber?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const systemPrompt = useMemo(() => {
    const compact = records.map((r) => ({
      id: r.id,
      unidade: r.unidade,
      data: r.dateKey,
      valorOrigem: r.origemAusente ? null : r.valorOrigem,
      valorNF: r.valorNF,
      status: r.status,
      tipoDivergencia: r.tipoDivergencia,
      diferenca: r.diferenca,
      atrasoDias: r.atrasoDias,
    }));
    const resumo = {
      totalNotas: aggregates.total,
      taxaConciliacaoPct: Number(aggregates.taxaConciliacao.toFixed(1)),
      valorEmRiscoBRL: Math.round(aggregates.valorEmRisco),
      divergenciasAbertas: aggregates.divergentes.length,
      pendentes: aggregates.pendentes.length,
      divergenciasPorUnidade: aggregates.porUnidade,
      divergenciasPorTipo: aggregates.porTipo,
      periodo: "últimos 30 dias, até hoje",
    };
    return (
      "Você é o assistente de dados do painel V360 · Radar Fiscal, uma ferramenta de monitoramento de integração de notas fiscais entre o ERP e o sistema fiscal de uma empresa de saneamento. " +
      "Responda em português, de forma direta e objetiva, citando números quando fizer sentido, sempre com base nos dados abaixo. " +
      "Nunca invente números que não estejam nos dados. Se a pergunta não puder ser respondida com o que foi fornecido, diga isso claramente. " +
      "Contexto: notas 'divergente' representam risco financeiro e devem ser investigadas; 'pendente' aguardam conciliação; 'conciliado' está tudo certo.\n\n" +
      "RESUMO AGREGADO:\n" +
      JSON.stringify(resumo) +
      "\n\nREGISTROS DETALHADOS (formato compacto):\n" +
      JSON.stringify(compact)
    );
  }, [records, aggregates]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = nextMessages.filter((m) => !m.seed).map(({ role, content }) => ({ role, content }));
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });

      if (!response.ok) throw new Error("Falha na resposta da API");
      const data = await response.json();
      const textBlocks = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: textBlocks || "Não consegui gerar uma resposta agora. Tente reformular a pergunta." },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Tive um problema para consultar os dados agora. Pode tentar de novo?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const quickQuestions = [
    "Qual unidade tem mais divergências?",
    "Qual o valor total em risco agora?",
    "Tem alguma nota duplicada recente?",
    "Como está a taxa de conciliação essa semana?",
  ];

  return (
    <div className="v360-app">
      <style>{`
        .v360-app {
          --bg: #12151b;
          --bg-elevated: #1a1e26;
          --panel-border: #2a2f3a;
          --paper: #ece5d2;
          --ink: #24291f;
          --text: #e7e9ee;
          --muted: #8b93a6;
          --accent: #4fa3ad;
          --accent-soft: rgba(79, 163, 173, 0.16);
          --green: #4c8a5e;
          --green-soft: rgba(76, 138, 94, 0.14);
          --red: #b6503f;
          --red-soft: rgba(182, 80, 63, 0.14);
          --amber: #c98a2c;
          --amber-soft: rgba(201, 138, 44, 0.16);
          font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--bg);
          color: var(--text);
          border-radius: 16px;
          padding: 0;
          max-width: 1100px;
          margin: 0 auto;
          border: 1px solid var(--panel-border);
          overflow: hidden;
        }
        .v360-app, .v360-app *, .v360-app *::before, .v360-app *::after { box-sizing: border-box; }
        .v360-app .mono { font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace; }

        .v360-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 24px; border-bottom: 1px solid var(--panel-border);
          background: linear-gradient(180deg, var(--bg-elevated), var(--bg));
          flex-wrap: wrap; gap: 12px;
        }
        .v360-brand { display: flex; align-items: center; gap: 12px; }
        .v360-mark {
          font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 13px;
          border: 1.5px solid var(--accent); color: var(--accent);
          padding: 6px 9px; border-radius: 6px; letter-spacing: 0.5px;
        }
        .v360-title { font-size: 15px; font-weight: 600; color: var(--text); }
        .v360-subtitle { font-size: 12.5px; color: var(--muted); margin-top: 1px; }
        .v360-status { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }
        .v360-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 0 rgba(79,163,173,0.6); animation: v360pulse 2s infinite; }
        @keyframes v360pulse {
          0% { box-shadow: 0 0 0 0 rgba(79,163,173,0.55); }
          70% { box-shadow: 0 0 0 7px rgba(79,163,173,0); }
          100% { box-shadow: 0 0 0 0 rgba(79,163,173,0); }
        }

        .v360-tabs { display: flex; gap: 4px; padding: 10px 24px 0; }
        .v360-tab {
          display: flex; align-items: center; gap: 6px;
          background: transparent; border: none; color: var(--muted);
          font-family: 'IBM Plex Sans', sans-serif; font-size: 13.5px; font-weight: 500;
          padding: 9px 14px; border-radius: 8px 8px 0 0; cursor: pointer;
        }
        .v360-tab.active { color: var(--text); background: var(--bg-elevated); border: 1px solid var(--panel-border); border-bottom: none; }
        .v360-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

        .v360-content { padding: 22px 24px 26px; background: var(--bg-elevated); }

        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
        .kpi-card {
          position: relative; background: var(--paper); color: var(--ink);
          border-radius: 10px; padding: 18px 16px 14px; overflow: hidden;
          box-shadow: 0 1px 0 rgba(0,0,0,0.25);
        }
        .kpi-card::before {
          content: ""; position: absolute; top: -6px; left: 0; right: 0; height: 12px;
          background: radial-gradient(circle at 6px 6px, var(--bg-elevated) 6px, transparent 6.5px);
          background-size: 14px 14px; background-position: top;
        }
        .kpi-icon { opacity: 0.55; margin-bottom: 8px; }
        .kpi-value { font-family: 'IBM Plex Mono', monospace; font-size: 22px; font-weight: 700; line-height: 1.1; }
        .kpi-label { font-size: 11.5px; color: #55584c; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.4px; }

        .charts-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; margin-bottom: 16px; }
        .chart-card { background: var(--bg); border: 1px solid var(--panel-border); border-radius: 10px; padding: 16px 16px 6px; }
        .chart-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
        .chart-sub { font-size: 11.5px; color: var(--muted); margin-bottom: 10px; }

        .table-card { background: var(--bg); border: 1px solid var(--panel-border); border-radius: 10px; padding: 16px; }
        .table-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
        .filter-group { display: flex; gap: 6px; flex-wrap: wrap; }
        .filter-btn {
          background: var(--bg-elevated); color: var(--muted); border: 1px solid var(--panel-border);
          font-size: 12px; padding: 6px 11px; border-radius: 999px; cursor: pointer; font-family: 'IBM Plex Sans', sans-serif;
        }
        .filter-btn.active { color: var(--bg); background: var(--accent); border-color: var(--accent); font-weight: 600; }
        .filter-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
        .v360-select {
          background: var(--bg-elevated); color: var(--text); border: 1px solid var(--panel-border);
          font-size: 12.5px; padding: 6px 10px; border-radius: 8px; font-family: 'IBM Plex Sans', sans-serif;
        }

        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 720px; }
        th { text-align: left; color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 10px; border-bottom: 1px solid var(--panel-border); }
        td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); font-family: 'IBM Plex Mono', monospace; color: var(--text); white-space: nowrap; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        .diff-neg { color: var(--red); }
        .diff-pos { color: var(--amber); }
        .empty-row td { text-align: center; color: var(--muted); font-family: 'IBM Plex Sans', sans-serif; padding: 22px; }

        .stamp {
          display: inline-block; font-family: 'IBM Plex Mono', monospace; font-weight: 700;
          font-size: 10.5px; letter-spacing: 0.6px; padding: 3px 8px; border-radius: 3px;
          border: 1.5px dashed; transform: rotate(-2deg);
        }
        .stamp-conciliado { color: var(--green); border-color: var(--green); background: var(--green-soft); }
        .stamp-divergente { color: var(--red); border-color: var(--red); background: var(--red-soft); }
        .stamp-pendente { color: var(--amber); border-color: var(--amber); background: var(--amber-soft); }

        /* chat */
        .chat-layout { display: flex; flex-direction: column; height: 520px; background: var(--bg); border: 1px solid var(--panel-border); border-radius: 10px; overflow: hidden; }
        .chat-window { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
        .msg { display: flex; gap: 10px; max-width: 82%; }
        .msg-user { align-self: flex-end; flex-direction: row-reverse; }
        .msg-avatar {
          width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; background: var(--bg-elevated); border: 1px solid var(--panel-border); color: var(--accent);
        }
        .msg-user .msg-avatar { color: var(--paper); background: #2a3038; }
        .msg-bubble { font-size: 13.5px; line-height: 1.5; padding: 10px 13px; border-radius: 10px; background: var(--bg-elevated); border: 1px solid var(--panel-border); white-space: pre-wrap; }
        .msg-user .msg-bubble { background: #23384030; border-color: var(--accent); }
        .typing { display: flex; gap: 4px; padding: 4px 0; }
        .typing span { width: 5px; height: 5px; border-radius: 50%; background: var(--muted); animation: typingBounce 1.1s infinite; }
        .typing span:nth-child(2) { animation-delay: 0.15s; }
        .typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }

        .chip-row { display: flex; gap: 7px; flex-wrap: wrap; padding: 0 16px 12px; }
        .chip {
          font-size: 11.5px; color: var(--accent); background: var(--accent-soft); border: 1px solid transparent;
          padding: 6px 10px; border-radius: 999px; cursor: pointer; font-family: 'IBM Plex Sans', sans-serif;
        }
        .chip:hover { border-color: var(--accent); }

        .chat-input-row { display: flex; gap: 8px; padding: 14px 16px; border-top: 1px solid var(--panel-border); background: var(--bg-elevated); }
        .chat-input {
          flex: 1; background: var(--bg); color: var(--text); border: 1px solid var(--panel-border);
          border-radius: 8px; padding: 10px 12px; font-size: 13.5px; font-family: 'IBM Plex Sans', sans-serif;
        }
        .chat-input:focus-visible, .chat-input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
        .send-btn {
          background: var(--accent); color: #0d1116; border: none; border-radius: 8px; width: 40px;
          display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
        }
        .send-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .send-btn:focus-visible { outline: 2px solid var(--paper); outline-offset: 2px; }

        @media (max-width: 720px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .charts-grid { grid-template-columns: 1fr; }
          .v360-content { padding: 16px; }
        }
      `}</style>

      <div className="v360-header">
        <div className="v360-brand">
          <span className="v360-mark">V360</span>
          <div>
            <div className="v360-title">Radar Fiscal</div>
            <div className="v360-subtitle">Monitoramento de integração de notas fiscais · ERP ↔ Sistema Fiscal</div>
          </div>
        </div>
        <div className="v360-status">
          <span className="v360-dot" />
          última sincronização: há {syncMinAgo} min
        </div>
      </div>

      <div className="v360-tabs">
        <button className={`v360-tab ${activeTab === "painel" ? "active" : ""}`} onClick={() => setActiveTab("painel")}>
          <LayoutDashboard size={15} /> Painel
        </button>
        <button className={`v360-tab ${activeTab === "chat" ? "active" : ""}`} onClick={() => setActiveTab("chat")}>
          <MessageSquare size={15} /> Assistente
        </button>
      </div>

      <div className="v360-content">
        {activeTab === "painel" && (
          <>
            <div className="kpi-grid">
              <div className="kpi-card">
                <FileText className="kpi-icon" size={18} />
                <div className="kpi-value">{aggregates.total}</div>
                <div className="kpi-label">Notas · 30 dias</div>
              </div>
              <div className="kpi-card">
                <CheckCircle2 className="kpi-icon" size={18} />
                <div className="kpi-value">{aggregates.taxaConciliacao.toFixed(1)}%</div>
                <div className="kpi-label">Taxa de conciliação</div>
              </div>
              <div className="kpi-card">
                <Wallet className="kpi-icon" size={18} />
                <div className="kpi-value">{formatBRL(aggregates.valorEmRisco)}</div>
                <div className="kpi-label">Valor em risco</div>
              </div>
              <div className="kpi-card">
                <AlertTriangle className="kpi-icon" size={18} />
                <div className="kpi-value">{aggregates.divergentes.length}</div>
                <div className="kpi-label">Divergências abertas</div>
              </div>
            </div>

            <div className="charts-grid">
              <div className="chart-card">
                <div className="chart-title">Volume diário de notas</div>
                <div className="chart-sub">Últimos 30 dias, por status</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={aggregates.porDia} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#8b93a6", fontSize: 11 }} axisLine={{ stroke: "#2a2f3a" }} tickLine={false} interval={4} />
                    <YAxis tick={{ fill: "#8b93a6", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#1a1e26", border: "1px solid #2a2f3a", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#e7e9ee" }}
                    />
                    <Area type="monotone" dataKey="conciliado" stackId="1" stroke="#4c8a5e" fill="#4c8a5e" fillOpacity={0.5} name="Conciliado" />
                    <Area type="monotone" dataKey="divergente" stackId="1" stroke="#b6503f" fill="#b6503f" fillOpacity={0.55} name="Divergente" />
                    <Area type="monotone" dataKey="pendente" stackId="1" stroke="#c98a2c" fill="#c98a2c" fillOpacity={0.5} name="Pendente" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <div className="chart-title">Divergências por unidade</div>
                <div className="chart-sub">Onde investigar primeiro</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={unidadeChartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#8b93a6", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="unidade" tick={{ fill: "#8b93a6", fontSize: 11 }} axisLine={false} tickLine={false} width={78} />
                    <Tooltip
                      contentStyle={{ background: "#1a1e26", border: "1px solid #2a2f3a", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#e7e9ee" }}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    />
                    <Bar dataKey="divergencias" fill="#b6503f" radius={[0, 4, 4, 0]} name="Divergências" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card" style={{ marginBottom: 16 }}>
              <div className="chart-title">Divergências por tipo</div>
              <div className="chart-sub">Distribuição das causas identificadas</div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={tipoChartData} margin={{ top: 4, right: 16, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" vertical={false} />
                  <XAxis dataKey="tipo" tick={{ fill: "#8b93a6", fontSize: 10.5 }} axisLine={{ stroke: "#2a2f3a" }} tickLine={false} />
                  <YAxis tick={{ fill: "#8b93a6", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#1a1e26", border: "1px solid #2a2f3a", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#e7e9ee" }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar dataKey="qtd" fill="#c98a2c" radius={[4, 4, 0, 0]} name="Ocorrências" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="table-card">
              <div className="table-toolbar">
                <div className="filter-group">
                  <button className={`filter-btn ${statusFilter === "problemas" ? "active" : ""}`} onClick={() => setStatusFilter("problemas")}>
                    Com problema
                  </button>
                  <button className={`filter-btn ${statusFilter === "divergente" ? "active" : ""}`} onClick={() => setStatusFilter("divergente")}>
                    Divergentes
                  </button>
                  <button className={`filter-btn ${statusFilter === "pendente" ? "active" : ""}`} onClick={() => setStatusFilter("pendente")}>
                    Pendentes
                  </button>
                  <button className={`filter-btn ${statusFilter === "todas" ? "active" : ""}`} onClick={() => setStatusFilter("todas")}>
                    Todas
                  </button>
                </div>
                <select className="v360-select" value={unidadeFilter} onChange={(e) => setUnidadeFilter(e.target.value)} aria-label="Filtrar por unidade">
                  <option value="todas">Todas as unidades</option>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nota</th>
                      <th>Unidade</th>
                      <th>Data</th>
                      <th>Valor origem</th>
                      <th>Valor NF</th>
                      <th>Diferença</th>
                      <th>Tipo</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 && (
                      <tr className="empty-row">
                        <td colSpan={8}>Nenhuma nota encontrada para esse filtro.</td>
                      </tr>
                    )}
                    {filteredRows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td className="mono">{r.unidade}</td>
                        <td>{formatDateFull(r.data)}</td>
                        <td>{r.origemAusente ? "— (ausente)" : formatBRL(r.valorOrigem)}</td>
                        <td>{formatBRL(r.valorNF)}</td>
                        <td className={r.diferenca > 0 ? "diff-pos" : r.diferenca < 0 ? "diff-neg" : ""}>
                          {r.diferenca == null ? "—" : `${r.diferenca > 0 ? "+" : ""}${formatBRL(r.diferenca)}`}
                          {r.atrasoDias ? ` (${r.atrasoDias}d)` : ""}
                        </td>
                        <td>{r.tipoDivergencia || "—"}</td>
                        <td>
                          <StatusStamp status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === "chat" && (
          <div className="chat-layout">
            <div className="chat-window" ref={scrollRef}>
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.role === "user" ? "msg-user" : ""}`}>
                  <div className="msg-avatar">{m.role === "user" ? <User size={14} /> : <Bot size={14} />}</div>
                  <div className="msg-bubble">{m.content}</div>
                </div>
              ))}
              {loading && (
                <div className="msg">
                  <div className="msg-avatar">
                    <Bot size={14} />
                  </div>
                  <div className="msg-bubble">
                    <div className="typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="chip-row">
              {quickQuestions.map((q) => (
                <button key={q} className="chip" onClick={() => sendMessage(q)} disabled={loading}>
                  {q}
                </button>
              ))}
            </div>

            <div className="chat-input-row">
              <input
                className="chat-input"
                placeholder="Pergunte algo sobre as notas fiscais…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage(input);
                }}
                aria-label="Mensagem para o assistente"
              />
              <button className="send-btn" onClick={() => sendMessage(input)} disabled={loading || !input.trim()} aria-label="Enviar">
                {loading ? <Loader2 size={16} className="mono" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
