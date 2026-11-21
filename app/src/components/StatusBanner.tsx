import { explorerTxUrl } from "../lib/raizledger";

type Props = {
  error: string | null;
  notice: { text: string; signature: string } | null;
  pending: boolean;
  onClose: () => void;
};

export function StatusBanner({ error, notice, pending, onClose }: Props) {
  if (!error && !notice && !pending) return null;
  return (
    <div className={`banner ${error ? "banner-error" : "banner-ok"}`} role="status">
      <div>
        {pending && <span>⏳ Enviando transacción y esperando confirmación…</span>}
        {!pending && error && <span>⚠ {error}</span>}
        {!pending && notice && (
          <span>
            ✓ {notice.text}{" "}
            <a href={explorerTxUrl(notice.signature, "devnet")} target="_blank" rel="noreferrer">
              Ver en Explorer ↗
            </a>
          </span>
        )}
      </div>
      {!pending && <button className="banner-close" onClick={onClose}>×</button>}
    </div>
  );
}
