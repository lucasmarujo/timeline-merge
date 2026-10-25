import { describe, expect, it } from 'vitest';
import { FINALE_TIMING, finaleFrame } from '../src/core/finale';
import { FlowAction, GamePhase } from '../src/core/enums';
import { GameFlow } from '../src/core/gameFlow';

describe('GameFlow', () => {
  it('follows the full loop from title to victory and back to play', () => {
    const flow = new GameFlow();
    expect(flow.phase).toBe(GamePhase.Title);
    expect(flow.dispatch(FlowAction.Start)).toBe(true);
    expect(flow.dispatch(FlowAction.Pause)).toBe(true);
    expect(flow.phase).toBe(GamePhase.Paused);
    expect(flow.dispatch(FlowAction.Resume)).toBe(true);
    expect(flow.dispatch(FlowAction.BeginFinale)).toBe(true);
    expect(flow.dispatch(FlowAction.Complete)).toBe(true);
    expect(flow.phase).toBe(GamePhase.Victory);
    expect(flow.dispatch(FlowAction.PlayAgain)).toBe(true);
    expect(flow.phase).toBe(GamePhase.Playing);
  });

  it('rejects transitions that make no sense in the current phase', () => {
    const flow = new GameFlow();
    expect(flow.dispatch(FlowAction.Pause)).toBe(false);
    expect(flow.dispatch(FlowAction.Complete)).toBe(false);
    flow.dispatch(FlowAction.Start);
    flow.dispatch(FlowAction.BeginFinale);
    expect(flow.can(FlowAction.Pause)).toBe(false);
    expect(flow.dispatch(FlowAction.Pause)).toBe(false);
    expect(flow.phase).toBe(GamePhase.Finale);
  });

  it('can return to the title from the pause menu and the victory screen', () => {
    const flow = new GameFlow();
    flow.dispatch(FlowAction.Start);
    flow.dispatch(FlowAction.Pause);
    expect(flow.dispatch(FlowAction.ReturnToTitle)).toBe(true);
    expect(flow.phase).toBe(GamePhase.Title);
  });
});

describe('finaleFrame', () => {
  it('starts calm and unmerged', () => {
    const frame = finaleFrame(0);
    expect(frame.merge).toBe(0);
    expect(frame.flash).toBe(0);
    expect(frame.fragmentFlight).toEqual([0, 0, 0]);
    expect(frame.done).toBe(false);
  });

  it('flies the fragments home in order before merging the realities', () => {
    const frame = finaleFrame(FINALE_TIMING.fragmentsStart + 0.6);
    expect(frame.fragmentFlight[0]).toBeGreaterThan(frame.fragmentFlight[1]);
    expect(frame.fragmentFlight[1]).toBeGreaterThan(frame.fragmentFlight[2]);
    expect(frame.merge).toBe(0);
  });

  it('peaks the flash, fully merges and finishes deterministically', () => {
    expect(finaleFrame(FINALE_TIMING.flashPeak).flash).toBe(1);
    const end = finaleFrame(FINALE_TIMING.duration);
    expect(end.merge).toBe(1);
    expect(end.fragmentFlight).toEqual([1, 1, 1]);
    expect(end.portalPower).toBe(1);
    expect(end.done).toBe(true);
    expect(finaleFrame(3.7)).toEqual(finaleFrame(3.7));
  });
});
