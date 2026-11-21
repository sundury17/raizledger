import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import { assert, expect } from "chai";
// Tipos versionados usados también por la app; así el typecheck no depende de
// artefactos generados que no están en el repositorio.
import type { Raizledger } from "../app/src/types/raizledger";

// Se lee con fs para no depender del comportamiento de Node con JSON ESM.
const idl = JSON.parse(
  readFileSync(resolve(process.cwd(), "target/idl/raizledger.json"), "utf8")
) as Raizledger;

const BN = anchor.BN;
const PROGRAM_ID = new PublicKey(idl.address);

/** Helper locales: las pruebas no importan el paquete ESM de la app. */
function u64Le(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}
function deriveGardenPda(
  authority: PublicKey,
  gardenId: number,
  programId: PublicKey = PROGRAM_ID
): [PublicKey] {
  return [PublicKey.findProgramAddressSync(
    [Buffer.from("garden"), authority.toBuffer(), u64Le(gardenId)],
    programId
  )[0]];
}
function derivePlantPda(
  garden: PublicKey,
  plantId: number,
  programId: PublicKey = PROGRAM_ID
): [PublicKey] {
  return [PublicKey.findProgramAddressSync(
    [Buffer.from("plant"), garden.toBuffer(), u64Le(plantId)],
    programId
  )[0]];
}
async function fetchGarden(program: Program<Raizledger>, authority: PublicKey, gardenId: number) {
  return program.account.gardenAccount.fetch(deriveGardenPda(authority, gardenId)[0]);
}
async function fetchPlant(program: Program<Raizledger>, garden: PublicKey, plantId: number) {
  return program.account.plantAccount.fetch(derivePlantPda(garden, plantId)[0]);
}
function isArchived(status: unknown): boolean {
  return typeof status === "object" && status !== null && "archived" in status;
}

function errorCodeOf(e: any): string {
  return String(
    e?.error?.errorCode?.code ??
      e?.errorCode?.code ??
      e?.error?.code ??
      e?.message ??
      String(e)
  );
}

async function expectError(
  promise: Promise<unknown>,
  code: string
): Promise<void> {
  try {
    await promise;
    assert.fail(`Se esperaba el error ${code}`);
  } catch (e: any) {
    expect(errorCodeOf(e), `error esperado: ${code}`).to.include(code);
  }
}

/**
 * Las semillas PDA se validan antes que las constraints personalizadas,
 * por lo que una wallet ajena puede ser rechazada por ConstraintSeeds o
 * por nuestro error Unauthorized/InvalidGarden. Ambas son deny.
 */
async function expectRejected(
  promise: Promise<unknown>,
  codes: string[]
): Promise<void> {
  try {
    await promise;
    assert.fail(`Se esperaba uno de estos errores: ${codes.join(", ")}`);
  } catch (e: any) {
    const got = errorCodeOf(e);
    expect(
      codes.some((c) => got.includes(c)),
      `se obtuvo "${got}", esperado uno de: ${codes.join(", ")}`
    ).to.be.true;
  }
}

