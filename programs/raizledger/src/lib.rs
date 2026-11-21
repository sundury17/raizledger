//! RaízLedger — registro on-chain del cuidado de plantas en Solana.
//!
//! Programa mínimo y auditable: un jardín por (authority, garden_id) y
//! plantas derivadas de (garden, plant_id). Toda operación sensible valida
//! propietario, pertenencia al jardín y estado de la planta.

use anchor_lang::prelude::*;

declare_id!("CDCv1frTdbCEvQR99XXccVkjMKqdDRgaQLPmVpimSjkp");

/// Longitudes máximas de los campos de texto (bytes UTF-8).
pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SPECIES_LEN: usize = 32;

/// Intervalo de riego permitido, en días.
pub const MIN_WATERING_INTERVAL: u8 = 1;
pub const MAX_WATERING_INTERVAL: u8 = 255;

pub const SECONDS_PER_DAY: i64 = 86_400;

pub const GARDEN_SEED: &[u8] = b"garden";
pub const PLANT_SEED: &[u8] = b"plant";

#[program]
pub mod raizledger {
    use super::*;

    /// Crea el jardín de la wallet. La PDA impide inicializaciones duplicadas
    /// para la misma (authority, garden_id).
    pub fn initialize_garden(ctx: Context<InitializeGarden>, garden_id: u64) -> Result<()> {
        let garden = &mut ctx.accounts.garden;
        garden.authority = ctx.accounts.authority.key();
        garden.garden_id = garden_id;
        garden.plant_count = 0;
        garden.bump = ctx.bumps.garden;
        Ok(())
    }

    /// Registra una planta nueva dentro del jardín. `plant_id` debe ser
    /// exactamente el contador actual del jardín para mantener la secuencia.
    pub fn create_plant(
        ctx: Context<CreatePlant>,
        plant_id: u64,
        name: String,
        species: String,
        watering_interval: u8,
    ) -> Result<()> {
        let garden = &mut ctx.accounts.garden;

        require!(
            garden.authority == ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        require!(
            plant_id == u64::from(garden.plant_count),
            ErrorCode::InvalidPlantId
        );
        require!(!name.is_empty(), ErrorCode::EmptyName);
        require!(!species.is_empty(), ErrorCode::EmptySpecies);
        require!(name.len() <= MAX_NAME_LEN, ErrorCode::NameTooLong);
        require!(species.len() <= MAX_SPECIES_LEN, ErrorCode::SpeciesTooLong);
        require!(
            (MIN_WATERING_INTERVAL..=MAX_WATERING_INTERVAL).contains(&watering_interval),
            ErrorCode::InvalidWateringInterval
        );

        let plant = &mut ctx.accounts.plant;
        plant.garden = garden.key();
        plant.authority = ctx.accounts.authority.key();
        plant.plant_id = plant_id;
        plant.name = name;
        plant.species = species;
        plant.watering_interval = watering_interval;
        plant.last_watered = Clock::get()?.unix_timestamp;
        plant.status = PlantStatus::Active;
        plant.bump = ctx.bumps.plant;

        garden.plant_count = garden
            .plant_count
            .checked_add(1)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        Ok(())
    }

    /// Modifica los datos editables de una planta activa.
    pub fn update_plant(
        ctx: Context<UpdatePlant>,
        plant_id: u64,
        name: String,
        species: String,
        watering_interval: u8,
    ) -> Result<()> {
        require!(!name.is_empty(), ErrorCode::EmptyName);
        require!(!species.is_empty(), ErrorCode::EmptySpecies);
        require!(name.len() <= MAX_NAME_LEN, ErrorCode::NameTooLong);
        require!(species.len() <= MAX_SPECIES_LEN, ErrorCode::SpeciesTooLong);
        require!(
            (MIN_WATERING_INTERVAL..=MAX_WATERING_INTERVAL).contains(&watering_interval),
            ErrorCode::InvalidWateringInterval
        );

        let plant = &mut ctx.accounts.plant;
        require!(plant.plant_id == plant_id, ErrorCode::InvalidPlantId);
        require!(
            plant.status == PlantStatus::Active,
            ErrorCode::PlantArchived
        );

        plant.name = name;
        plant.species = species;
        plant.watering_interval = watering_interval;
        Ok(())
    }

    /// Registra un riego. Aporte funcional: solo se permite si ya transcurrió
    /// el intervalo mínimo configurado desde el último riego.
    pub fn water_plant(ctx: Context<WaterPlant>, plant_id: u64) -> Result<()> {
        let plant = &mut ctx.accounts.plant;
        require!(plant.plant_id == plant_id, ErrorCode::InvalidPlantId);
        require!(
            plant.status == PlantStatus::Active,
            ErrorCode::PlantArchived
        );

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
        Ok(())
    }

    /// Archiva una planta activa. Las plantas archivadas no pueden volver a
    /// archivarse ni recibir otras operaciones (salvo cerrarlas).
    pub fn archive_plant(ctx: Context<ArchivePlant>, plant_id: u64) -> Result<()> {
        let plant = &mut ctx.accounts.plant;
        require!(plant.plant_id == plant_id, ErrorCode::InvalidPlantId);
        require!(
            plant.status == PlantStatus::Active,
            ErrorCode::PlantArchived
        );
        plant.status = PlantStatus::Archived;
        Ok(())
    }

    /// Cierra una planta **archivada** y devuelve el rent a la autoridad.
    pub fn close_plant(ctx: Context<ClosePlant>, plant_id: u64) -> Result<()> {
        let plant = &ctx.accounts.plant;
        require!(plant.plant_id == plant_id, ErrorCode::InvalidPlantId);
        require!(
            plant.status == PlantStatus::Archived,
            ErrorCode::PlantNotArchived
        );
        Ok(())
    }
}

/// Estado de una planta. Se serializa como 1 byte.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum PlantStatus {
    Active,
    Archived,
}

