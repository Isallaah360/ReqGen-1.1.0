import { Building2, User, Send } from "lucide-react";
import { Cell, Sheet, useNav } from "../ui";
import NewRequest from "./NewRequest";
import DirectNew from "./DirectNew";

/** New: choose the kind in a sheet from the bottom. */
export default function NewTypeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { push } = useNav();
  const go = (node: React.ReactNode) => { onClose(); push(node); };
  return (
    <Sheet open={open} onClose={onClose} title="What do you want to send?">
      <div className="grp">
        <Cell icon={<Building2 size={18} />} iconTone="in" title="Official request" sub="Goes up your department's route to the DG" onClick={() => go(<NewRequest kind="Official" />)} />
        <Cell icon={<User size={18} />} iconTone="ok" title="Personal request" sub="Leave, salary advance, personal fund" onClick={() => go(<NewRequest kind="Personal" />)} />
        <Cell icon={<Send size={18} />} title="Direct" sub="Straight to the people you choose, nobody else" onClick={() => go(<DirectNew />)} />
      </div>
    </Sheet>
  );
}
