import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import * as anchor from "@coral-xyz/anchor";
import type { Wallet as AnchorWallet } from "@coral-xyz/anchor/dist/cjs/provider";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";
import * as client from "../lib/raizledger";
import type { GardenAccount, PlantAccount, ProgramType } from "../lib/raizledger";

type WalletState = ReturnType<typeof useWallet>;

/** Adapta la wallet de wallet-adapter a la interfaz que espera Anchor. */
class AdapterWallet implements AnchorWallet {
  constructor(private readonly wallet: WalletState) {}
  get publicKey() {
    if (!this.wallet.publicKey) throw new Error("Wallet no conectada");
    return this.wallet.publicKey;
  }
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (!this.wallet.signTransaction) throw new Error("La wallet no puede firmar");
    return this.wallet.signTransaction(tx) as Promise<T>;
  }
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    if (!this.wallet.signAllTransactions) throw new Error("La wallet no puede firmar");
    return this.wallet.signAllTransactions(txs) as Promise<T[]>;
  }
}

export type Notice = { text: string; signature: string } | null;

function friendlyError(e: unknown): string {
  const err = e as any;
  return (
    err?.error?.errorMessage ??
    err?.errorMessage ??
    err?.message ??
    "No se pudo completar la operación"
  );
}

export function useRaizledger() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [garden, setGarden] = useState<GardenAccount | null>(null);
  const [plants, setPlants] = useState<PlantAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const busy = useRef(false);
  const connected = Boolean(wallet.publicKey && wallet.connected);

  const getProgram = useCallback((): ProgramType | null => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    const provider = new anchor.AnchorProvider(connection, new AdapterWallet(wallet), {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    return client.createProgram(provider);
  }, [connection, wallet]);

  const refresh = useCallback(async () => {
    const program = getProgram();
    if (!program || !wallet.publicKey) {
      setGarden(null);
      setPlants([]);
      return;
    }
    setLoading(true);
    try {
      const g = await client.fetchGarden(program, wallet.publicKey);
      setGarden(g);
      setPlants(g ? await client.fetchAllPlants(program, wallet.publicKey) : []);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [getProgram, wallet.publicKey]);

  useEffect(() => {
    setError(null);
    setNotice(null);
    void refresh();
  }, [connected, refresh]);

  const run = useCallback(
    async (fn: (program: ProgramType) => Promise<string>, message: string) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      setError(null);
      setNotice(null);
      try {
        const program = getProgram();
        if (!program || !wallet.publicKey) throw new Error("Conecta tu wallet primero");
        // rpc() espera la confirmación antes de devolver la firma.
        const signature = await fn(program);
        setNotice({ text: message, signature });
        await refresh();
      } catch (e) {
        setError(friendlyError(e));
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [getProgram, refresh, wallet.publicKey]
  );

  const authority = wallet.publicKey;

  return {
    connected,
    connecting: wallet.connecting,
    publicKey: authority,
    walletName: wallet.wallet?.adapter.name ?? null,
    wallets: wallet.wallets,
    select: wallet.select,
    connect: wallet.connect,
    disconnect: wallet.disconnect,
    garden,
    plants,
    loading,
    pending,
    error,
    notice,
    clearMessages: () => {
      setError(null);
      setNotice(null);
    },
    refresh,
    initializeGarden: () =>
      run((p) => client.initializeGarden({ program: p, authority: authority! }), "Jardín creado"),
    createPlant: (args: {
      name: string;
      species: string;
      wateringInterval: number;
    }) =>
      run(
        (p) =>
          client.createPlant(
            { program: p, authority: authority! },
            { plantId: garden?.plantCount ?? 0, ...args }
          ),
        "Planta registrada"
      ),
    updatePlant: (plantId: number, args: { name: string; species: string; wateringInterval: number }) =>
      run(
        (p) => client.updatePlant({ program: p, authority: authority! }, { plantId, ...args }),
        "Planta actualizada"
      ),
    waterPlant: (plantId: number) =>
      run(
        (p) => client.waterPlant({ program: p, authority: authority! }, { plantId }),
        "Riego registrado"
      ),
    archivePlant: (plantId: number) =>
      run(
        (p) => client.archivePlant({ program: p, authority: authority! }, { plantId }),
        "Planta archivada"
      ),
    closePlant: (plantId: number) =>
      run(
        (p) => client.closePlant({ program: p, authority: authority! }, { plantId }),
        "Cuenta cerrada y rent devuelto"
      ),
  };
}
