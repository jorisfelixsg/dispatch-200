// R3 — Session timestamping: done_at_sim is the END of the step, computed by a personal cursor.

import type { Session } from "./types";

export interface Stamp {
  doneAtSim: number;
  cursorSim: number;
}

/**
 * On "Fait": if there is no session for the day, or its cursor is behind now_sim,
 * the cursor jumps to now_sim. Then done_at_sim = cursor + duration and the cursor moves there.
 */
export function stampCompletion(session: Session | undefined, nowSim: number, durationMin: number): Stamp {
  const start = !session || session.cursorSim < nowSim ? nowSim : session.cursorSim;
  const doneAtSim = start + durationMin;
  return { doneAtSim, cursorSim: doneAtSim };
}