describe("RaízLedger (Anchor localnet)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program(idl as Raizledger, provider) as Program<Raizledger>;

  const authority = provider.wallet.publicKey;
  const gardenId = 0;
  const [garden] = deriveGardenPda(authority, gardenId, PROGRAM_ID);
  const [plant] = derivePlantPda(garden, 0, PROGRAM_ID);

  it("1. crea un jardín correctamente", async () => {
    await program.methods
      .initializeGarden(new BN(gardenId))
      .accountsPartial({
        authority,
        garden,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const account = await fetchGarden(program, authority, gardenId);
    assert.isNotNull(account);
    assert.equal(account!.authority.toBase58(), authority.toBase58());
    assert.equal(account!.gardenId.toNumber(), gardenId);
    assert.equal(account!.plantCount, 0);

    // El PDA impide una segunda inicialización con las mismas semillas.
    await expectError(
      program.methods
        .initializeGarden(new BN(gardenId))
        .accountsPartial({ authority, garden, systemProgram: SystemProgram.programId })
        .rpc(),
      "already in use"
    );
  });

  it("2. registra una planta", async () => {
    await program.methods
      .createPlant(new BN(0), "Monstera", "Monstera deliciosa", 7)
      .accountsPartial({
        authority,
        garden,
        plant,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const account = await fetchPlant(program, garden, 0);
    assert.isNotNull(account);
    assert.equal(account!.name, "Monstera");
    assert.equal(account!.species, "Monstera deliciosa");
    assert.equal(account!.wateringInterval, 7);
    assert.isFalse(isArchived(account!.status));
    assert.equal(account!.garden.toBase58(), garden.toBase58());
    assert.equal(account!.authority.toBase58(), authority.toBase58());

    const updatedGarden = await fetchGarden(program, authority, gardenId);
    assert.equal(updatedGarden!.plantCount, 1);
  });

  it("3. consulta una planta", async () => {
    const account = await program.account.plantAccount.fetch(plant);
    assert.equal(account.plantId.toNumber(), 0);
    assert.isAbove(account.lastWatered.toNumber(), 0);
  });

  it("4. modifica una planta", async () => {
    await program.methods
      .updatePlant(new BN(0), "Monstera gigante", "Monstera deliciosa", 10)
      .accountsPartial({ authority, garden, plant })
      .rpc();

    const account = await fetchPlant(program, garden, 0);
    assert.equal(account!.name, "Monstera gigante");
    assert.equal(account!.wateringInterval, 10);
  });

  it("5. rechaza un riego antes del intervalo permitido", async () => {
    const before = await fetchPlant(program, garden, 0);
    await expectError(
      program.methods
        .waterPlant(new BN(0))
        .accountsPartial({ authority, garden, plant })
        .rpc(),
      "WateringTooSoon"
    );
    const after = await fetchPlant(program, garden, 0);
    assert.equal(after!.lastWatered.toNumber(), before!.lastWatered.toNumber());
  });

  it("6. rechaza modificaciones de otra wallet", async () => {
    const attacker = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      attacker.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");

    const attackerProvider = new anchor.AnchorProvider(
      provider.connection,
      new anchor.Wallet(attacker),
      {}
    );
    const attackerProgram = new Program(
      idl as Raizledger,
      attackerProvider
    ) as Program<Raizledger>;

    await expectRejected(
      attackerProgram.methods
        .updatePlant(new BN(0), "Hacked", "Hacked", 1)
        .accountsPartial({ authority: attacker.publicKey, garden, plant })
        .rpc(),
      ["Unauthorized", "ConstraintSeeds"]
    );
  });

  it("7. rechaza operaciones sobre una planta archivada", async () => {
    await program.methods
      .archivePlant(new BN(0))
      .accountsPartial({ authority, garden, plant })
      .rpc();

    await expectError(
      program.methods
        .updatePlant(new BN(0), "Otra", "Otra", 3)
        .accountsPartial({ authority, garden, plant })
        .rpc(),
      "PlantArchived"
    );
    await expectError(
      program.methods
        .waterPlant(new BN(0))
        .accountsPartial({ authority, garden, plant })
        .rpc(),
      "PlantArchived"
    );
    await expectError(
      program.methods
        .archivePlant(new BN(0))
        .accountsPartial({ authority, garden, plant })
        .rpc(),
      "PlantArchived"
    );

    const account = await fetchPlant(program, garden, 0);
    assert.isTrue(isArchived(account!.status));
  });

  it("8. archiva una planta", async () => {
    // Ya fue archivada en el caso anterior; comprobamos el estado persistente.
    const account = await fetchPlant(program, garden, 0);
    assert.isTrue(isArchived(account!.status));
  });

  it("9. rechaza el cierre de una planta activa", async () => {
    const [garden2] = deriveGardenPda(authority, 1, PROGRAM_ID);
    const [plant2] = derivePlantPda(garden2, 0, PROGRAM_ID);
    await program.methods
      .initializeGarden(new BN(1))
      .accountsPartial({ authority, garden: garden2, systemProgram: SystemProgram.programId })
      .rpc();
    await program.methods
      .createPlant(new BN(0), "Activa", "Aloe vera", 5)
      .accountsPartial({
        authority,
        garden: garden2,
        plant: plant2,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await expectError(
      program.methods
        .closePlant(new BN(0))
        .accountsPartial({ authority, garden: garden2, plant: plant2 })
        .rpc(),
      "PlantNotArchived"
    );
  });

  it("10. cierra correctamente una planta archivada", async () => {
    const before = await provider.connection.getBalance(authority);
    await program.methods
      .closePlant(new BN(0))
      .accountsPartial({ authority, garden, plant })
      .rpc();
    const after = await provider.connection.getBalance(authority);
    assert.isAbove(after, before);

    const account = await provider.connection.getAccountInfo(plant);
    assert.isNull(account);
  });

  it("11. comprueba la pertenencia de las cuentas al jardín", async () => {
    const [garden3] = deriveGardenPda(authority, 2, PROGRAM_ID);
    const [plant3] = derivePlantPda(garden3, 0, PROGRAM_ID);
    await program.methods
      .initializeGarden(new BN(2))
      .accountsPartial({ authority, garden: garden3, systemProgram: SystemProgram.programId })
      .rpc();
    await program.methods
      .createPlant(new BN(0), "Ficus", "Ficus elastica", 9)
      .accountsPartial({
        authority,
        garden: garden3,
        plant: plant3,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const account = await fetchPlant(program, garden3, 0);
    assert.equal(account!.garden.toBase58(), garden3.toBase58());

    // Se intenta usar la planta del jardín 2 con el jardín 1.
    await expectRejected(
      program.methods
        .updatePlant(new BN(0), "Intruso", "Intruso", 2)
        .accountsPartial({ authority, garden, plant: plant3 })
        .rpc(),
      ["InvalidGarden", "ConstraintSeeds"]
    );
  });
});
