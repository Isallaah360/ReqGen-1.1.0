import { Hammer } from "lucide-react";
import { Body, Empty, Head } from "../ui";

/** App 4.0.0: an office screen still being rebuilt as an app screen. Never a website page. */
export default function Coming({ title }: { title: string }) {
  return (
    <>
      <Head title={title} />
      <Body>
        <Empty icon={<Hammer size={28} />} title="Being rebuilt for the app" text="This office is being rebuilt as a proper app screen and arrives in the next app update. Until then, use it on a computer." />
      </Body>
    </>
  );
}
