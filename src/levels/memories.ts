export interface MemoryText {
  title: string;
  memory: string;
}

export const CHAPTER_MEMORIES: Readonly<Record<number, readonly [MemoryText, MemoryText, MemoryText]>> = {
  2: [
    { title: 'Memory I · The Gardener', memory: 'I planted the seed at dawn, and it flowered in a night I never saw.' },
    { title: 'Memory II · The Roots', memory: 'Roots do not choose a sky. They hold on to both.' },
    { title: 'Memory III · The Harvest', memory: 'What one world sows, the other reaps.' },
  ],
  3: [
    { title: 'Memory I · The Smith', memory: 'We forged the seam to hold. It held until we let go.' },
    { title: 'Memory II · The Ember', memory: 'A single coal kept both hearths warm through the longest dusk.' },
    { title: 'Memory III · The Ash', memory: 'Even ash remembers the shape of the fire.' },
  ],
  4: [
    { title: 'Memory I · The Shore', memory: 'The tide came in on one beach and went out on the other.' },
    { title: 'Memory II · The Glass', memory: 'Light froze mid-wave so that we could walk across it.' },
    { title: 'Memory III · The Lighthouse', memory: 'Its beam swept both seas, and no ship was ever lost.' },
  ],
  5: [
    { title: 'Memory I · The Clockmaker', memory: 'One gear turned forward, its twin turned back. Time stood still between them.' },
    { title: 'Memory II · The Pendulum', memory: 'It swung from Dawn to Eclipse and never chose a side.' },
    { title: 'Memory III · The Spring', memory: 'Wound tight, the old world waited for someone to let it go.' },
  ],
  6: [
    { title: 'Memory I · The Choir', memory: 'We sang in two halls at once, and the echoes made a single song.' },
    { title: 'Memory II · The Vigil', memory: 'Someone has to keep the candles lit on both sides.' },
    { title: 'Memory III · The Silence', memory: 'When the last voice faded, the stones kept singing.' },
  ],
  7: [
    { title: 'Memory I · The Stargazer', memory: 'I counted every star that fell. They all landed somewhere else.' },
    { title: 'Memory II · The Crater', memory: 'Where the sky struck the ground, the two worlds touched.' },
    { title: 'Memory III · The Wanderer', memory: 'I walked so far east that I arrived in the night.' },
  ],
  8: [
    { title: 'Memory I · The Twin Kings', memory: 'One crown, two heads. Neither would bow, so the throne split.' },
    { title: 'Memory II · The Court', memory: 'Every decree was signed twice, in light and in shadow.' },
    { title: 'Memory III · The Abdication', memory: 'The crown is hollow because we both let it go.' },
  ],
  9: [
    { title: 'Memory I · The Reflection', memory: 'I looked into the water and the water looked away.' },
    { title: 'Memory II · The Ferryman', memory: 'He rowed between the reflections and never got wet.' },
    { title: 'Memory III · The Mirror', memory: 'Break a mirror and you get two worlds. Mend it and you get one.' },
  ],
  10: [
    { title: 'Memory I · The Seam', memory: 'The seam was never a wound. It was a stitch, holding.' },
    { title: 'Memory II · The Echo', memory: 'I was the echo. I was the voice. I am both.' },
    { title: 'Memory III · The Merge', memory: 'Light and shadow were always one traveler, walking home.' },
  ],
};

export const SHARD_TITLE = 'Echo Shard';
