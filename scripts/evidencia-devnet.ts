/**
 * Genera evidencia verificable del flujo de RaízLedger en Devnet.
 *
 * Uso:
 *   PAYER=/ruta/a/keypair.json npm run evidence:devnet
 *
 * El keypair nunca se versiona. El script crea/lee/modifica/archiva y cierra
 * una planta real, e imprime las firmas para consultarlas en Solana Explorer.
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const RPC = "https://api.devnet.solana.com";
const EXPLORER = "https://explorer.solana.com/tx";
const GARDEN_ID = 0;

const idl = JSON.parse(
  readFileSync(resolve(process.cwd(), "target/idl/raizledger.json"), "utf8")
);
const PROGRAM_ID = new PublicKey(idl.address);

const keypairPath = resolve(
  process.env.PAYER ?? resolve(homedir(), ".config/solana/id.json")
);
const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(keypairPath, "utf8")))
);

const connection = new Connection(RPC, "confirmed");
const wallet = new anchor.Wallet(payer);
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
});
anchor.setProvider(provider);
const program = new anchor.Program(idl, provider);

function u64Le(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function gardenPda(authority: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("garden"), authority.toBuffer(), u64Le(GARDEN_ID)],
    program.programId
  )[0];
}

function plantPda(garden: PublicKey, plantId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("plant"), garden.toBuffer(), u64Le(plantId)],
    program.programId
  )[0];
}

function txUrl(signature: string): string {
  return `${EXPLORER}/${signature}?cluster=devnet`;
}

function errorName(error: unknown): string {
  const e = error as any;
  return String(
    e?.error?.errorCode?.code ?? e?.errorCode?.code ?? e?.message ?? error
  );
}

async function expectRejection(label: string, promise: Promise<string>): Promise<void> {
  try {
    await promise;
    throw new Error(`Se esperaba rechazo: ${label}`);
  } catch (error) {
    console.log(`Rechazo esperado (${label}): ${errorName(error)}`);
  }
}

async function main(): Promise<void> {
  const authority = payer.publicKey;
  const garden = gardenPda(authority);
  const signatures: Record<string, string> = {};

  let plantCount = 0;
  try {
    const gardenAccount: any = await program.account.gardenAccount.fetch(garden);
    plantCount = gardenAccount.plantCount;
    console.log(`Jardín existente: ${garden.toBase58()} (plantas: ${plantCount})`);
  } catch {
    signatures.initializeGarden = await program.methods
      .initializeGarden(new anchor.BN(GARDEN_ID))
      .accountsPartial({ authority, garden, systemProgram: SystemProgram.programId })
      .rpc();
    console.log(`initialize_garden: ${txUrl(signatures.initializeGarden)}`);
  }

  const plantId = plantCount;
  const plant = plantPda(garden, plantId);
  signatures.createPlant = await program.methods
    .createPlant(new anchor.BN(plantId), "Evidencia", "Prueba", 1)
    .accountsPartial({ authority, garden, plant, systemProgram: SystemProgram.programId })
    .rpc();
  console.log(`create_plant: ${txUrl(signatures.createPlant)}`);

  const plantAccount: any = await program.account.plantAccount.fetch(plant);
  console.log(
    `Lectura: id=${plantAccount.plantId.toString()} nombre=${plantAccount.name} ` +
      `especie=${plantAccount.species} intervalo=${plantAccount.wateringInterval} ` +
      `estado=${JSON.stringify(plantAccount.status)}`
  );

  await expectRejection(
    "riego antes del intervalo",
    program.methods
      .waterPlant(new anchor.BN(plantId))
      .accountsPartial({ authority, garden, plant })
      .rpc()
  );

  await expectRejection(
    "cierre de planta activa",
    program.methods
      .closePlant(new anchor.BN(plantId))
      .accountsPartial({ authority, garden, plant })
      .rpc()
  );

  signatures.updatePlant = await program.methods
    .updatePlant(new anchor.BN(plantId), "Evidencia actualizada", "Prueba", 2)
    .accountsPartial({ authority, garden, plant })
    .rpc();
  console.log(`update_plant: ${txUrl(signatures.updatePlant)}`);

  signatures.archivePlant = await program.methods
    .archivePlant(new anchor.BN(plantId))
    .accountsPartial({ authority, garden, plant })
    .rpc();
  console.log(`archive_plant: ${txUrl(signatures.archivePlant)}`);

  signatures.closePlant = await program.methods
    .closePlant(new anchor.BN(plantId))
    .accountsPartial({ authority, garden, plant })
    .rpc();
  console.log(`close_plant: ${txUrl(signatures.closePlant)}`);

  console.log("\nRESUMEN_JSON");
  console.log(JSON.stringify({ authority: authority.toBase58(), garden: garden.toBase58(), signatures }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
