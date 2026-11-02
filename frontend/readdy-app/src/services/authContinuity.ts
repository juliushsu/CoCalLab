import {currentSession} from './navigationScope.ts';
interface SessionIdentity {access_token?:string;expires_at?:number;user?:{id?:string}}
function family(session:SessionIdentity|null):string|null {
  try {
    const payload=session?.access_token?.split('.')[1];if(!payload)return null;
    const claims=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
    return typeof claims.session_id==='string'&&claims.session_id.length>0?claims.session_id:null;
  }catch{return null;}
}
/** UI operation continuity, never JWT verification or authorization. Server RLS
 * and getUser remain authoritative. Explicit intent invalidates synchronously. */
export function createAuthContinuity<T extends SessionIdentity>() {
  let latest:T|null=null,epoch=0;
  return {
    accept(event:string,next:T|null):number {
      const valid=currentSession(next)?next:null;
      const sameUser=Boolean(latest&&valid&&latest.user?.id===valid.user?.id);
      const previousFamily=family(latest),nextFamily=family(valid);
      const sameFamily=previousFamily!==null&&previousFamily===nextFamily;
      const routine=event!=='EXPLICIT_SIGN_IN'&&event!=='SIGNED_OUT'&&sameUser&&
        (sameFamily||latest?.access_token===valid?.access_token||
          ((event==='TOKEN_REFRESHED'||event==='USER_UPDATED')&&previousFamily===null&&nextFamily===null));
      if(!routine&&(latest!==null||valid!==null||event==='SIGNED_OUT'))epoch++;
      latest=valid;return epoch;
    },
    invalidate(){latest=null;return ++epoch;},
    /** Resume only this failed explicit intent. A fresh epoch forces subscribers
     * to reload and never revives an operation captured before sign-in began. */
    restoreAfterFailedSignIn(expectedEpoch:number,retained:T|null):number|null {
      if(epoch!==expectedEpoch||latest!==null)return null;
      latest=currentSession(retained)?retained:null;
      return ++epoch;
    },
    isCurrent(expectedEpoch:number,userId:string,now=Date.now()) {return epoch===expectedEpoch&&latest?.user?.id===userId&&currentSession(latest,now);},
    latest(){return latest;},
  };
}
