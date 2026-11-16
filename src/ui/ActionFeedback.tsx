import { useStore } from '../state/store';
export function ActionFeedback({ state, children, savedLabel }: { state:'draft'|'saved'|'success'|'error'; children:React.ReactNode; savedLabel?:string }) {
 const store=useStore();
 const memory=!!store.saveError && (state==='saved' || state==='success');
 return <div className={`action-feedback feedback-${memory?'error':state}`} role={state==='error'||memory?'alert':'status'}><strong>{state==='draft'?'Brouillon — pas encore appliqué':state==='error'?'Décision non appliquée':memory?'Appliqué en mémoire — sauvegarde échouée':state==='saved'?savedLabel??'Plan enregistré':'Décision confirmée'}</strong><div>{children}</div>{memory && <p>Exportez une copie avant de fermer le jeu, puis réessayez la sauvegarde depuis Menu.</p>}</div>;
}
