import { useState } from "react";

export type PlantFormValues = {
  name: string;
  species: string;
  wateringInterval: number;
};

type Props = {
  title: string;
  submitLabel: string;
  initial?: PlantFormValues;
  disabled?: boolean;
  onSubmit: (values: PlantFormValues) => void;
  onCancel?: () => void;
};

export function PlantForm({ title, submitLabel, initial, disabled, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [species, setSpecies] = useState(initial?.species ?? "");
  const [interval, setInterval] = useState(initial?.wateringInterval ?? 7);

  return (
    <form
      className="card form-card"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), species: species.trim(), wateringInterval: interval });
      }}
    >
      <h3>{title}</h3>
      <label>
        Nombre
        <input
          value={name}
          maxLength={32}
          required
          placeholder="Ej. Monstera"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Especie
        <input
          value={species}
          maxLength={32}
          required
          placeholder="Ej. Monstera deliciosa"
          onChange={(e) => setSpecies(e.target.value)}
        />
      </label>
      <label>
        Intervalo de riego (días)
        <input
          type="number"
          min={1}
          max={255}
          required
          value={interval}
          onChange={(e) => setInterval(Number(e.target.value))}
        />
      </label>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={disabled} type="submit">
          {submitLabel}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
