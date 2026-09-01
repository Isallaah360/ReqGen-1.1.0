import { createClient, type LockFunc } from "@supabase/supabase-js";

/**
 * ReqGen browser auth lock.
 *
 * Supabase Auth normally uses the browser Navigator LockManager to coordinate
 * auth/session writes. Some mobile Chromium builds can leave that browser lock
 * orphaned after tab backgrounding/process suspension, causing login to fail
 * with "Acquiring an exclusive Navigator LockManager lock ... timed out".
 *
 * ReqGen already exposes a single shared Supabase client per browser tab, so we
 * serialize auth operations inside the tab instead of relying on the fragile
 * Navigator LockManager. This keeps sign-in, MFA, password changes and token
 * refresh ordered while avoiding the mobile zombie-lock failure.
 */
let authLockTail: Promise<void> = Promise.resolve();

const reqGenAuthLock: LockFunc = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> => {
  let release!: () => void;
  const previous = authLockTail;
  authLockTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      lock: reqGenAuthLock,
    },
  },
);
