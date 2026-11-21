/**
 * Cliente TypeScript de RaízLedger.
 *
 * Toda la comunicación con el programa pasa por aquí: derivación de PDAs,
 * lectura de cuentas y envío/confirmación de instrucciones. Los componentes
 * React solo consumen estas funciones.
 */
import * as anchor from "@coral-xyz/anchor";
import type { Address } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  type ConfirmOptions,
} from "@solana/web3.js";
import idl from "../idl/raizledger.json";
import type { Raizledger } from "../types/raizledger";

export type ProgramType = anchor.Program<Raizledger>;

/** Program ID real, tomado del IDL generado por Anchor (no escrito a mano). */
export const PROGRAM_ID = new PublicKey(idl.address);

export const GARDEN_SEED = Buffer.from("garden");
export const PLANT_SEED = Buffer.from("plant");

/** Convierte un número a bytes little-endian de 8 bytes para las semillas. */
export function u64Le(value: number | bigint): Buffer {
  const n = BigInt(value);
  if (n < 0n || n > 18446744073709551615n) {
    throw new Error("Fuera de rango u64");
  }
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(n);
  return buf;
}

/** PDA del jardín: ["garden", authority, garden_id]. */
export function deriveGardenPda(
  authority: PublicKey,
  gardenId: number | bigint,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [GARDEN_SEED, authority.toBuffer(), u64Le(gardenId)],
    programId
  );
}

/** PDA de la planta: ["plant", garden, plant_id]. */
export function derivePlantPda(
  garden: PublicKey,
  plantId: number | bigint,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PLANT_SEED, garden.toBuffer(), u64Le(plantId)],
    programId
  );
}

export function createProgram(provider: anchor.Provider): ProgramType {
  return new anchor.Program(idl as Raizledger, provider);
}

export type GardenAccount = {
  authority: PublicKey;
  gardenId: anchor.BN;
  plantCount: number;
  bump: number;
};

export type PlantStatus = { active: {} } | { archived: {} };

export type PlantAccount = {
  garden: PublicKey;
  authority: PublicKey;
  plantId: anchor.BN;
  name: string;
  species: string;
  wateringInterval: number;
  lastWatered: anchor.BN;
  status: PlantStatus;
  bump: number;
};

export function isArchived(status: PlantStatus): boolean {
  return "archived" in status;
}

export async function fetchGarden(
  program: ProgramType,
  authority: PublicKey,
  gardenId = 0
): Promise<GardenAccount | null> {
  const [pda] = deriveGardenPda(authority, gardenId, program.programId);
  try {
    return (await program.account.gardenAccount.fetch(pda)) as GardenAccount;
  } catch (e) {
    if ((e as Error).message.includes("Account does not exist")) return null;
    throw e;
  }
}

export async function fetchPlant(
  program: ProgramType,
  garden: PublicKey,
  plantId: number
): Promise<PlantAccount | null> {
  const [pda] = derivePlantPda(garden, plantId, program.programId);
  try {
    return (await program.account.plantAccount.fetch(pda)) as PlantAccount;
  } catch (e) {
    if ((e as Error).message.includes("Account does not exist")) return null;
    throw e;
  }
}

/** Lee todas las plantas del jardín recorriendo el contador de la cuenta. */
export async function fetchAllPlants(
  program: ProgramType,
  authority: PublicKey,
  gardenId = 0
): Promise<PlantAccount[]> {
  const garden = await fetchGarden(program, authority, gardenId);
  if (!garden) return [];
  const [gardenPda] = deriveGardenPda(authority, gardenId, program.programId);
  const ids = Array.from({ length: garden.plantCount }, (_, i) => i);
  const accounts = await Promise.all(
    ids.map((id) => fetchPlant(program, gardenPda, id))
  );
  return accounts.filter((p): p is PlantAccount => p !== null);
}

export type SendOptions = {
  program: ProgramType;
  authority: Address;
  confirmOptions?: ConfirmOptions;
};

function authorityPubkey(authority: Address): PublicKey {
  return new PublicKey(authority);
}

export async function initializeGarden(
  opts: SendOptions,
  gardenId = 0
): Promise<string> {
  const authority = authorityPubkey(opts.authority);
  const [garden] = deriveGardenPda(authority, gardenId, opts.program.programId);
  return opts.program.methods
    .initializeGarden(new anchor.BN(gardenId))
    .accountsPartial({ authority, garden, systemProgram: SystemProgram.programId })
    .rpc(opts.confirmOptions);
}

export async function createPlant(
  opts: SendOptions,
  args: {
    gardenId?: number;
    plantId: number;
    name: string;
    species: string;
    wateringInterval: number;
  }
): Promise<string> {
  const authority = authorityPubkey(opts.authority);
  const gardenId = args.gardenId ?? 0;
  const [garden] = deriveGardenPda(authority, gardenId, opts.program.programId);
  const [plant] = derivePlantPda(garden, args.plantId, opts.program.programId);
  return opts.program.methods
    .createPlant(
      new anchor.BN(args.plantId),
      args.name,
      args.species,
      args.wateringInterval
    )
    .accountsPartial({
      authority,
      garden,
      plant,
      systemProgram: SystemProgram.programId,
    })
    .rpc(opts.confirmOptions);
}

async function simplePlantAction(
  opts: SendOptions,
  method:
    | "updatePlant"
    | "waterPlant"
    | "archivePlant"
    | "closePlant",
  args: { gardenId?: number; plantId: number; name?: string; species?: string; wateringInterval?: number }
): Promise<string> {
  const authority = authorityPubkey(opts.authority);
  const gardenId = args.gardenId ?? 0;
  const [garden] = deriveGardenPda(authority, gardenId, opts.program.programId);
  const [plant] = derivePlantPda(garden, args.plantId, opts.program.programId);

  const builder =
    method === "updatePlant"
      ? opts.program.methods.updatePlant(
          new anchor.BN(args.plantId),
          args.name!,
          args.species!,
          args.wateringInterval!
        )
      : method === "waterPlant"
        ? opts.program.methods.waterPlant(new anchor.BN(args.plantId))
        : method === "archivePlant"
          ? opts.program.methods.archivePlant(new anchor.BN(args.plantId))
          : opts.program.methods.closePlant(new anchor.BN(args.plantId));

  return builder
    .accountsPartial({ authority, garden, plant })
    .rpc(opts.confirmOptions);
}

export function updatePlant(
  opts: SendOptions,
  args: {
    gardenId?: number;
    plantId: number;
    name: string;
    species: string;
    wateringInterval: number;
  }
): Promise<string> {
  return simplePlantAction(opts, "updatePlant", args);
}

export function waterPlant(
  opts: SendOptions,
  args: { gardenId?: number; plantId: number }
): Promise<string> {
  return simplePlantAction(opts, "waterPlant", args);
}

export function archivePlant(
  opts: SendOptions,
  args: { gardenId?: number; plantId: number }
): Promise<string> {
  return simplePlantAction(opts, "archivePlant", args);
}

export function closePlant(
  opts: SendOptions,
  args: { gardenId?: number; plantId: number }
): Promise<string> {
  return simplePlantAction(opts, "closePlant", args);
}

export function explorerTxUrl(sig: string, cluster = "devnet"): string {
  const suffix = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${sig}${suffix}`;
}

export function explorerAddressUrl(address: string, cluster = "devnet"): string {
  const suffix = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/address/${address}${suffix}`;
}
