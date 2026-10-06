import { describe, expect, it } from 'vitest';
import { canTransition, isTerminalStatus, transitionJob } from './lifecycle.mjs';

describe('worker job lifecycle', () => {
  it('allows the normal successful lifecycle', () => {
    const job = { status: 'queued' };
    transitionJob(job, 'running');
    transitionJob(job, 'completed');
    expect(job.status).toBe('completed');
    expect(isTerminalStatus(job.status)).toBe(true);
    expect(job.completedAt).toBeTruthy();
  });

  it('allows running cancellation and records cancellation time', () => {
    const job = { status: 'queued' };
    transitionJob(job, 'running');
    transitionJob(job, 'cancelling');
    transitionJob(job, 'cancelled');
    expect(job.status).toBe('cancelled');
    expect(job.cancelledAt).toBeTruthy();
  });

  it('allows failure from a running job', () => {
    const job = { status: 'queued' };
    transitionJob(job, 'running');
    transitionJob(job, 'failed');
    expect(job.status).toBe('failed');
  });

  it('rejects terminal-state resurrection', () => {
    const job = { status: 'cancelled' };
    expect(() => transitionJob(job, 'completed')).toThrow(/Invalid job state transition/);
    expect(() => transitionJob(job, 'running')).toThrow(/Invalid job state transition/);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('queued', 'completed')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(canTransition('failed', 'running')).toBe(false);
  });

  it('is idempotent for the same state', () => {
    const job = { status: 'running' };
    expect(() => transitionJob(job, 'running')).not.toThrow();
  });
});