/// Jardín de una wallet. PDA: ["garden", authority, garden_id].
#[account]
#[derive(Debug)]
pub struct GardenAccount {
    pub authority: Pubkey,
    pub garden_id: u64,
    pub plant_count: u32,
    pub bump: u8,
}

impl GardenAccount {
    pub const SPACE: usize = 8 + 32 + 8 + 4 + 1; // 53
}

/// Planta perteneciente a un jardín. PDA: ["plant", garden, plant_id].
#[account]
#[derive(Debug)]
pub struct PlantAccount {
    pub garden: Pubkey,
    pub authority: Pubkey,
    pub plant_id: u64,
    pub name: String,
    pub species: String,
    pub watering_interval: u8,
    pub last_watered: i64,
    pub status: PlantStatus,
    pub bump: u8,
}

impl PlantAccount {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 4 + MAX_NAME_LEN + 4 + MAX_SPECIES_LEN + 1 + 8 + 1 + 1; // 163
}

#[derive(Accounts)]
#[instruction(garden_id: u64)]
pub struct InitializeGarden<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = GardenAccount::SPACE,
        seeds = [GARDEN_SEED, authority.key().as_ref(), &garden_id.to_le_bytes()],
        bump
    )]
    pub garden: Account<'info, GardenAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(plant_id: u64, name: String, species: String, watering_interval: u8)]
pub struct CreatePlant<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [GARDEN_SEED, authority.key().as_ref(), &garden.garden_id.to_le_bytes()],
        bump = garden.bump,
        constraint = garden.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub garden: Account<'info, GardenAccount>,

    #[account(
        init,
        payer = authority,
        space = PlantAccount::SPACE,
        seeds = [PLANT_SEED, garden.key().as_ref(), &plant_id.to_le_bytes()],
        bump
    )]
    pub plant: Account<'info, PlantAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(plant_id: u64)]
