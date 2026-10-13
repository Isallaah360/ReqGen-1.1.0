import { redirect } from "next/navigation";

/** v4.2: the account ledger is a tab of Finance › Ledgers. */
export default function Page() { redirect("/finance/transactions?view=account"); }
