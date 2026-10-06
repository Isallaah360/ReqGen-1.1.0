/**
 * ReqGen v3.1.5 — in-app dialogs.
 *
 * The ONE way ReqGen asks a user to confirm, acknowledge or type something.
 * Native browser dialogs (window.confirm / alert / prompt) show the site
 * address ("req-gen-1-1-0.vercel.app says") at the top of the screen, cannot
 * be styled and look like a security warning. They are banned since v3.1.5 and
 * scripts/audit-native-dialogs.mjs fails the build if one comes back.
 *
 * Usage (inside any async handler):
 *   if (!(await confirmDialog({ title: "Generate voucher?", message: "...", confirmLabel: "Generate" }))) return;
 *   const name = await promptDialog({ title: "New template", label: "Template name" });
 *   await alertDialog({ title: "Saved", message: "..." });
 *
 * The dialogs are drawn by <DialogHost /> (mounted once in app/layout.tsx):
 * centred card, dimmed screen, IET style, keyboard accessible.
 */

export type DialogTone = "default" | "danger" | "success" | "warning";

export type DialogRequest = {
  id: number;
  kind: "confirm" | "alert" | "prompt";
  title: string;
  message?: string;
  details?: string[];
  confirmLabel: string;
  cancelLabel: string;
  tone: DialogTone;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  resolve: (value: boolean | string | null) => void;
};

export type ConfirmOptions = {
  title?: string;
  message?: string;
  /** Extra lines shown as a short list under the message. */
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

export type PromptOptions = ConfirmOptions & {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** When true (default) the confirm button stays disabled until text is typed. */
  required?: boolean;
};

type Listener = () => void;

let queue: DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeDialogs(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The dialog currently on screen (first in the queue), or null. */
export function getActiveDialog(): DialogRequest | null {
  return queue[0] || null;
}

export function getServerDialog(): DialogRequest | null {
  return null;
}

export function settleDialog(id: number, value: boolean | string | null) {
  const item = queue.find((entry) => entry.id === id);
  if (!item) return;
  queue = queue.filter((entry) => entry.id !== id);
  emit();
  item.resolve(value);
}

/**
 * Old call sites passed one string with "\n\n" paragraphs. Split it so the
 * first paragraph becomes the message and the rest become detail lines.
 */
function normalise(input: string | ConfirmOptions, fallbackTitle: string): ConfirmOptions {
  if (typeof input !== "string") return input;
  const parts = input.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return { title: fallbackTitle, message: parts[0] || "", details: parts.slice(1) };
}

function open(kind: DialogRequest["kind"], options: PromptOptions, defaults: { confirm: string; cancel: string; title: string }) {
  return new Promise<boolean | string | null>((resolve) => {
    if (typeof window === "undefined") {
      resolve(kind === "prompt" ? null : false);
      return;
    }
    queue = [
      ...queue,
      {
        id: nextId++,
        kind,
        title: options.title || defaults.title,
        message: options.message,
        details: options.details,
        confirmLabel: options.confirmLabel || defaults.confirm,
        cancelLabel: options.cancelLabel || defaults.cancel,
        tone: options.tone || "default",
        label: options.label,
        placeholder: options.placeholder,
        defaultValue: options.defaultValue,
        required: options.required !== false,
        resolve,
      },
    ];
    emit();
  });
}

/** Ask the user to confirm an action. Resolves true only when they confirm. */
export async function confirmDialog(input: string | ConfirmOptions): Promise<boolean> {
  const options = normalise(input, "Please confirm");
  const result = await open("confirm", options, { confirm: "Confirm", cancel: "Cancel", title: "Please confirm" });
  return result === true;
}

/** Show an important message that must be acknowledged. */
export async function alertDialog(input: string | ConfirmOptions): Promise<void> {
  const options = normalise(input, "Notice");
  await open("alert", options, { confirm: "OK", cancel: "", title: "Notice" });
}

/** Ask the user to type a value. Resolves the trimmed text, or null when cancelled. */
export async function promptDialog(input: string | PromptOptions): Promise<string | null> {
  const options: PromptOptions = typeof input === "string" ? { title: "Enter a value", label: input } : input;
  const result = await open("prompt", options, { confirm: "Continue", cancel: "Cancel", title: "Enter a value" });
  return typeof result === "string" ? result.trim() : null;
}