pub struct UpdatePlant<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [GARDEN_SEED, authority.key().as_ref(), &garden.garden_id.to_le_bytes()],
        bump = garden.bump,
        constraint = garden.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub garden: Account<'info, GardenAccount>,

    #[account(
        mut,
        seeds = [PLANT_SEED, garden.key().as_ref(), &plant_id.to_le_bytes()],
        bump = plant.bump,
        constraint = plant.garden == garden.key() @ ErrorCode::InvalidGarden,
        constraint = plant.authority == authority.key() @ ErrorCode::Unauthorized,
        constraint = plant.plant_id == plant_id @ ErrorCode::InvalidPlantId
    )]
    pub plant: Account<'info, PlantAccount>,
}

#[derive(Accounts)]
#[instruction(plant_id: u64)]
pub struct WaterPlant<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [GARDEN_SEED, authority.key().as_ref(), &garden.garden_id.to_le_bytes()],
        bump = garden.bump,
        constraint = garden.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub garden: Account<'info, GardenAccount>,

    #[account(
        mut,
        seeds = [PLANT_SEED, garden.key().as_ref(), &plant_id.to_le_bytes()],
        bump = plant.bump,
        constraint = plant.garden == garden.key() @ ErrorCode::InvalidGarden,
        constraint = plant.authority == authority.key() @ ErrorCode::Unauthorized,
        constraint = plant.plant_id == plant_id @ ErrorCode::InvalidPlantId
    )]
    pub plant: Account<'info, PlantAccount>,
}

#[derive(Accounts)]
#[instruction(plant_id: u64)]
pub struct ArchivePlant<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [GARDEN_SEED, authority.key().as_ref(), &garden.garden_id.to_le_bytes()],
        bump = garden.bump,
        constraint = garden.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub garden: Account<'info, GardenAccount>,

    #[account(
        mut,
        seeds = [PLANT_SEED, garden.key().as_ref(), &plant_id.to_le_bytes()],
        bump = plant.bump,
        constraint = plant.garden == garden.key() @ ErrorCode::InvalidGarden,
        constraint = plant.authority == authority.key() @ ErrorCode::Unauthorized,
        constraint = plant.plant_id == plant_id @ ErrorCode::InvalidPlantId
    )]
    pub plant: Account<'info, PlantAccount>,
}

#[derive(Accounts)]
#[instruction(plant_id: u64)]
pub struct ClosePlant<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [GARDEN_SEED, authority.key().as_ref(), &garden.garden_id.to_le_bytes()],
        bump = garden.bump,
        constraint = garden.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub garden: Account<'info, GardenAccount>,

    #[account(
        mut,
        seeds = [PLANT_SEED, garden.key().as_ref(), &plant_id.to_le_bytes()],
        bump = plant.bump,
        close = authority,
        constraint = plant.garden == garden.key() @ ErrorCode::InvalidGarden,
        constraint = plant.authority == authority.key() @ ErrorCode::Unauthorized,
        constraint = plant.plant_id == plant_id @ ErrorCode::InvalidPlantId
    )]
    pub plant: Account<'info, PlantAccount>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("La wallet firmante no es la propietaria de este recurso.")]
    Unauthorized,
    #[msg("La planta no pertenece al jardín indicado.")]
    InvalidGarden,
    #[msg("El identificador de planta no coincide con la PDA.")]
    InvalidPlantId,
    #[msg("El nombre no puede estar vacío.")]
    EmptyName,
    #[msg("La especie no puede estar vacía.")]
    EmptySpecies,
    #[msg("El nombre excede la longitud máxima permitida.")]
    NameTooLong,
    #[msg("La especie excede la longitud máxima permitida.")]
    SpeciesTooLong,
    #[msg("El intervalo de riego debe estar entre 1 y 255 días.")]
    InvalidWateringInterval,
    #[msg("La planta ya está archivada; no admite esta operación.")]
    PlantArchived,
    #[msg("La planta debe estar archivada antes de poder cerrarla.")]
    PlantNotArchived,
    #[msg("Aún no corresponde regar: no ha transcurrido el intervalo mínimo.")]
    WateringTooSoon,
    #[msg("Marca de tiempo inválida.")]
    InvalidTimestamp,
    #[msg("Desbordamiento aritmético.")]
    ArithmeticOverflow,
}
