# RaízLedger

> Registro botánico on-chain en Solana. Un jardín por wallet, plantas como PDAs
> y reglas de cuidado verificables en el programa.

RaízLedger es un dApp mínimo y original para registrar plantas, llevar el control
de su riego y cerrar cuentas cuando ya no se necesitan. No incluye tokens, NFTs,
pagos, marketplaces ni funcionalidades ajenas al objetivo: **gestionar el
cuidado de plantas en Solana**.

Estado actual: **compilado, probado en localnet, desplegado en Devnet y con un
flujo completo de la dApp ejecutado y verificado on-chain**. El Program ID es
real, fue derivado de una keypair generada localmente y su cuenta ejecutable
fue verificada on-chain el 21 de noviembre de 2026.

---

## Entrega y acceso para revisión

**Repositorio público:** https://github.com/sundury17/raizledger

No se necesita invitación ni autorización para abrirlo. Verificado el 21 de
noviembre de 2026 con un clon anónimo:

```bash
git clone https://github.com/sundury17/raizledger.git
curl -I https://raw.githubusercontent.com/sundury17/raizledger/main/README.md
```

El clon terminó correctamente y la petición al README devolvió `HTTP/2 200`.
No hay keypairs, `.env` ni secretos versionados; `.gitignore` los excluye y
`git ls-files` confirma que no están en el historial entregado.

### Ruta elegida

**Proyecto propio.** RaízLedger no es el punto de venta guiado: cambia el caso
de uso a registro botánico y mantiene competencias equivalentes con decisiones
y código propios. La base fue un workspace Anchor vacío creado para este
proyecto; no se copió la versión resuelta del bootcamp.

| Requisito de la ruta propia | Implementación en RaízLedger | Dónde comprobarlo |
| --- | --- | --- |
| Cuentas relacionadas y PDAs | `GardenAccount` y `PlantAccount`, con semillas `["garden", authority, garden_id]` y `["plant", garden, plant_id]` | §3 y `programs/raizledger/src/lib.rs` |
| Cliente coherente con su IDL | IDL real generado por Anchor; el cliente deriva PDAs y construye todas las instrucciones desde él | `app/src/idl/raizledger.json`, `app/src/lib/raizledger.ts` |
| Frontend con wallet | React + Vite + Phantom/Solflare, conectado a Devnet | §6 y `app/src/pages/Dashboard.tsx` |
| Creación | `initialize_garden` y `create_plant` | Firmas de evidencia y prueba localnet 1–2 |
| Lectura | `fetchGarden`, `fetchPlant` y `fetchAllPlants` | Salida `Lectura:` del script de evidencia y prueba 3 |
| Modificación | `update_plant` y `water_plant` | Firmas de evidencia y pruebas 4–5 |
| Permisos | `authority`, pertenencia al jardín y validación de semillas | §3 y pruebas 6, 7, 9, 11 |
| Baja condicionada por una regla | `close_plant` solo funciona si la planta está archivada; el rent vuelve a la authority | Pruebas 9–10 y firma `close_plant` |
| Aporte propio | Regla de riego con `Clock::get()` en Rust y error `WateringTooSoon` | §4, prueba Rust y rechazo en Devnet |

### Código de la versión entregada

| Elemento | Archivo versionado |
| --- | --- |
| Programa Anchor | `programs/raizledger/src/lib.rs` |
| Pruebas del programa | `tests/raizledger.ts` y `programs/raizledger/tests/intervalo.rs` |
| IDL generado | `target/idl/raizledger.json` |
| Copia del IDL usada por la app | `app/src/idl/raizledger.json` |
| Tipos TS generados | `app/src/types/raizledger.ts` |
| Cliente TypeScript | `app/src/lib/raizledger.ts` |
| Frontend | `app/src/` (hook, componentes, página y estilos) |
| Generador de evidencia Devnet | `scripts/evidencia-devnet.ts` |

`target/idl/raizledger.json` y `app/src/idl/raizledger.json` son byte-idénticos;
lo mismo ocurre con los tipos TS. Ambos declaran el Program ID
`CDCv1frTdbCEvQR99XXccVkjMKqdDRgaQLPmVpimSjkp` y las seis instrucciones
entregadas.

### Pruebas y evidencias en Devnet

Además de las 12 pruebas automatizadas locales, se ejecutó un flujo real contra
Devnet con:

```bash
PAYER=/ruta/a/keypair.json npm run evidence:devnet
```

El script no guarda secretos: recibe la ruta del keypair por entorno, crea un
jardín, crea una planta, la lee, comprueba dos rechazos, la modifica, la archiva
y la cierra. Resultado real (authority
`6fRLSV6KHRRGjsj1ezpv8mzuV4EsuGKTRvt9roVNc4PA`, jardín
`4bQEc2AsuRndRkHH2R8va1aYBrvwvRijsnUQttvjnBF8`):

