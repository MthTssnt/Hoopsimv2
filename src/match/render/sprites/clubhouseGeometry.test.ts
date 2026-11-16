import {describe,expect,it} from 'vitest';
import {clubhouseCell,clubhouseContact,clubhouseScale,CLUBHOUSE_MANIFEST,CLUBHOUSE_BALL_RADIUS} from './clubhouseGeometry';
import {MOTIONS,dribbleBallAt} from './motion';
import {FRAME} from './views';
import {createNewGame} from '../../../engine';
import {APPEARANCE_PRESETS} from '../../../engine/appearance';
import {BallControlRig} from '../../world/ballControl';
import {createPlayerBody} from '../../world/player';
describe('repères Clubhouse',()=>{
 it('couvre tous les gestes, gabarits et miroirs ; le miroir conserve la hauteur',()=>{
  for(const m of MOTIONS)for(let frame=0;frame<m.count;frame++)for(const heading of ['up','down'] as const)for(const height of [175,195,222])for(const heavy of [true,false]){
   expect(CLUBHOUSE_MANIFEST.frames[clubhouseCell(m.id,frame,heading)]).toBeDefined();
   const a=clubhouseContact(m.id,frame,heading,height,heavy),b=clubhouseContact(m.id,frame,heading,height,heavy,true);
   expect(a.x+b.x).toBeCloseTo(FRAME.width);expect(a.y).toBe(b.y);expect(a.y).toBeGreaterThan(5);expect(a.y).toBeLessThan(FRAME.groundY);
  }
  expect(clubhouseScale(195).height).toBe(35);expect(clubhouseScale(222,true).width).toBeLessThan(1.1);
 });
 it('montre poussée, phase libre, sol et reprise sans rupture à la couture du cycle',()=>{
  const a=Array.from({length:8},(_,i)=>clubhouseContact('dribbleIdle',i,'down',195,false)),floor=FRAME.groundY-CLUBHOUSE_BALL_RADIUS;
  expect(dribbleBallAt(1/8,a,floor)).toEqual(a[1]);expect(dribbleBallAt(6/8,a,floor)).toEqual(a[6]);expect(dribbleBallAt(.5,a,floor)?.y).toBe(floor);
  expect(dribbleBallAt(.999999,a,floor)!.y).toBeCloseTo(a[0].y,3);
  for(let i=0;i<720;i++){const p=dribbleBallAt(i/720,a,floor)!;expect(p.y).toBeLessThanOrEqual(floor);const q=dribbleBallAt((i+1)/720,a,floor)!;expect(Math.hypot(q.x-p.x,q.y-p.y)).toBeLessThan(1);}
 });
 it('ne change jamais les contacts physiques quand seuls la peau, le visage ou les accessoires changent',()=>{
  const p=Object.values(createNewGame('bos',2861).players)[0],rig=new BallControlRig();
  const bodies=APPEARANCE_PRESETS.map(appearance=>createPlayerBody({...p,appearance},{x:18,y:8,z:0},.4));
  for(const heading of ['down','up'] as const)for(const facing of ['right','left'] as const)for(const phase of [0,.125,.4,.5,.75,.99]){
   const state={kind:'anim' as const,name:'dribbleIdle' as const,heading,facing};const points=bodies.map(b=>rig.point(b,0,state,phase,2));expect(points.every(point=>JSON.stringify(point)===JSON.stringify(points[0]))).toBe(true);
  }
 });
});
