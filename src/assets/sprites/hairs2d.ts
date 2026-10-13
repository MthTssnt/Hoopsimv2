/**
 * Coiffures du rendu 2D (`heads2d.ts`), dessins originaux à la main, sur la technique validée par
 * Matheo : masses de mèches en 4 tons (r reflet, h clair, H base, D ombre), creux en E, reflet en
 * haut à gauche, silhouette irrégulière où les mèches dépassent ; contour coloré posé par
 * `figure2d`. Une vue de 3/4 face (down) et une de 3/4 dos (up) par coiffure, même volume.
 *
 * Repère du crâne : x vers le visage (le crâne occupe x 1-10, le visage x 5-10, l'oreille x 3-4
 * en rangées 5-7), y vers le bas (crâne 0-10). `at` = position (x, y) du premier caractère.
 * Sur le visage (x ≥ 5), la frange s'arrête à la rangée 2 : au moins une rangée de peau au-dessus
 * des sourcils. « . » laisse voir le crâne ; « 3 » et « 1 » posent la peau (côtés rasés, reflet).
 */
type Point = readonly [number, number];

interface HairView {
  at: Point;
  rows: readonly string[];
}

export interface Hair2D {
  name: string;
  down: HairView;
  up: HairView;
  /** Les cheveux tombent sur les oreilles (sinon les oreilles passent par-dessus). */
  coversEars?: boolean;
}

