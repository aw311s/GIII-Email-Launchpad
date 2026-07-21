import { useState } from "react";


function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);


  const copyToClipboard = async () => {
    if (!value) return;


    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };


  return (
    <div className="copy-field">
      <div className="field-label">{label}</div>
      <div className="copy-field__row">
        <div className="field-value">
          {value || <span className="muted">Not available</span>}
        </div>


        <button
          className="copy-button"
          onClick={copyToClipboard}
          disabled={!value}
          type="button"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}


export default CopyField;


