import { useState } from "react";

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!value) return;

    await navigator.clipboard.writeText(value);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <div className="copy-field">
      <div>
        <strong>{label}</strong>
        <p>{value || "Not Available"}</p>
      </div>

      <button onClick={copyToClipboard}>
        {copied ? "✅ Copied!" : "📋 Copy"}
      </button>
    </div>
  );
}

export default CopyField;

