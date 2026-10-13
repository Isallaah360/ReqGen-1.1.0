import Icon from "./Icon";

/** Registry pages: what Registry may and may not see (Build Reference §12). */
export default function PrivacyBar() {
  return (
    <div className="v4-privacy-bar" role="note">
      <Icon name="eyeoff" />
      <span><b>Registry sees numbers, dates, offices and people only</b> — never the title, amount or contents of a request.</span>
    </div>
  );
}
