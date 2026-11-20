import { extractJson } from '../ai/agent-runner.service';
import {
  CodingAgentService,
  runnableTests,
  scoreFromTests,
} from './coding-agent.service';

describe('agent JSON replies', () => {
  it('reads JSON wrapped in code fences and chatter', () => {
    expect(extractJson('Sure!\n```json\n{"hint":"use a loop"}\n```')).toEqual({
      hint: 'use a loop',
    });
  });

  it('rejects replies without JSON', () => {
    expect(() => extractJson('I cannot help with that')).toThrow();
  });
});

describe('coding agent tests-first grading', () => {
  const tests = [
    { input: [2, 3], expected: 5 },
    { input: [0, 0], expected: 0 },
    { input: [-1, 1], expected: 0 },
  ];

  it('keeps only test cases the runner can execute', () => {
    expect(
      runnableTests([...tests, { input: 'x', expected: 1 }, null]),
    ).toHaveLength(3);
  });

  it('scores by the share of passing tests', () => {
    expect(
      scoreFromTests({ results: [true, false, true], passed: 2, total: 3 }),
    ).toBe(67);
    expect(scoreFromTests({ results: [], passed: 0, total: 0 })).toBe(0);
  });

  it('runs real JavaScript and counts passes', async () => {
    const agent = new CodingAgentService({} as never);
    const wrong = await agent.runTests(
      'javascript',
      'function solution(a, b) { return a * b; }',
      tests,
    );
    expect(wrong.passed).toBe(1); // only 0*0 === 0 + 0
    const right = await agent.runTests(
      'javascript',
      'function solution(a, b) { return a + b; }',
      tests,
    );
    expect(right.passed).toBe(3);
    const broken = await agent.runTests(
      'javascript',
      'function solution( {',
      tests,
    );
    expect(broken.passed).toBe(0);
  }, 20_000);
});
