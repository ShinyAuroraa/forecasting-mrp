import { Test } from '@nestjs/testing';
import { ScenarioController } from '../scenario.controller';
import { ScenarioService } from '../scenario.service';

describe('ScenarioController', () => {
  let controller: ScenarioController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      listScenarios: jest.fn().mockResolvedValue([]),
      createScenario: jest.fn().mockResolvedValue({ id: '1', name: 'Test' }),
      computeImpact: jest.fn().mockResolvedValue({ scenarioId: '1', baseline: {}, scenario: {}, delta: {}, forecastComparison: [] }),
      deleteScenario: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      controllers: [ScenarioController],
      providers: [{ provide: ScenarioService, useValue: service }],
    }).compile();

    controller = module.get(ScenarioController);
  });

  it('GET /scenarios should list scenarios', async () => {
    await controller.list();
    expect(service.listScenarios).toHaveBeenCalledTimes(1);
  });

  it('POST /scenarios should create scenario', async () => {
    const dto = { name: 'Test', adjustments: { globalMultiplier: 1.0, classMultipliers: { A: 1, B: 1, C: 1 } } };
    const req = { user: { sub: 'user-1' } } as any;
    const result = await controller.create(dto as any, req);
    expect(result.id).toBe('1');
    expect(service.createScenario).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('GET /scenarios/:id/impact should compute impact', async () => {
    await controller.getImpact('test-id');
    expect(service.computeImpact).toHaveBeenCalledWith('test-id');
  });

  it('DELETE /scenarios/:id should delete scenario', async () => {
    const result = await controller.remove('test-id');
    expect(result).toEqual({ success: true });
    expect(service.deleteScenario).toHaveBeenCalledWith('test-id');
  });
});
