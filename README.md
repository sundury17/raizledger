# RaízLedger

> Registro botánico on-chain en Solana. Un jardín por wallet, plantas como PDAs
> y reglas de cuidado verificables en el programa.

RaízLedger es un dApp mínimo y original para registrar plantas, llevar el control
de su riego y cerrar cuentas cuando ya no se necesitan. No incluye tokens, NFTs,
pagos, marketplaces ni funcionalidades ajenas al objetivo: **gestionar el
cuidado de plantas en Solana**.

Estado actual: **localnet probado; Devnet no desplegado**. El Program ID es real
y fue derivado de una keypair generada localmente, pero todavía no se envió
ninguna transacción de despliegue ni se gastó SOL en Devnet.

---

## 1. Requisitos y versiones

| Herramienta | Versión usada |
| --- | --- |
| Rust | estable (vía `rustup`) |
| Solana CLI | `4.4.1` |
| Anchor CLI | `0.32.0` |
| Node.js | `22+` (verificado con `v26.13.1`) |
| npm | `10+` (verificado con `12.2.3`) |

`Anchor.toml` fija `solana_version = "4.4.1"` para que Anchor use
platform-tools con una versión de Rust capaz de compilar los crates actuales.
Además, `Cargo.lock` fija versiones compatibles de dependencias problemáticas
(`proc-macro-crate`, `zeroize`, `zeroize_derive`, `indexmap`,
`unicode-segmentation`) para evitar errores `edition2024` con toolchains SBF
antiguas.

---

## 2. Estructura

```text
raizledger/
├── Anchor.toml                 # Configuración de Anchor y Program ID
├── Cargo.toml / Cargo.lock     # Workspace Rust y lockfile reproducible
├── programs/raizledger/
│   ├── src/lib.rs              # Programa Anchor completo
│   └── tests/intervalo.rs      # Prueba Rust del aporte funcional (Clock)
├── tests/raizledger.ts         # 11 pruebas de integración Anchor/localnet
├── app/
│   ├── src/lib/raizledger.ts   # Cliente TypeScript (separado de la UI)
│   ├── src/idl/raizledger.json # IDL real generado por Anchor
│   ├── src/types/raizledger.ts # Tipos TS reales generados por Anchor
│   ├── src/hooks/              # Estado React y envío de transacciones
│   ├── src/components/         # Wallet, formularios, tarjetas y avisos
│   ├── src/pages/Dashboard.tsx # Única pantalla de la dApp
│   └── src/styles.css
├── target/idl/                 # IDL generado (fuente de la copia de la app)
├── target/types/               # Tipos generados
└── README.md
```

La UI **no construye transacciones**: solo llama al cliente en
`app/src/lib/raizledger.ts`. Ese módulo concentra derivación de PDAs, lectura de
cuentas, envío de instrucciones y URLs del Explorer.

---

## 3. Diseño del programa

### Program ID

```text
CDCv1frTdbCEvQR99XXccVkjMKqdDRgaQLPmVpimSjkp
```

Se generó con `solana-keygen` en
`target/deploy/raizledger-keypair.json` (archivo ignorado por Git). No es un
identificador inventado ni copiado de otro proyecto.

### Cuentas

#### `GardenAccount`

PDA: `["garden", authority, garden_id]` con `garden_id: u64` en little-endian.

| Campo | Tipo |
| --- | --- |
| `authority` | `Pubkey` |
| `garden_id` | `u64` |
| `plant_count` | `u32` |
| `bump` | `u8` |

Espacio: `8 + 32 + 8 + 4 + 1 = 53` bytes.

#### `PlantAccount`

PDA: `["plant", garden_pubkey, plant_id]` con `plant_id: u64` en little-endian.

| Campo | Tipo |
| --- | --- |
| `garden` | `Pubkey` |
| `authority` | `Pubkey` |
| `plant_id` | `u64` |
| `name` | `String` (máx. 32 bytes) |
| `species` | `String` (máx. 32 bytes) |
| `watering_interval` | `u8` (1–255 días) |
| `last_watered` | `i64` (`unix_timestamp`) |
| `status` | `PlantStatus` (`Active` / `Archived`) |
| `bump` | `u8` |

Espacio reservado: `8 + 32 + 32 + 8 + 4 + 32 + 4 + 32 + 1 + 8 + 1 + 1 = 163`
bytes. Incluye el discriminator de 8 bytes y los prefijos de longitud de los
`String`.

