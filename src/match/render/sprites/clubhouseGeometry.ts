import manifest from '../../../assets/players/clubhouse/manifest.json';
import type {MotionId,Point} from './motion';
import {FRAME} from './views';
const seq=(start:number,count=4)=>Array.from({length:count},(_,i)=>start+i);
const front:Record<MotionId,number[]>={idle:seq(0),run:seq(8,8),dribble:seq(144,8),dribbleIdle:seq(128,8),jumpShot:seq(112),layup:seq(48),dunk:seq(52),block:seq(116),blockOff:seq(116),rebound:seq(80),tipoff:seq(84),pass:seq(64),lobPass:seq(112),catch:seq(68),freeThrow:seq(112),landing:[1,2,3,0],steal:[25,26,27,24],offBalance:[11,12,13,0]};
const back:Record<MotionId,number[]>={idle:seq(4),run:seq(16,8),dribble:seq(152,8),dribbleIdle:seq(136,8),jumpShot:seq(120),layup:seq(56),dunk:seq(60),block:seq(124),blockOff:seq(124),rebound:seq(88),tipoff:seq(92),pass:seq(72),lobPass:seq(120),catch:seq(76),freeThrow:seq(120),landing:[6,7,5,4],steal:[41,42,43,40],offBalance:[19,20,21,4]};
export const CLUBHOUSE_BALL_RADIUS=3.5;
export function clubhouseScale(heightCm:number,heavy=false){return {height:Math.max(31,Math.min(39,35+(heightCm-195)*.12)),width:heavy?1.04:1};}
export function clubhouseCell(id:MotionId,frame:number,heading:'up'|'down') {const list=(heading==='up'?back:front)[id];return list[Math.max(0,Math.min(list.length-1,frame))];}
export function clubhouseContact(id:MotionId,frame:number,heading:'up'|'down',heightCm:number,heavy:boolean,mirror=false):Point {
 const raw=manifest.frames[clubhouseCell(id,frame,heading)].palm,scale=clubhouseScale(heightCm,heavy),sy=scale.height/35,sx=sy*scale.width;
 const x=FRAME.centerX+(raw.x-FRAME.centerX)*sx,y=FRAME.groundY+(raw.y-FRAME.groundY)*sy;
 return {x:mirror?FRAME.width-x:x,y};
}
export const CLUBHOUSE_MANIFEST=manifest;
