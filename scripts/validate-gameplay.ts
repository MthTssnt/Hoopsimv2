import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createNewGame, TEAM_SEEDS } from '../src/engine/index.ts';
import { matchRotation } from '../src/engine/rotation.ts';
import { hashSeed, Rng } from '../src/engine/rng.ts';
import { contrastingTeam } from '../src/match/render/arena/draw.ts';
import { MatchWorld, WORLD_DT } from '../src/match/world/MatchWorld.ts';
import { PlayerAi } from '../src/match/ai/playerAi.ts';
import { makeCourt } from '../src/match/physics/court.ts';
const args = process.argv.slice(2);
const seeds = (args.find((s) => s.startsWith('--seeds='))?.slice(8) ?? '8126,31,919').split(',').map(Number);
assert(seeds.every(Number.isFinite), 'Invalid seeds');
const output = resolve(args.find((s) => s.startsWith('--output='))?.slice(9) ?? 'docs/validation/gameplay-after.json');
const results=[];
for(const seed of seeds){
 const league=createNewGame('bos',seed), all=Object.values(league.players);
 const guard=all.filter(p=>p.pos==='PG'&&p.teamId).sort((a,b)=>b.overall-a.overall)[0];
 const home=TEAM_SEEDS.find(t=>t.id===guard.teamId)!,away=contrastingTeam(home,TEAM_SEEDS,7);
 const roster=(id:string)=>matchRotation(league.teams.find(t=>t.id===id)!,league.players);
 const world=new MatchWorld(makeCourt('pro'),roster(home.id)[0],{x:0,y:0,z:0},{mode:'timing',speed:'normal'},new Rng(seed));
 world.startFullCourt(roster(home.id),roster(away.id),3);world.autoRestart=false;
 const ais=world.players.map((_,i)=>new PlayerAi(i,new Rng(hashSeed(`ia-${seed}-${i}`))));
 const r:any={seed,shots:[],passes:0,possessions:0,emptyReboundJumps:0,actualJumps:{},rebounds:{air:0,ground:0},collisions:{calls:0,corrections:0,airCorrections:0,maxAirZ:0,stationaryCorrections:0,maxCorrection:0},targetChanges:0,bigTargetChanges:0,teleports:[],events:{},possessionPasses:[],takeoverDelays:[]};
 const oldSeparate=(world as any).separateBodies.bind(world);
 (world as any).separateBodies=()=>{
  const pre=world.players.map(p=>({...p.pos}));oldSeparate();
  if(world.full?.phase!=='jeu')return;
  let changed=false;
  world.players.forEach((body,i)=>{const shift=Math.hypot(body.pos.x-pre[i].x,body.pos.y-pre[i].y);if(shift<.002)return;changed=true;r.collisions.corrections++;r.collisions.maxCorrection=Math.max(r.collisions.maxCorrection,shift);if(body.airborne){r.collisions.airCorrections++;r.collisions.maxAirZ=Math.max(r.collisions.maxAirZ,body.pos.z)}if(Math.hypot(body.vel.x,body.vel.y)<.1)r.collisions.stationaryCorrections++});if(changed)r.collisions.calls++;
 };
 let seenShot:any=null,seenPass:any=null,seenPoss:any=null,eventId=0,passCount=0;
 const oldGained=world.box!.gained.bind(world.box);
 world.box!.gained=(team,member)=>{const before=member.line.oreb+member.line.dreb;oldGained(team,member);if(member.line.oreb+member.line.dreb>before)r.rebounds[(member.body!==null&&world.players[member.body].airborne)?'air':'ground']++;};
 r.sameBallTargetChanges=0;r.targetExamples=[];r.blockedByOtherDunk=0;let previousHolder=world.holder,previousPass=world.pass;
 for(let k=0;k<240000&&!world.matchOver;k++){
  const beforePhase=world.full!.phase,beforePeriod=world.full!.period,pre=world.players.map(p=>({...p.pos})),air=world.players.map(p=>p.airborne),oldHolder=world.holder;
  const previousTargets=ais.map(ai=>({mode:ai.mode,target:ai.target?{...ai.target}:null}));
  const inputs=ais.map(ai=>ai.think(world,WORLD_DT));
  if(beforePhase==='jeu')ais.forEach((ai,i)=>{const old=previousTargets[i];if(ai.mode==='écartement'&&old.mode===ai.mode&&old.target&&ai.target){const d=Math.hypot(ai.target.x-old.target.x,ai.target.y-old.target.y);if(d>1)r.targetChanges++;if(d>3){r.bigTargetChanges++;if(previousHolder===world.holder&&previousPass===world.pass){r.sameBallTargetChanges++;if(r.targetExamples.length<5)r.targetExamples.push({at:world.clock,body:i,from:old.target,to:ai.target,ball:world.ball.pos});}}}});
  previousHolder=world.holder;previousPass=world.pass;
  world.step(WORLD_DT,inputs);
  if(world.holder!==null&&world.shot&&world.shot.shooter!==world.holder)r.blockedByOtherDunk++;
  for(let i=0;i<air.length;i++)if(!air[i]&&world.players[i].airborne){const kind=beforePhase==='entre-deux'?'tip':world.shot?.shooter===i?'shot':oldHolder===null?'loose-ball':'contest';r.actualJumps[kind]=(r.actualJumps[kind]??0)+1;}
  if(world.lastShot&&world.lastShot!==seenShot){seenShot=world.lastShot;r.shots.push({kind:seenShot.kind,zone:seenShot.zone,distance:seenShot.distance,probability:seenShot.probability,forced:seenShot.forced,contest:seenShot.contest,at:world.clock});}
  if(world.pass&&world.pass!==seenPass){seenPass=world.pass;r.passes++;passCount++;}
  if(world.possession!==seenPoss&&world.possession){if(seenPoss)r.possessionPasses.push(passCount);passCount=0;r.possessions++;seenPoss=world.possession;}
  for(const e of world.events)if(e.id>eventId){r.events[e.kind]=(r.events[e.kind]??0)+1;eventId=e.id;}
  const biggest=Math.max(...world.players.map((p,i)=>Math.hypot(p.pos.x-pre[i].x,p.pos.y-pre[i].y)));
  if(biggest>1)r.teleports.push({at:world.clock,from:beforePhase,to:world.full!.phase,period:beforePeriod,meters:biggest});
 }
 r.clock=world.clock;r.score=world.points;r.over=world.matchOver;r.lineups=world.lineupVersion;
 r.trajectoryFallbacks = world.trajectoryFallbacks.length;
 r.boxPoints = world.squads!.map(s=>s.members.reduce((n,m)=>n+m.line.pts,0));
 assert(world.matchOver, `seed ${seed}: did not finish`);
 assert.deepEqual(world.points,r.boxPoints,`seed ${seed}: score/box mismatch`);
 assert(r.blockedByOtherDunk===0,`seed ${seed}: a former action still owns the new ball holder`);
 assert(world.players.every(p=>[...Object.values(p.pos),...Object.values(p.vel)].every(Number.isFinite)),`seed ${seed}: nonfinite physics`);
 r.box=world.squads!.map(s=>s.members.reduce((a:any,m)=>{for(const k of ['pts','fga','fgm','tpa','tpm','fta','ftm','pf','oreb','dreb','ast','tov'])a[k]=(a[k]??0)+(m.line as any)[k];return a},{}));
 results.push(r);console.log(JSON.stringify({seed,clock:r.clock,score:r.score,jumps:r.actualJumps,passes:r.passes,possessions:r.possessions,collisions:r.collisions,targetChanges:r.targetChanges,bigTargetChanges:r.bigTargetChanges,teleports:r.teleports.length,events:r.events,rebounds:r.rebounds,sameBallTargetChanges:r.sameBallTargetChanges,blockedByOtherDunk:r.blockedByOtherDunk,box:r.box}));
}
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(results,null,2));