### Instrucciones

| Instruccion | Acción |
| --- | --- |
| `initialize_garden` | Crea el jardín PDA de la wallet para un `garden_id`. |
| `create_plant` | Crea una planta PDA usando el contador actual del jardín. |
| `update_plant` | Edita nombre, especie e intervalo de una planta activa. |
| `water_plant` | Registra un riego **solo si ya transcurrió el intervalo**. |
| `archive_plant` | Marca una planta activa como archivada. |
| `close_plant` | Cierra una planta **archivada** y devuelve el rent a la authority. |

No hay instrucciones adicionales.

### Seguridad

- Las semillas de las PDAs se validan en todas las instrucciones; una cuenta
  falsificada o de otro jardín es rechazada por `ConstraintSeeds` o por los
  errores `Unauthorized` / `InvalidGarden`.
- `plant.authority` y `plant.garden` se comprueban explícitamente.
- `close = authority` en `ClosePlant` devuelve el rent al propietario.
- `close_plant` exige `status == Archived`; una planta activa nunca se puede
  cerrar.
- `update_plant`, `water_plant` y `archive_plant` exigen `status == Active`.
- Se validan longitudes, no vacío, rango del intervalo, IDs y desbordamientos
  aritméticos con errores personalizados.

---

## 4. Contribución propia y mejora funcional

### Regla de riego con `Clock`

La mejora funcional propia es la **validación temporal del riego dentro del
programa**, no en la interfaz:

```rust
let now = Clock::get()?.unix_timestamp;
let required = i64::from(plant.watering_interval)
    .checked_mul(SECONDS_PER_DAY)
    .ok_or(ErrorCode::ArithmeticOverflow)?;
let elapsed = now
    .checked_sub(plant.last_watered)
    .ok_or(ErrorCode::InvalidTimestamp)?;

require!(elapsed >= 0, ErrorCode::InvalidTimestamp);
require!(elapsed >= required, ErrorCode::WateringTooSoon);
plant.last_watered = now;
```

Esto significa que:

1. Al crear la planta, `last_watered` se inicializa con el `unix_timestamp`
   del reloj de Solana.
2. Un riego antes de `watering_interval` días falla con el error personalizado
   `WateringTooSoon` (código `6010` / `0x177a`) y **no modifica la cuenta**.
3. Cuando transcurre el intervalo, el riego se acepta y `last_watered` se
   reinicia, por lo que el contador vuelve a empezar.

La UI calcula cuándo corresponde regar solo para mostrar el estado y deshabilitar
el botón, pero **la autoridad es el programa**: un cliente malicioso no puede
saltarse la regla.

### Por qué hay una prueba Rust adicional

`solana-test-validator` no permite cambiar el sysvar `Clock` desde un test de
JavaScript, por lo que no se puede simular el paso de días con `anchor test`.
La prueba `programs/raizledger/tests/intervalo.rs` usa **LiteSVM**, que sí
permite `set_sysvar(&clock)`, y comprueba las tres fases:

1. rechazo inmediato con `WateringTooSoon`;
2. aceptación tras avanzar el reloj 2 días;
3. rechazo nuevamente después del riego exitoso.

También verifica que `last_watered` queda guardado con el nuevo timestamp.

---

## 5. Pruebas

### 5.1 Pruebas Anchor/localnet — 11 casos

`tests/raizledger.ts` cubre:

1. creación de jardín y prevención de duplicados;
2. registro de planta e incremento del contador;
3. consulta de planta;
4. modificación de planta;
5. rechazo de riego antes del intervalo;
6. rechazo de modificación desde otra wallet;
7. rechazo de operaciones sobre planta archivada;
8. persistencia del archivado;
9. rechazo de cierre de planta activa;
10. cierre de planta archivada con devolución de rent;
11. comprobación de pertenencia al jardín.

Comando y resultado real:

```bash
source ~/.cargo/env
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd raizledger
anchor build
anchor test --skip-build
```

```text
  RaízLedger (Anchor localnet)
    ✔ 1. crea un jardín correctamente
    ✔ 2. registra una planta
    ✔ 3. consulta una planta
    ✔ 4. modifica una planta
    ✔ 5. rechaza un riego antes del intervalo permitido
    ✔ 6. rechaza modificaciones de otra wallet
    ✔ 7. rechaza operaciones sobre una planta archivada
    ✔ 8. archiva una planta
    ✔ 9. rechaza el cierre de una planta activa
    ✔ 10. cierra correctamente una planta archivada
    ✔ 11. comprueba la pertenencia de las cuentas al jardín

  11 passing (4s)
```

