import {afterEach,describe,expect,it,vi} from 'vitest';
import {APPEARANCE_OPTIONS,APPEARANCE_PRESETS,appearanceIdentity,appearanceKey,normalizeAppearance} from './appearance';
import {createNewGame,migrateLeague,simulateDay,startNextSeason} from './index';
import {evaluateTrade,executeTrade} from './management/transactions';
import {appearanceFor} from '../match/render/sprites/appearance';
import {store} from '../state/store';
afterEach(()=>{store.league=null;store.liveMatch=null;store.busy=false;store.saveError=null;vi.unstubAllGlobals();});
describe('identités Clubhouse, séparées de la simulation',()=>{
 it('diversifie les anciennes sauvegardes sans mutation ni dépendance à l’équipe, au numéro ou aux notes',()=>{
  const l=createNewGame('bos',2861),before=JSON.stringify(l),p=Object.values(l.players)[0];
  const identities=Object.values(l.players).map(appearanceIdentity);
  expect(new Set(identities.map(appearanceKey)).size).toBeGreaterThan(100);
  expect(JSON.stringify(l)).toBe(before);
  const transferred={...p,teamId:'nyk',number:90,overall:99};expect(appearanceIdentity(transferred)).toEqual(appearanceIdentity(p));
  const reloaded=migrateLeague(JSON.parse(before));expect(appearanceIdentity(reloaded.players[p.id])).toEqual(appearanceIdentity(p));
 });
 it('valide les champs et adapte les superpositions de bandeau et tresses',()=>{
  const base=APPEARANCE_PRESETS[0],p=normalizeAppearance({skin:NaN,hair:-1,shoes:99,beard:'2'},base);
  expect(p).toEqual(base);expect(normalizeAppearance({...base,hair:4,headband:3},base).headband).toBe(1);
  expect(Object.values(APPEARANCE_OPTIONS).reduce((a,b)=>a*b,1)).toBeGreaterThan(10000);
 });
 it('produit exactement les mêmes journées simulées et tirages aléatoires avec une apparence personnalisée',()=>{
  const a=createNewGame('bos',31),b=structuredClone(a);
  Object.values(b.players).forEach((p,i)=>p.appearance={...APPEARANCE_PRESETS[i%5]});
  for(let day=0;day<4;day++){simulateDay(a);simulateDay(b);}
  Object.values(b.players).forEach(p=>delete p.appearance);expect(b).toEqual(a);
 });
 it('conserve l’identité après un vrai échange, un rechargement et un changement de saison ; change la tenue',()=>{
  const l=createNewGame('bos',31),team=l.teams.find(t=>t.id==='bos')!;
  let done=false;
  for(const other of l.teams.filter(t=>t.id!=='bos')){for(const give of team.roster){for(const take of other.roster){
   const offer={fromTeamId:team.id,toTeamId:other.id,outgoingIds:[give],incomingIds:[take]};if(!evaluateTrade(l,offer).accepted)continue;
   const player=l.players[give];player.appearance={...APPEARANCE_PRESETS[0]};const identity=appearanceIdentity(player),colors=appearanceFor(player).colors;
   expect(executeTrade(l,offer)).toEqual([]);expect(appearanceIdentity(player)).toEqual(identity);expect(appearanceFor(player).colors).not.toEqual(colors);
   const loaded=migrateLeague(JSON.parse(JSON.stringify(l)));expect(appearanceIdentity(loaded.players[give])).toEqual(identity);
   loaded.players[give].age=25;loaded.players[give].contract.years=4;loaded.phase='offseason';startNextSeason(loaded);
   expect(appearanceIdentity(loaded.players[give])).toEqual(identity);done=true;break;
  }if(done)break;}if(done)break;}
  expect(done).toBe(true);
 });
 it('enregistre uniquement les cosmétiques et conserve le brouillon si le stockage refuse',()=>{
  const data=new Map<string,string>();vi.stubGlobal('localStorage',{setItem:(k:string,v:string)=>data.set(k,v)});store.newClubhouseDemo();
  const l=store.league!,t=l.teams.find(t=>t.id==='bos')!,id=t.gamePlan!.rotation.starterIds[0],before=structuredClone(l.players[id]),rng=l.rngState;
  expect(before.number).toBe(45);expect(store.setAppearance(id,{...APPEARANCE_PRESETS[2]})).toEqual([]);
  const {appearance,...sports}=l.players[id];expect(appearance).toEqual(APPEARANCE_PRESETS[2]);const {appearance:_old,...oldSports}=before;expect(sports).toEqual(oldSports);expect(l.rngState).toBe(rng);
  const saved=data.get('hoopsim.save.v1');vi.stubGlobal('localStorage',{setItem:()=>{throw Error('quota');}});
  expect(store.setAppearance(id,{...APPEARANCE_PRESETS[4]}).join()).toContain('non enregistrée');expect(l.players[id].appearance).toEqual(APPEARANCE_PRESETS[2]);expect(data.get('hoopsim.save.v1')).toBe(saved);
 });
});
