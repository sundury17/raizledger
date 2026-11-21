//! Prueba del aporte funcional con control del reloj de Solana.
//!
//! LiteSVM permite sobrescribir el sysvar Clock, algo que el validador local
//! no expone. Así se comprueba que el riego se rechaza antes del intervalo y
//! se acepta cuando ya transcurrió.

use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use litesvm::LiteSVM;
use solana_sdk::{
    clock::Clock,
    instruction::Instruction,
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    system_program,
    transaction::Transaction,
};

fn garden_pda(authority: &Pubkey, id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[b"garden", authority.as_ref(), &id.to_le_bytes()],
        &raizledger::ID,
    )
    .0
}

fn plant_pda(garden: &Pubkey, id: u64) -> Pubkey {
    Pubkey::find_program_address(&[b"plant", garden.as_ref(), &id.to_le_bytes()], &raizledger::ID).0
}

fn ix<A: ToAccountMetas, D: InstructionData>(accounts: A, data: D) -> Instruction {
    Instruction::new_with_bytes(raizledger::ID, &data.data(), accounts.to_account_metas(None))
}

fn send(svm: &mut LiteSVM, ix: Instruction, payer: &Keypair) -> Result<(), String> {
    // Evita que dos instrucciones idénticas produzcan la misma firma.
    svm.expire_blockhash();
    let blockhash = svm.latest_blockhash();
    let mut tx = Transaction::new_with_payer(&[ix], Some(&payer.pubkey()));
    tx.try_sign(&[payer], blockhash).map_err(|e| e.to_string())?;
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| e.err.to_string())
}

#[test]
fn riego_requiere_intervalo_minimo() {
    let mut svm = LiteSVM::new();
    let so_path = std::env::var("BPF_OUT_DIR")
        .unwrap_or_else(|_| "target/deploy".to_string())
        .trim_end_matches('/')
        .to_string()
        + "/raizledger.so";
    svm.add_program_from_file(raizledger::ID, &so_path)
        .unwrap_or_else(|e| panic!("no se encontró {so_path}: {e}"));

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10 * solana_sdk::native_token::LAMPORTS_PER_SOL)
        .unwrap();

    let garden = garden_pda(&payer.pubkey(), 0);
    let plant = plant_pda(&garden, 0);

    send(
        &mut svm,
        ix(
            raizledger::accounts::InitializeGarden {
                authority: payer.pubkey(),
                garden,
                system_program: system_program::ID,
            },
            raizledger::instruction::InitializeGarden { garden_id: 0 },
        ),
        &payer,
    )
    .unwrap();

    send(
        &mut svm,
        ix(
            raizledger::accounts::CreatePlant {
                authority: payer.pubkey(),
                garden,
                plant,
                system_program: system_program::ID,
            },
            raizledger::instruction::CreatePlant {
                plant_id: 0,
                name: "Helecho".to_string(),
                species: "Nephrolepis exaltata".to_string(),
                watering_interval: 1,
            },
        ),
        &payer,
    )
    .unwrap();

    let water_ix = || {
        ix(
            raizledger::accounts::WaterPlant {
                authority: payer.pubkey(),
                garden,
                plant,
            },
            raizledger::instruction::WaterPlant { plant_id: 0 },
        )
    };

    // 1) Rechazo inmediato: apenas transcurrieron 0 segundos.
    let err = send(&mut svm, water_ix(), &payer).unwrap_err();
    assert!(
        err.contains("WateringTooSoon") || err.contains("0x177a"),
        "se esperaba WateringTooSoon, se obtuvo: {err}"
    );

    // 2) Avanzamos el reloj 2 días y ahora sí se acepta.
    let mut clock: Clock = svm.get_sysvar();
    let nuevo_timestamp = clock.unix_timestamp + 2 * 86_400;
    clock.unix_timestamp = nuevo_timestamp;
    svm.set_sysvar(&clock);

    send(&mut svm, water_ix(), &payer)
        .expect("el riego debe aceptarse tras cumplir el intervalo");

    let raw = svm.get_account(&plant).unwrap();
    let cuenta = raizledger::PlantAccount::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(cuenta.last_watered, nuevo_timestamp);

    // 3) Tras regar, el contador se reinicia: vuelve a rechazarse.
    let err = send(&mut svm, water_ix(), &payer).unwrap_err();
    assert!(
        err.contains("WateringTooSoon") || err.contains("0x177a"),
        "se esperaba WateringTooSoon tras regar, se obtuvo: {err}"
    );
}
