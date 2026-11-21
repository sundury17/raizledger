/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/raizledger.json`.
 */
export type Raizledger = {
  "address": "CDCv1frTdbCEvQR99XXccVkjMKqdDRgaQLPmVpimSjkp",
  "metadata": {
    "name": "raizledger",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "RaízLedger: registro on-chain del cuidado de plantas en Solana"
  },
  "instructions": [
    {
      "name": "archivePlant",
      "docs": [
        "Archiva una planta activa. Las plantas archivadas no pueden volver a",
        "archivarse ni recibir otras operaciones (salvo cerrarlas)."
      ],
      "discriminator": [
        235,
        175,
        226,
        234,
        104,
        38,
        107,
        73
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "garden",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  114,
                  100,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "garden.garden_id",
                "account": "gardenAccount"
              }
            ]
          }
        },
        {
          "name": "plant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "garden"
              },
              {
                "kind": "arg",
                "path": "plantId"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "plantId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "closePlant",
      "docs": [
        "Cierra una planta **archivada** y devuelve el rent a la autoridad."
      ],
      "discriminator": [
        108,
        107,
        159,
        204,
        204,
        132,
        31,
        136
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "garden",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  114,
                  100,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "garden.garden_id",
                "account": "gardenAccount"
              }
            ]
          }
        },
        {
          "name": "plant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "garden"
              },
              {
                "kind": "arg",
                "path": "plantId"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "plantId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createPlant",
      "docs": [
        "Registra una planta nueva dentro del jardín. `plant_id` debe ser",
        "exactamente el contador actual del jardín para mantener la secuencia."
      ],
      "discriminator": [
        54,
        36,
        254,
        203,
        1,
        141,
        112,
        190
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "garden",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  114,
                  100,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "garden.garden_id",
                "account": "gardenAccount"
              }
            ]
          }
        },
        {
          "name": "plant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "garden"
              },
              {
                "kind": "arg",
                "path": "plantId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "plantId",
          "type": "u64"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "species",
          "type": "string"
        },
        {
          "name": "wateringInterval",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeGarden",
      "docs": [
        "Crea el jardín de la wallet. La PDA impide inicializaciones duplicadas",
        "para la misma (authority, garden_id)."
      ],
      "discriminator": [
        23,
        148,
        216,
        67,
        46,
        4,
        251,
        207
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "garden",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  114,
                  100,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "arg",
                "path": "gardenId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gardenId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updatePlant",
      "docs": [
        "Modifica los datos editables de una planta activa."
      ],
      "discriminator": [
        25,
        219,
        193,
        236,
        125,
        82,
        216,
        158
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "garden",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  114,
                  100,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "garden.garden_id",
                "account": "gardenAccount"
              }
            ]
          }
        },
        {
          "name": "plant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "garden"
              },
              {
                "kind": "arg",
                "path": "plantId"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "plantId",
          "type": "u64"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "species",
          "type": "string"
        },
        {
          "name": "wateringInterval",
          "type": "u8"
        }
      ]
    },
    {
      "name": "waterPlant",
      "docs": [
        "Registra un riego. Aporte funcional: solo se permite si ya transcurrió",
        "el intervalo mínimo configurado desde el último riego."
      ],
      "discriminator": [
        18,
        60,
        106,
        105,
        240,
        199,
        162,
        11
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "garden",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  114,
                  100,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "account",
                "path": "garden.garden_id",
                "account": "gardenAccount"
              }
            ]
          }
        },
        {
          "name": "plant",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "garden"
              },
              {
                "kind": "arg",
                "path": "plantId"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "plantId",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "gardenAccount",
      "discriminator": [
        2,
        120,
        180,
        178,
        149,
        145,
        126,
        226
      ]
    },
    {
      "name": "plantAccount",
      "discriminator": [
        68,
        220,
        32,
        100,
        167,
        46,
        85,
        41
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "La wallet firmante no es la propietaria de este recurso."
    },
    {
      "code": 6001,
      "name": "invalidGarden",
      "msg": "La planta no pertenece al jardín indicado."
    },
    {
      "code": 6002,
      "name": "invalidPlantId",
      "msg": "El identificador de planta no coincide con la PDA."
    },
    {
      "code": 6003,
      "name": "emptyName",
      "msg": "El nombre no puede estar vacío."
    },
    {
      "code": 6004,
      "name": "emptySpecies",
      "msg": "La especie no puede estar vacía."
    },
    {
      "code": 6005,
      "name": "nameTooLong",
      "msg": "El nombre excede la longitud máxima permitida."
    },
    {
      "code": 6006,
      "name": "speciesTooLong",
      "msg": "La especie excede la longitud máxima permitida."
    },
    {
      "code": 6007,
      "name": "invalidWateringInterval",
      "msg": "El intervalo de riego debe estar entre 1 y 255 días."
    },
    {
      "code": 6008,
      "name": "plantArchived",
      "msg": "La planta ya está archivada; no admite esta operación."
    },
    {
      "code": 6009,
      "name": "plantNotArchived",
      "msg": "La planta debe estar archivada antes de poder cerrarla."
    },
    {
      "code": 6010,
      "name": "wateringTooSoon",
      "msg": "Aún no corresponde regar: no ha transcurrido el intervalo mínimo."
    },
    {
      "code": 6011,
      "name": "invalidTimestamp",
      "msg": "Marca de tiempo inválida."
    },
    {
      "code": 6012,
      "name": "arithmeticOverflow",
      "msg": "Desbordamiento aritmético."
    }
  ],
  "types": [
    {
      "name": "gardenAccount",
      "docs": [
        "Jardín de una wallet. PDA: [\"garden\", authority, garden_id]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "gardenId",
            "type": "u64"
          },
          {
            "name": "plantCount",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "plantAccount",
      "docs": [
        "Planta perteneciente a un jardín. PDA: [\"plant\", garden, plant_id]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "garden",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "plantId",
            "type": "u64"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "species",
            "type": "string"
          },
          {
            "name": "wateringInterval",
            "type": "u8"
          },
          {
            "name": "lastWatered",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "plantStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "plantStatus",
      "docs": [
        "Estado de una planta. Se serializa como 1 byte."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "archived"
          }
        ]
      }
    }
  ]
};