Junto con la prueba Rust de intervalo son **12 casos automatizados**.

### 5.2 Prueba funcional con reloj controlado — 1 caso

```bash
source ~/.cargo/env
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd raizledger

# LiteSVM 0.7 necesita un SBF con arquitectura v0.
cargo build-sbf --arch v0 --tools-version v1.57

BPF_OUT_DIR="$PWD/target/deploy" \
  cargo test -p raizledger --test intervalo -- --nocapture
```

Resultado real:

```text
running 1 test
test riego_requiere_intervalo_minimo ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

También está disponible como script npm:

```bash
npm run test:interval
```

> Si ejecutas `anchor build` después del comando SBF `v0`, el `.so` puede
>volver a generarse para la arquitectura por defecto. Eso no afecta
>`anchor test`; vuelve a ejecutar `cargo build-sbf --arch v0 ...` antes de la
>prueba Rust.

---

## 6. Frontend

### Ejecutar

```bash
cd raizledger/app
npm install
npm run dev
```

Abre `http://localhost:5173`.

### Build de producción

```bash
cd raizledger/app
npm run build
```

El build fue verificado: TypeScript sin errores y Vite genera `dist/`.

### Funcionalidades

- Conexión real con Phantom o Solflare mediante `@solana/wallet-adapter`.
- Indicador visible de **Devnet** y enlace al programa en Solana Explorer.
- Creación de jardín.
- Alta, consulta, edición, riego, archivado y cierre de plantas.
- Botón de riego deshabilitado mientras no corresponde (según el intervalo).
- Cierre disponible solo para plantas archivadas.
- Confirmaciones esperadas antes de mostrar éxito (`commitment: confirmed`).
- Estados de carga, error y éxito con enlace a la firma en el Explorer.
- Protección contra doble envío mediante un bloqueo `busy` en el hook.
- Lectura de todas las plantas recorriendo `plantCount` desde el cliente.

La UI apunta siempre a `https://api.devnet.solana.com`. Para usar otro RPC,
cambia `DEVNET_RPC` en `app/src/main.tsx`.

---

## 7. Despliegue en Devnet

**A día de hoy NO se ha desplegado.** No hay firmas de despliegue ni de
transacciones que reportar, y este README no inventa ninguna.

Para desplegar se necesita autorización explícita y SOL en Devnet:

```bash
source ~/.cargo/env
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd raizledger

solana config set --url devnet
solana-keygen pubkey target/deploy/raizledger-keypair.json   # CDCv1fr...
solana balance                                              # debe tener SOL

anchor build
anchor deploy --provider.cluster devnet
```

Tras un despliegue real, verificar con:

```text
https://explorer.solana.com/address/CDCv1frTdbCEvQR99XXccVkjMKqdDRgaQLPmVpimSjkp?cluster=devnet
```

Solo entonces se podrían documentar la firma de despliegue y las firmas de las
primeras transacciones de la dApp.

---

## 8. Reproducción resumida

```bash
# 1) Herramientas
source ~/.cargo/env
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# 2) Backend y pruebas
cd raizledger
npm install
anchor build
anchor test --skip-build
cargo build-sbf --arch v0 --tools-version v1.57
npm run test:interval

# 3) Frontend
cd app
npm install
npm run build
npm run dev
```

---

## 9. Estado honesto de la evidencia

| Elemento | Estado |
| --- | --- |
| Programa Anchor | Implementado y compilado localmente |
| IDL y tipos TS | Generados por Anchor y copiados a la app |
| 11 pruebas localnet | Ejecutadas y pasando |
| Prueba de intervalo con Clock | Ejecutada y pasando |
| Frontend | Compila; acciones conectadas al cliente real |
| Despliegue Devnet | **Pendiente de autorización** |
| Transacciones Devnet | **Ninguna ejecutada** |

RaízLedger cumple así los requisitos de un dApp Solana funcional, seguro y
mínimo, con una mejora funcional verificable directamente en el programa.

---

## 10. Licencia

Distribuido bajo licencia **MIT**. Ver [LICENSE](LICENSE).
