import { createClient, type LockFunc } from "@supabase/supabase-js";
import { trackedFetch } from "@/lib/activity";

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

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      lock: reqGenAuthLock,
    },
    // v3.1.3: every request reports activity so the loading strip shows
    // whenever ReqGen is loading or saving.
    global: {
      fetch: trackedFetch,
    },
  },
);

/**
 * ReqGen v4.7.0: when the database asks for the 6-digit code (REQGEN_CODE_REQUIRED),
 * ask for it and try the same call once more. Pages normally ask first; this
 * catches any action that did not.
 */
type RpcArgs = Parameters<typeof client.rpc>;
const plainRpc = client.rpc.bind(client);
client.rpc = ((...args: RpcArgs) => {
  const builder = plainRpc(...args);
  const firstThen = builder.then.bind(builder);
  (builder as unknown as { then: unknown }).then = (onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
    firstThen(async (res: { error: { message?: string } | null }) => {
      if (typeof window === "undefined" || !res?.error || !/REQGEN_CODE_REQUIRED/.test(String(res.error.message || ""))) return res;
      const { confirmWithCode } = await import("@/lib/codeConfirm");
      if (!(await confirmWithCode("confirm this action"))) return { ...res, error: { ...res.error, message: "Not done: the code was not entered." } };
      return await plainRpc(...args);
    }).then(onOk, onErr);
  return builder;
}) as typeof client.rpc;

export const supabase = client;
