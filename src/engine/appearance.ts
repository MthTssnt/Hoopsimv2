import {hashSeed} from './rng';
/** Cosmetic data never participates in ratings, contracts, random draws or simulation decisions. */
export interface PlayerAppearance { version:1; skin:number; face:number; hair:number; hairColor:number; beard:number; headband:number; sleeve:number; shoes:number }
export const APPEARANCE_OPTIONS={skin:6,face:3,hair:5,hairColor:6,beard:3,headband:4,sleeve:3,shoes:4} as const;
export const SKIN_COLORS=['#f2c49b','#dba16a','#9c5c2e','#95592f','#744124','#4e2e20'];
export const HAIR_COLORS=['#251e1a','#473127','#88502f','#c77a39','#7a7471','#d3c7ae'];
export const APPEARANCE_PRESETS:PlayerAppearance[]=[
 {version:1,skin:2,face:0,hair:0,hairColor:0,beard:1,headband:1,sleeve:0,shoes:0},
 {version:1,skin:4,face:1,hair:1,hairColor:0,beard:0,headband:0,sleeve:0,shoes:0},
 {version:1,skin:0,face:2,hair:2,hairColor:3,beard:0,headband:0,sleeve:0,shoes:0},
 {version:1,skin:1,face:0,hair:3,hairColor:0,beard:1,headband:0,sleeve:0,shoes:0},
 {version:1,skin:3,face:1,hair:4,hairColor:0,beard:2,headband:0,sleeve:0,shoes:0},
];
export function normalizeAppearance(value:unknown,fallback:PlayerAppearance):PlayerAppearance {
 const input=value && typeof value==='object'?value as Record<string,unknown>:{};const next={...fallback,version:1 as const};
 for(const key of Object.keys(APPEARANCE_OPTIONS) as (keyof typeof APPEARANCE_OPTIONS)[]){const v=input[key];if(typeof v==='number' && Number.isInteger(v) && v>=0 && v<APPEARANCE_OPTIONS[key])next[key]=v;}
 // A band crosses braided hair behind the head; thin band only, preventing bulky overlaps.
 if(next.hair===4 && next.headband===3)next.headband=1;
 return next;
}
export function appearanceIdentity(player:{id:string;appearance?:PlayerAppearance}):PlayerAppearance {
 const seed=hashSeed(`${player.id}|clubhouse-v1`),base=APPEARANCE_PRESETS[seed%5];
 return normalizeAppearance(player.appearance,{...base,skin:((seed>>>3)%6),hairColor:base.hair===2?3:(seed>>>8)%3,face:(seed>>>12)%3,shoes:(seed>>>17)%4});
}
export const appearanceKey=(p:PlayerAppearance)=>Object.values(p).join('-');
