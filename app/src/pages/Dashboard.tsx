import { PlantCard } from "../components/PlantCard";
import { PlantForm, type PlantFormValues } from "../components/PlantForm";
import { StatusBanner } from "../components/StatusBanner";
import { WalletButton } from "../components/WalletButton";
import { useRaizledger } from "../hooks/useRaizledger";
import { explorerAddressUrl, PROGRAM_ID } from "../lib/raizledger";

export function Dashboard() {
  const rl = useRaizledger();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <div>
            <h1>RaízLedger</h1>
            <p>Jardín on-chain · Solana Devnet</p>
          </div>
        </div>
        <div className="topbar-right">
          <span className="network"><span className="dot" /> Devnet</span>
          <WalletButton {...rl} />
        </div>
      </header>

      <StatusBanner error={rl.error} notice={rl.notice} pending={rl.pending} onClose={rl.clearMessages} />

      {!rl.connected ? (
        <main className="hero card">
          <span className="hero-icon">🌱</span>
          <h2>Tu jardín, registrado en la blockchain</h2>
          <p>
            Crea tu jardín, registra plantas y lleva el control de su riego con
            reglas verificables en Solana. Conecta una wallet para comenzar.
          </p>
          <p className="muted tiny">
            Programa: <a href={explorerAddressUrl(PROGRAM_ID.toBase58(), "devnet")} target="_blank" rel="noreferrer">{PROGRAM_ID.toBase58()}</a>
          </p>
        </main>
      ) : (
        <main className="layout">
          <section className="card garden-card">
            <div className="section-head">
              <div>
                <h2>Mi jardín</h2>
                <p className="muted">{rl.publicKey?.toBase58()}</p>
              </div>
              <button className="btn btn-ghost btn-small" onClick={() => void rl.refresh()} disabled={rl.loading}>
                Actualizar
              </button>
            </div>

            {rl.loading && !rl.garden ? (
              <p className="muted">Cargando datos del jardín…</p>
            ) : !rl.garden ? (
              <div className="empty">
                <p>Aún no tienes un jardín en esta wallet.</p>
                <button className="btn btn-primary" disabled={rl.pending} onClick={() => void rl.initializeGarden()}>
                  Crear mi jardín
                </button>
              </div>
            ) : (
              <div className="stats">
                <div><strong>{rl.garden.plantCount}</strong><span>plantas registradas</span></div>
                <div><strong>{rl.plants.filter((p) => !("archived" in p.status)).length}</strong><span>activas</span></div>
                <div><strong>{rl.plants.filter((p) => "archived" in p.status).length}</strong><span>archivadas</span></div>
              </div>
            )}
          </section>

          {rl.garden && (
            <section>
              <div className="section-head">
                <h2>Nueva planta</h2>
              </div>
              <PlantForm
                title="Registrar planta"
                submitLabel="Registrar planta"
                disabled={rl.pending}
                onSubmit={(v: PlantFormValues) => void rl.createPlant(v)}
              />
            </section>
          )}

          {rl.garden && (
            <section>
              <div className="section-head">
                <h2>Mis plantas</h2>
                <span className="muted">{rl.plants.length} en total</span>
              </div>
              {rl.plants.length === 0 ? (
                <p className="card empty">Todavía no registraste plantas.</p>
              ) : (
                <div className="plant-grid">
                  {rl.plants.map((p) => {
                    const id = p.plantId.toNumber();
                    return (
                      <PlantCard
                        key={id}
                        plant={p}
                        pending={rl.pending}
                        onWater={() => void rl.waterPlant(id)}
                        onArchive={() => void rl.archivePlant(id)}
                        onClose={() => void rl.closePlant(id)}
                        onUpdate={(v) => void rl.updatePlant(id, v)}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </main>
      )}

      <footer className="footer">
        RaízLedger · Proyecto de registro botánico on-chain · Datos en Devnet
      </footer>
    </div>
  );
}