export const HAIRS_2D: readonly Hair2D[] = [
  {
    name: 'ebouriffe',
    down: {
      at: [-2, -2],
      rows: [
        '......hH.Hh....',
        '....DrhhHDrhH..',
        '...DrhHHDrhhHH.',
        '..DhHHDDhhHHDHD',
        '..DHHDHhHHDHDD.',
        '..DHHDH.....D..',
        '..DHHDH........',
        '..DHD..........',
        '..DHD..........',
        '...DD..........',
      ],
    },
    up: {
      at: [-2, -2],
      rows: [
        '......hH.Hh....',
        '....DrhhHDrhH..',
        '...DrhHHDrhhH..',
        '..DhHHDDhhHHD..',
        '..DHHDHhHHDHD..',
        '..DHHDHHHDHHD..',
        '..DDHHDHHHDD...',
        '..DHDHHHDDH....',
        '..DHHDDHDD.....',
        '...DHDDHDD.....',
        '....DDDD.......',
      ],
    },
  },
  {
    name: 'pics',
    down: {
      at: [-2, -4],
      rows: [
        '.....D..r..D...',
        '....Dh.Dh.Dh...',
        '....DhrDhhDhH..',
        '...DhrhDhhHhHD.',
        '..DrhhHDhhHHHD.',
        '..DhhHHDhHHHDD.',
        '..DHHDHHHDHD...',
        '..DHHD.........',
        '..DHDH.........',
        '..DD...........',
        '..DD...........',
      ],
    },
    up: {
      at: [-2, -4],
      rows: [
        '.....D..r..D...',
        '....Dh.Dh.Dh...',
        '....DhrDhhDhH..',
        '...DhrhDhhHhHD.',
        '..DrhhHDhhHHD..',
        '..DhhHHDhHHHD..',
        '..DHHDHHHDHD...',
        '..DHHDHHHHHD...',
        '..DHHDDHHDD....',
        '..DDHDDHD......',
        '...DDDDD.......',
      ],
    },
  },
  {
    name: 'chignon',
    down: {
      at: [-2, -4],
      rows: [
        '....DhhD.......',
        '...DrhhHD......',
        '...DhHHHD......',
        '....EEEDhhH....',
        '...DhrrhhhhHD..',
        '..DhhrhhhHHHD..',
        '..DHhhhHHHHDD..',
        '..DHHH.........',
        '..DHHH.........',
        '..DHD..........',
        '..DHD..........',
      ],
    },
    up: {
      at: [-2, -4],
      rows: [
        '....DhhD.......',
        '...DrhhHD......',
        '...DhHHHD......',
        '...DEEEDhh.....',
        '..DhrhhhhhHD...',
        '..DhrhhhHHHD...',
        '..DhhhHHHHHD...',
        '..DhhHHHDHHD...',
        '..DHHHHDHHD....',
        '..DHHHDHHD.....',
        '..DDHHDDD......',
        '...DDDD........',
      ],
    },
  },
  {
    name: 'queue',
    down: {
      at: [-3, -1],
      rows: [
        '.....DhhhhD.....',
        '....DrhhhhhHD...',
        '...DhrhhhHHHHD..',
        '...DHhhhHHHHDD..',
        '..EDHHH.........',
        '.DhDHHH.........',
        'DhHD.HD.........',
        'DhHD............',
        'DHHD............',
        '.DHD............',
        '.DD.............',
      ],
    },
    up: {
      at: [-3, -1],
      rows: [
        '.....DhhhhD.....',
        '....DrhhhhhHD...',
        '...DhrhhhhHHD...',
        '...DhhhhHHHHD...',
        '...DhhHHHHHHD...',
        '...DHHHHHHHD....',
        '....DHHEEHHD....',
        '.....DhhHHD.....',
        '.....DhHHD......',
        '.....DhHHD......',
        '......DHD.......',
        '......DD........',
      ],
    },
  },
  {
    name: 'mi-longs',
    coversEars: true,
    down: {
      at: [-2, -2],
      rows: [
        '.....DhhD......',
        '...DrhhHDhD....',
        '..DrhhHDhhHHD..',
        '.DhhHHDhhHHDHD.',
        '.DHhHDHHHDHDD..',
        '.DHHHDH.....D..',
        'DhHHDHH........',
        'DhHHDHH........',
        'DHHDHHD........',
        'DHDHHD.........',
        '.DDHD..........',
        '..DD...........',
      ],
    },
    up: {
      at: [-2, -2],
      rows: [
        '.....DhhD......',
        '...DrhhHDhD....',
        '..DrhhHDhhHHD..',
        '.DhhHHDhhHHHD..',
        '.DHhHDHHHDHHD..',
        '.DHHHDHHHDHHD..',
        'DhHHDHHHDHHD...',
        'DhHHDHHDHHHD...',
        'DHHDHHDHHDHD...',
        'DHDHHDHHDHD....',
        '.DDHDHDHDD.....',
        '..DDHDDD.......',
        '...DD..........',
      ],
    },
  },
  {
    name: 'longs',
    coversEars: true,
    down: {
      at: [-3, -2],
      rows: [
        '......DhhD......',
        '....DrhhHDhD....',
        '...DrhhHDhhHHD..',
        '..DhhHHDhhHHDHD.',
        '..DHhHDHHHDHDD..',
        '.DHHHDHH.....D..',
        '.DhHHDHH........',
        'DhHHDHHD........',
        'DhHDHHHD........',
        'DHHDHHD.........',
        'DHDHHD..........',
        'DHDHD...........',
        'DDHDD...........',
        '.DDD............',
      ],
    },
    up: {
      at: [-3, -2],
      rows: [
        '......DhhD......',
        '....DrhhHDhD....',
        '...DrhhHDhhHHD..',
        '..DhhHHDhhHHHD..',
        '..DHhHDHHHDHHD..',
        '.DHHHDHHHDHHHD..',
        '.DhHHDHHHDHHD...',
        'DhHHDHHDHHHDD...',
        'DhHDHHDHHDHHD...',
        'DHHDHHDHHDHD....',
        'DHDHHDHHDHHD....',
        'DHDHDHHDHDD.....',
        'DDHDHDDHDD......',
        '.DDDDDDD........',
      ],
    },
  },
  {
    name: 'afro',
    coversEars: true,
    down: {
      at: [-3, -4],
      rows: [
        '....DhD.DhD.....',
        '...DhrhDhrhhD...',
        '..DhrrhhDhhHhD..',
        '.DhrhhHDhhHDhHD.',
        'DhhHhDhhHHDhHHD.',
        'DhHHDhhHHDHhHHHD',
        'DHhDHHHDHHDHHDD.',
        'DhHDHHDH........',
        '.DHhDHD.........',
        'DhHDHD..........',
        '.DDHDD..........',
        '..DD............',
      ],
    },
    up: {
      at: [-3, -4],
      rows: [
        '....DhD.DhD.....',
        '...DhrhDhrhhD...',
        '..DhrrhhDhhHhD..',
        '.DhrhhHDhhHDhHD.',
        'DhhHhDhhHHDhHHD.',
        'DhHHDhhHHDHhHHHD',
        'DHhDHHHDHHDHHDHD',
        'DhHDHHDHHDHHDHD.',
        '.DHhDHDHHDHHDD..',
        'DhHDHDHHDHHD....',
        '.DDHDDHDHDD.....',
        '..DD.DDD........',
      ],
    },
  },
  {
    name: 'dreadlocks',
    coversEars: true,
    down: {
      at: [-3, -2],
      rows: [
        '......DhD.......',
        '....DhDrhDhD....',
        '...DrhDhhDhhD...',
        '..DhHDhHDhHDhD..',
        '..DHDHHDHDHDHD..',
        '.DhDhDH.........',
        '.DhDHDH.........',
        'DhDHDH..........',
        'DHDhDH..........',
        'DHDHD...........',
        'D.DHD...........',
        '..DD............',
      ],
    },
    up: {
      at: [-3, -2],
      rows: [
        '......DhD.......',
        '....DhDrhDhD....',
        '...DrhDhhDhhD...',
        '..DhHDhHDhHDhD..',
        '..DHDHHDHDHDHD..',
        '.DhDhDHDhDHDHD..',
        '.DhDHDHDHDhDD...',
        'DhDHDHDhDHDD....',
        'DHDhDHDHDHD.....',
        'DHDHDHDHDHD.....',
        'D.DHD.DHD.D.....',
        '..DD..DD........',
      ],
    },
  },
  {
    name: 'tresses',
    // Tresses plaquées : rangées de grains en relief (reflet, ombre), cuir chevelu entre les tresses.
    down: {
      at: [-2, -1],
      rows: [
        '....DDDDD......',
        '...DrHrHrHD....',
        '...HDHDHDHDHD..',
        '...333333333...',
        '...DrHD........',
        '...HDHD........',
        '...33..........',
        '...rHD.........',
        '...DD..........',
      ],
    },
    up: {
      at: [0, -1],
      rows: [
        '...DDDDD....',
        '..DrHDrHDD..',
        '.DrH3rH3rHD.',
        '.DHD3HD3HD3.',
        '.DrH3rH3rH3.',
        '.DHD3HD3HD3.',
        '.DrH3rH3rD..',
        '.DHD3HD3HD..',
        '.DrH3rH3rD..',
        '..DD3DD3DD..',
      ],
    },
  },
  {
    name: 'degrade',
    down: {
      at: [-2, -3],
      rows: [
        '......hhH......',
        '....DrhhhHH....',
        '...DrhhhHHHHD..',
        '...DhhHHHHDHD..',
        '...3DHHHDHHDD..',
        '...33DDDHHD....',
        '...333.........',
        '...333.........',
        '...33..........',
        '...3...........',
      ],
    },
    up: {
      at: [-2, -3],
      rows: [
        '......hhH......',
        '....DrhhhHH....',
        '...DrhhhHHHHD..',
        '...DhhHHHHDHD..',
        '...3DHHHDHHD3..',
        '...33DDDDDD33..',
        '...3333333333..',
        '...333333333...',
        '...333333333...',
        '....333333.....',
      ],
    },
  },
  {
    name: 'rase',
    down: {
      at: [0, 0],
      rows: ['...hhhH.....', '..hrhhhHH...', '.HhhHhHHDH..', '.HHDH.......', '.HDHD.......', '.HD.........', '.DH.........', '.D..........'],
    },
    up: {
      at: [0, 0],
      rows: ['...hhhH.....', '..hrhhhHH...', '.HhhHhHHDHH.', '.HHDHHHDHHH.', '.HDHHDHHHDH.', '.HHHDHHHD...', '.DHHHDHHD...', '.HDHHHDHD...', '..DDDDDD....'],
    },
  },
  {
    name: 'chauve',
    down: { at: [0, 0], rows: ['...11.......', '..1.........'] },
    up: { at: [0, 0], rows: ['...11.......', '..1.........'] },
  },
  {
    name: 'crete',
    down: {
      at: [-2, -4],
      rows: [
        '......D.D......',
        '.....DhDhD.....',
        '....DrhrhhD....',
        '...DrhhhHHD....',
        '...DhhHHHHD....',
        '...3DHHHDD33...',
        '...33DDD333....',
        '...33..........',
        '...33..........',
        '...3...........',
      ],
    },
    up: {
      at: [-2, -4],
      rows: [
        '......D.D......',
        '.....DhDhD.....',
        '....DrhrhhD....',
        '...DrhhhHHD....',
        '...3DhHHHD3....',
        '...33DHHD333...',
        '...333DHHD33...',
        '...3333DHD333..',
        '...3333DHD33...',
        '...33333DD3....',
        '....33333......',
      ],
    },
  },
];
