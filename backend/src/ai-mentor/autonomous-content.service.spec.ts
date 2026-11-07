import { getBlueprintForDay, CURRICULUM_BLUEPRINTS } from './autonomous-curriculum.data';

describe('Autonomous Curriculum Blueprints', () => {
  it('covers days 1 to 7 with fundamentals phase', () => {
    for (let day = 1; day <= 7; day++) {
      const blueprint = getBlueprintForDay(day);
      expect(blueprint.phase).toBe('fundamentals');
      expect(blueprint.dayIndex).toBe(day);
      expect(blueprint.topic).toBeDefined();
      expect(blueprint.analogyHook).toBeDefined();
    }
  });

  it('covers days 8 to 30 with core_oop phase', () => {
    for (let day = 8; day <= 30; day++) {
      const blueprint = getBlueprintForDay(day);
      expect(blueprint.phase).toBe('core_oop');
      expect(blueprint.dayIndex).toBe(day);
      expect(blueprint.topic).toBeDefined();
      expect(blueprint.analogyHook).toBeDefined();
    }
  });

  it('covers days 31 to 45 with advanced_systems phase', () => {
    for (let day = 31; day <= 45; day++) {
      const blueprint = getBlueprintForDay(day);
      expect(blueprint.phase).toBe('advanced_systems');
      expect(blueprint.dayIndex).toBe(day);
      expect(blueprint.topic).toBeDefined();
      expect(blueprint.analogyHook).toBeDefined();
    }
  });

  it('dynamically generates advanced progression beyond Day 45', () => {
    const day50 = getBlueprintForDay(50);
    expect(day50.dayIndex).toBe(50);
    expect(day50.phase).toBe('advanced_systems');
    expect(day50.weekNumber).toBe(8);
  });
});

