const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

const TRANSITIONS = {
  queued: new Set(['running', 'cancelling', 'cancelled', 'failed']),
  running: new Set(['cancelling', 'completed', 'failed']),
  cancelling: new Set(['cancelled', 'failed']),
  completed: new Set(),
  failed: new Set(),
  cancelled: new Set(),
};

export function canTransition(from, to) {
  return from === to || Boolean(TRANSITIONS[from]?.has(to));
}

export function transitionJob(job, nextStatus) {
  if (!canTransition(job.status, nextStatus)) {
    throw new Error(`Invalid job state transition: ${job.status} -> ${nextStatus}`);
  }
  job.status = nextStatus;
  if (TERMINAL.has(nextStatus)) {
    job.finishedAt = new Date().toISOString();
  }
  if (nextStatus === 'completed') job.completedAt = job.finishedAt;
  if (nextStatus === 'cancelled') job.cancelledAt = job.finishedAt;
  return job;
}

export function isTerminalStatus(status) {
  return TERMINAL.has(status);
}
