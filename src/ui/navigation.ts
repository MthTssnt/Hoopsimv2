export type MarketView = 'players' | 'trades' | 'contracts' | 'history';
export type ManagementDestination =
 | { area:'home'; view:'overview'|'preparation' }
 | { area:'team'; view:'roster'|'rotation'|'tactics'|'development'; playerId?:string }
 | { area:'market'; view:MarketView; playerId?:string; proposalId?:string; intent?:'extensions'|'free' }
 | { area:'season'; view:'schedule'|'standings'|'stats'|'playoffs'|'history'|'draft' };
export const destinationTab = (destination:ManagementDestination) => {
 if(destination.area==='market')return 'marche';
 const tabs={overview:'accueil',preparation:'preparation',roster:'effectif',rotation:'rotation',tactics:'tactiques',development:'developpement',schedule:'calendrier',standings:'classement',stats:'stats',playoffs:'playoffs',history:'ligue',draft:'draft'} as const;
 return tabs[destination.view];
};
export type MarketRequest = Extract<ManagementDestination,{area:'market'}> & { sequence:number };
