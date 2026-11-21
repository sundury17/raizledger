import { useState } from "react";
import type { PlantAccount } from "../lib/raizledger";
import { isArchived } from "../lib/raizledger";
import { PlantForm, type PlantFormValues } from "./PlantForm";

type Props = {
  plant: PlantAccount;
  pending: boolean;
  onWater: () => void;
  onArchive: () => void;
  onClose: () => void;
  onUpdate: (values: PlantFormValues) => void;
};

function daysInfo(plant: PlantAccount) {
  const last = plant.lastWatered.toNumber() * 1000;
  const elapsedMs = Date.now() - last;
  const elapsedDays = Math.floor(elapsedMs / 86_400_000);
  const remaining = plant.wateringInterval - elapsedDays;
  return { elapsedDays, remaining };
}

export function PlantCard({ plant, pending, onWater, onArchive, onClose, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const archived = isArchived(plant.status);
  const { elapsedDays, remaining } = daysInfo(plant);
  const canWater = !archived && remaining <= 0;
  const registered = new Date(plant.lastWatered.toNumber() * 1000).toLocaleDateString("es-ES");

  return (
    <article className={`card plant-card ${archived ? "is-archived" : ""}`}>
      <header>
        <div>
          <h3>🌿 {plant.name}</h3>
          <p className="muted">{plant.species}</p>
        </div>
        <span className={`badge ${archived ? "badge-gray" : canWater ? "badge-warn" : "badge-green"}`}>
          {archived ? "Archivada" : canWater ? "Lista para regar" : "Activa"}
        </span>
      </header>

      <dl className="plant-meta">
        <div><dt>ID</dt><dd>#{plant.plantId.toNumber()}</dd></div>
        <div><dt>Intervalo</dt><dd>{plant.wateringInterval} días</dd></div>
        <div><dt>Último riego</dt><dd>{registered}</dd></div>
        <div>
          <dt>Próximo riego</dt>
          <dd>{archived ? "—" : remaining > 0 ? `en ${remaining} d` : "ahora"}</dd>
        </div>
      </dl>
      <p className="muted tiny">Días desde el último riego: {Math.max(0, elapsedDays)}</p>

      {editing ? (
        <PlantForm
          title="Editar planta"
          submitLabel="Guardar cambios"
          disabled={pending}
          initial={{
            name: plant.name,
            species: plant.species,
            wateringInterval: plant.wateringInterval,
          }}
          onCancel={() => setEditing(false)}
          onSubmit={(values) => {
            onUpdate(values);
            setEditing(false);
          }}
        />
      ) : (
        <div className="card-actions">
          {!archived && (
            <>
              <button className="btn btn-primary btn-small" disabled={pending || !canWater} onClick={onWater}>
                Regar
              </button>
              <button className="btn btn-ghost btn-small" disabled={pending} onClick={() => setEditing(true)}>
                Editar
              </button>
              <button className="btn btn-ghost btn-small" disabled={pending} onClick={onArchive}>
                Archivar
              </button>
            </>
          )}
          {archived && (
            <button className="btn btn-danger btn-small" disabled={pending} onClick={onClose}>
              Cerrar cuenta
            </button>
          )}
        </div>
      )}
    </article>
  );
}