| Operación | Firma verificable |
| --- | --- |
| `initialize_garden` | [`w1AcZydT...RYAFgV`](https://explorer.solana.com/tx/w1AcZydTq1TX76VURgEsHZCZim1YxvbL2qqQDUboAatQmuinnBRZNZg1PFgGi3TtNud6abSzKhbdDmfygRYAFgV?cluster=devnet) |
| `create_plant` | [`21S24a4D...vezWqZ92`](https://explorer.solana.com/tx/21S24a4DgdWzimVZgx4LVCJjCqrAUyxJvErdy4bbkCA8PYQxMbGiYroYhhy3uDVGLLFqdL5xQyiotzsxvezWqZ92?cluster=devnet) |
| `update_plant` | [`4zTR6Rsb...EDeukD`](https://explorer.solana.com/tx/4zTR6RsbHhwoFqEywKju15Aqd6247MvwAG2gyAVV6T7WzpYmvsgz3bMC3qzcL8gbaYrHnax3npgXfADNpQEDeukD?cluster=devnet) |
| `archive_plant` | [`JB2fGG1A...gDM4gX`](https://explorer.solana.com/tx/JB2fGG1AgVHqAEqG1qSnVreR6LmwcH9YJ5eXcwjXLq7afRu7imTU8RmoqJxjRTUuAxmPBzP8PA6uLZgKamDM4gX?cluster=devnet) |
| `close_plant` | [`2Vpj9pZ9...AtM7`](https://explorer.solana.com/tx/2Vpj9pZ9mZAB4DBoPfhHvYbUEV4akaeCwboa2Akadm32sKbQppGoWgGwBuwE5shMwucJxLKpbthsDfGge1LRAtM7?cluster=devnet) |

Salida relevante del script:

```text
Lectura: id=0 nombre=Evidencia especie=Prueba intervalo=1 estado={"active":{}}
Rechazo esperado (riego antes del intervalo): WateringTooSoon
Rechazo esperado (cierre de planta activa): PlantNotArchived
```

El despliegue del programa también tiene firma propia, documentada en §7.

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
├── scripts/evidencia-devnet.ts # Generador de firmas verificables en Devnet
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

El programa fue desplegado correctamente en Devnet el **21 de noviembre de
2026** con:

```bash
source ~/.cargo/env
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd raizledger
anchor deploy --provider.cluster devnet
```

Datos reales del despliegue:

| Dato | Valor |
| --- | --- |
| Program ID | `CDCv1frTdbCEvQR99XXccVkjMKqdDRgaQLPmVpimSjkp` |
| Firma del despliegue | `4sg5DdYa34W2PYcqKUtYQkpjogLexw6vxJzV8iGs95ymwfCTBWFwhGq7QYXs72GiY7FQaVFMhdycGSEZfXEsa9Ny` |
| ProgramData | `p8Uf9C6vFABM1Ud7TDNXPBatHUduxrhKeCEReqhW5bK` |
| Upgrade authority | `6fRLSV6KHRRGjsj1ezpv8mzuV4EsuGKTRvt9roVNc4PA` |
| Cuenta IDL | `7exkMzG6GFyxMSZivrkp5s55nnr3ZLq2PhdmxXPH8QSD` |
| Slot del último despliegue | `524803374` |
| Dueño de la cuenta del programa | `BPFLoaderUpgradeab1e11111111111111111111111` |
| Longitud del programa | `241528 bytes` |
| Rent del programa | `1.22784108 SOL` |
| Cluster | Devnet (`https://api.devnet.solana.com`) |

Verificación local repetible:

```bash
solana program show CDCv1frTdbCEvQR99XXccVkjMKqdDRgaQLPmVpimSjkp --url devnet
solana account 7exkMzG6GFyxMSZivrkp5s55nnr3ZLq2PhdmxXPH8QSD --url devnet
```

Enlace del programa:

```text
https://explorer.solana.com/address/CDCv1frTdbCEvQR99XXccVkjMKqdDRgaQLPmVpimSjkp?cluster=devnet
```

Enlace de la firma del despliegue:

```text
https://explorer.solana.com/tx/4sg5DdYa34W2PYcqKUtYQkpjogLexw6vxJzV8iGs95ymwfCTBWFwhGq7QYXs72GiY7FQaVFMhdycGSEZfXEsa9Ny?cluster=devnet
```

Nota: varios faucets rechazaron o limitaron el funding inicial; la wallet de
deploy fue financiada finalmente desde otra cuenta. El repositorio, el Program
ID y la autoridad de upgrade no cambiaron. Las firmas de las acciones de la
dApp se generan en tiempo real en el navegador y se muestran en la interfaz; no
se inventan ni se copian entre ejecuciones.

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

# 4) Evidencia real en Devnet (opcional; gasta fees de Devnet)
cd ..
PAYER=/ruta/a/keypair.json npm run evidence:devnet
```

---

## 9. Estado honesto de la evidencia

| Elemento | Estado |
| --- | --- |
| Programa Anchor | Implementado y compilado localmente |
| IDL y tipos TS | Generados por Anchor; copia de la app byte-idéntica al IDL entregado |
| 11 pruebas localnet | Ejecutadas y pasando |
| Prueba de intervalo con Clock | Ejecutada y pasando |
| Frontend | Compila; acciones conectadas al cliente real |
| Repositorio para revisión | Público, sin secretos y verificado con clon anónimo |
| Despliegue Devnet | **Desplegado y verificado on-chain** (firma documentada en §7) |
| Flujo Devnet de la dApp | **5 firmas verificables**: crear, leer, modificar, archivar y cerrar |
| Rechazos Devnet | `WateringTooSoon` y `PlantNotArchived` observados en el script |

RaízLedger cumple así los requisitos de un dApp Solana funcional, seguro y
mínimo, con una mejora funcional verificable directamente en el programa y con
evidencia pública tanto local como on-chain.

---

## 10. Licencia

Distribuido bajo licencia **MIT**. Ver [LICENSE](LICENSE).
