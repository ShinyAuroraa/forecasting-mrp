import { Module } from '@nestjs/common';

import { ActionMessagesService } from './engine/action-messages.service';
import { BomExplosionService } from './engine/bom-explosion.service';
import { CrpService } from './engine/crp.service';
import { LotSizingService } from './engine/lot-sizing.service';
import { MpsService } from './engine/mps.service';
import { NetRequirementService } from './engine/net-requirement.service';
import { MrpInventoryHelper } from './engine/mrp-inventory.helper';
import { MrpScheduledReceiptsHelper } from './engine/mrp-scheduled-receipts.helper';
import { OrderGenerationService } from './engine/order-generation.service';
import { StockParamsService } from './engine/stock-params.service';
import { StorageValidationService } from './engine/storage-validation.service';
import { MrpController } from './mrp.controller';
import { MrpService } from './mrp.service';
import { MrpRepository } from './mrp.repository';
import { PurchasingPanelController } from './purchasing-panel/purchasing-panel.controller';
import { PurchasingPanelService } from './purchasing-panel/purchasing-panel.service';
import { ExcelExportService } from './purchasing-panel/excel-export.service';

/**
 * MrpModule — Material Requirements Planning
 *
 * Provides the MRP orchestrator API (Story 3.10) and all engine services:
 * - MrpController: REST API for execution, orders, capacity, stock params
 * - MrpService: Orchestrates the 8-step MRP pipeline
 * - MrpRepository: Data access for executions, step logs, and read endpoints
 * - MpsService: Master Production Schedule — level-0 demand generation
 * - BomExplosionService: Pure calculation of multi-level BOM explosion
 * - NetRequirementService: Pure calculation of net requirements per SKU/period
 * - LotSizingService: Pure calculation of planned order quantities (L4L, EOQ, Silver-Meal)
 * - OrderGenerationService: Planned order generation (COMPRA/PRODUCAO) with persistence
 * - MrpInventoryHelper: Reads available stock from InventarioAtual
 * - MrpScheduledReceiptsHelper: Reads scheduled receipts from OrdemPlanejada
 * - StockParamsService: Calculates SS, ROP, EOQ, Min, Max per SKU
 * - ActionMessagesService: Compares planned vs existing orders, generates action messages
 * - CrpService: Capacity Requirements Planning — work center load vs capacity analysis
 * - StorageValidationService: Storage capacity validation — warehouse volume projections
 *
 * PrismaService is available via global PrismaModule — no explicit import needed.
 *
 * @see Story 3.2 — Net Requirement Calculation Engine
 * @see Story 3.3 — Stock Parameter Calculation
 * @see Story 3.4 — Multi-Level BOM Explosion
 * @see Story 3.5 — Lot Sizing Engine
 * @see Story 3.6 — Master Production Schedule
 * @see Story 3.7 — Planned Order Generation
 * @see Story 3.8 — Action Messages
 * @see Story 3.9 — CRP & Storage Capacity Validation
 * @see Story 3.10 — MRP Orchestrator & Execution API
 * @see Story 3.11 — Purchasing Panel
 */
@Module({
  controllers: [MrpController, PurchasingPanelController],
  providers: [
    MrpService,
    MrpRepository,
    ActionMessagesService,
    CrpService,
    MpsService,
    BomExplosionService,
    LotSizingService,
    NetRequirementService,
    OrderGenerationService,
    MrpInventoryHelper,
    MrpScheduledReceiptsHelper,
    StockParamsService,
    StorageValidationService,
    PurchasingPanelService,
    ExcelExportService,
  ],
  exports: [
    MrpService,
    MrpRepository,
    ActionMessagesService,
    CrpService,
    MpsService,
    BomExplosionService,
    LotSizingService,
    NetRequirementService,
    OrderGenerationService,
    MrpInventoryHelper,
    MrpScheduledReceiptsHelper,
    StockParamsService,
    StorageValidationService,
    PurchasingPanelService,
    ExcelExportService,
  ],
})
export class MrpModule {}
