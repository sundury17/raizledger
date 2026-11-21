import { useState } from "react";
import type { PublicKey } from "@solana/web3.js";

type Props = {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  walletName: string | null;
  wallets: readonly { adapter: { name: string } }[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  select: (name: never) => void;
};

function short(key: PublicKey) {
  const value = key.toBase58();
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function WalletButton(props: Props) {
  const [menu, setMenu] = useState(false);

  if (props.connected && props.publicKey) {
    return (
      <div className="wallet-box">
        <button className="btn btn-ghost" onClick={() => setMenu(!menu)}>
          <span className="dot" /> {short(props.publicKey)}
        </button>
        {menu && (
          <div className="wallet-menu">
            <span className="muted">Conectada con {props.walletName}</span>
            <button className="btn btn-small" onClick={() => void props.disconnect()}>
              Desconectar
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wallet-box">
      <button
        className="btn btn-primary"
        disabled={props.connecting}
        onClick={() => setMenu(!menu)}
      >
        {props.connecting ? "Conectando…" : "Conectar wallet"}
      </button>
      {menu && (
        <div className="wallet-menu">
          {props.wallets.map((w) => (
            <button
              key={w.adapter.name}
              className="btn btn-small"
              onClick={() => {
                props.select(w.adapter.name as never);
                void props.connect().then(() => setMenu(false));
              }}
            >
              {w.adapter.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
