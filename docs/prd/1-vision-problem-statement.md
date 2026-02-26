# 1. Vision & Problem Statement

## 1.1 Problem

Uma industria recebe dados operacionais diarios (movimentacoes de estoque, faturamento, inventario) mas toma decisoes de compra e producao com base em feeling, sem previsibilidade. Isso gera excesso de estoque de alguns itens e falta de outros, compras reativas em vez de planejadas, e planejamento financeiro cego.

**Pain Points (from project brief):**

| Pain Point | Impact | Frequency |
|------------|--------|-----------|
| **Gut-feeling purchasing** | Excess inventory of slow movers, stockouts of fast movers | Every purchase cycle |
| **Reactive procurement** | Emergency orders at premium prices, production line stoppages | Weekly |
| **Blind financial planning** | Revenue forecasts that miss by 20-40%, budget overruns | Monthly/Quarterly |
| **Disconnected data** | Inventory data in one system, sales in another, capacity in spreadsheets | Continuous |
| **Manual daily routines** | 2-3 hours/day spent collecting, reconciling, and reporting data | Daily |
| **No capacity validation** | Production plans that are physically impossible to execute | Each planning cycle |

## 1.2 Solution

Sistema integrado que automatiza o ciclo completo: ingestao de dados -> previsao de demanda com IA -> planejamento de materiais (MRP) -> validacao de capacidade (MRP II) -> recomendacoes de compra acionaveis -> dashboards de BI.

## 1.3 Components and Justifications

| # | Component | Purpose | Problem Solved |
|---|-----------|---------|----------------|
| 1 | **Forecasting (TFT + ETS + Croston)** | AI-driven demand forecasting by SKU with confidence intervals (P10-P90) | Gut-feeling purchasing -> excess or shortage |
| 2 | **Revenue Forecasting** | Financial projections by period, family, category, and total | Blind financial planning |
| 3 | **MRP Engine** | Multi-level BOM explosion, planned purchase and production orders with exact dates and quantities | Reactive procurement, production stoppages |
| 4 | **MRP II (CRP)** | Production and storage capacity validation against real factory constraints | Infeasible production plans |
| 5 | **Purchasing Panel** | "What to buy, how much, from whom, when to order, when it arrives" | Purchase decisions without data |
| 6 | **BI Dashboards** | Executive, operational, and analytical views | No operational visibility |
| 7 | **Ingestion Automation** | Daily automated feed via email, ERP, or upload | Stale data = wrong decisions |

## 1.4 Target Users

**Primary Users:**

| Segment | Profile | Key Needs | Usage Frequency |
|---------|---------|-----------|-----------------|
| **Purchasing Manager** | Makes daily/weekly buying decisions. Currently relies on ERP stock reports and personal experience. | Actionable purchase recommendations with quantities, suppliers, dates, and costs. Urgency prioritization. | Daily |
| **Production Planner** | Schedules production across work centers. Juggles capacity constraints manually. | Feasible production schedule validated against capacity. Overload alerts with resolution suggestions. | Daily |
| **Operations Director** | Oversees manufacturing operations. Needs visibility into inventory health, forecast accuracy, and capacity utilization. | Executive dashboard with KPIs, alerts, and trend analysis. Morning briefing email. | Daily (dashboard), Weekly (deep analysis) |

**Secondary Users:**

| Segment | Profile | Key Needs | Usage Frequency |
|---------|---------|-----------|-----------------|
| **Financial Controller** | Builds revenue forecasts and budgets. Currently uses spreadsheet models. | Revenue forecasting by period, category, and product family. Confidence intervals for scenario planning. | Weekly/Monthly |
| **Inventory Analyst** | Manages stock levels, performs cycle counts, monitors ABC classification. | Inventory health metrics, coverage days, ABC/XYZ classification, stockout risk alerts. | Daily |
| **IT/Systems Admin** | Configures integrations, manages data pipelines, troubleshoots ingestion failures. | System configuration, automation monitoring, ERP connector setup, error handling. | As needed |

## 1.5 Goals & Success Metrics

**Business Objectives:**

| Objective | Metric | Target | Timeline |
|-----------|--------|--------|----------|
| Reduce stockouts | % of SKUs in stockout | < 2% (class A), < 5% (class B), < 10% (class C) | 6 months post-launch |
| Reduce excess inventory | Inventory turns per year | > 8x (class A), > 5x (class B), > 3x (class C) | 6 months post-launch |
| Improve forecast accuracy | MAPE (volume) | < 10% (A), < 20% (B), < 35% (C) | 3 months post-training |
| Eliminate reactive purchasing | % of emergency orders | Reduce by 70% from baseline | 6 months post-launch |
| Automate daily planning | Daily processing time | < 15 min (ingestion + forecast + MRP) | Immediate (Phase 4) |

**KPIs (SMART):**

1. **Forecast Accuracy (MAPE):** Achieve class-A MAPE below 10% within 12 weeks of TFT model deployment, measured via weekly backtesting against the 13-week rolling window.
2. **Fill Rate (OTIF):** Achieve On-Time-In-Full delivery rate above 97% for class A products within 6 months of full MRP deployment, measured by comparing planned vs. actual deliveries.
3. **Inventory Value Optimization:** Reduce total inventory carrying cost by 15% within 6 months post-launch while maintaining service levels, measured by monthly inventory valuation reports.
4. **System Availability:** Maintain 99.5% uptime for the daily automated pipeline, measured by monitoring the 06:00 daily pipeline execution success rate.
5. **Revenue Forecast Accuracy:** Achieve monthly revenue forecast accuracy within 12% MAPE for class A products within 3 months of dual-model deployment.

---
