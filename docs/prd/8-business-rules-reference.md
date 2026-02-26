# 8. Business Rules Reference

This section consolidates ALL business rules for quick reference during development. These are preserved verbatim from the original PRD Section 12.

## Forecasting Rules

| ID | Rule |
|----|------|
| R-F01 | Model selection is automatic by ABC/XYZ classification but allows manual override |
| R-F02 | TFT re-trains monthly OR when MAPE degrades > 5 percentage points |
| R-F03 | Weekly inference uses pre-trained model (does not re-train) |
| R-F04 | Forecast revenue uses TWO approaches in parallel (indirect + direct TFT) |
| R-F05 | When the two revenue forecasts diverge significantly -> attention flag |
| R-F06 | SKUs with < 40 weeks of data use simple ETS, not TFT |
| R-F07 | Intermittent SKUs (> 25% zeros) use Croston/TSB, never TFT |

## MRP Rules

| ID | Rule |
|----|------|
| R-M01 | MPS: demand(t) = MAX(forecast_P50(t), firm_orders(t)) |
| R-M02 | Firm order horizon: 2-4 weeks (configurable) |
| R-M03 | Low-Level Coding: if item appears at multiple levels, use the HIGHEST |
| R-M04 | Loss calculation: Qty = BOM_qty x Parent_qty / (1 - loss/100) |
| R-M05 | Lot sizing respects: lote_minimo -> multiplo_compra -> MOQ (in this order) |
| R-M06 | Primary supplier first; if MOQ > need, use secondary |
| R-M07 | Priority: CRITICA (stockout) > ALTA (below SS) > MEDIA (projection < ROP) > BAIXA |

## Inventory Rules

| ID | Rule |
|----|------|
| R-E01 | If TFT available: SS = P(service_level) - P50 accumulated over LT |
| R-E02 | If TFT not available: SS = Z x sqrt(LT x sigma_d^2 + d_bar^2 x sigma_LT^2) |
| R-E03 | estoque_seguranca_manual IS NOT NULL -> use manual value, do not calculate |
| R-E04 | Z: 1.88 (97% class A), 1.48 (93% class B), 1.04 (85% class C) |

## Capacity Rules

| ID | Rule |
|----|------|
| R-C01 | Effective capacity = Nominal capacity x Efficiency / 100 |
| R-C02 | Daily capacity = Sum of active shift hours - stops - holidays |
| R-C03 | Capacity event -> automatically recalculate CRP |
| R-C04 | Overload <= 10%: overtime | 10-30%: expedite | > 30%: subcontract |
| R-C05 | Warehouse > 90%: alert | > 95%: critical alert |

## Automation Rules

| ID | Rule |
|----|------|
| R-A01 | Daily pipeline: ingestion -> inference -> MRP -> alerts |
| R-A02 | Email listener: retry 06:30, 07:00, 07:30. Dead letter after 4 failures |
| R-A03 | Monthly re-training: champion-challenger (only promotes if better) |
| R-A04 | Daily summary sent automatically with revenue, alerts, purchases, capacity |

---
