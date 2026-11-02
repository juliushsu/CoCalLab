import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {AuthProvider} from '../../../src/contexts/AuthProvider';
import {useAuth} from '../../../src/hooks/useAuth';
import {currentSession} from '../../../src/services/navigationScope';
import DocumentUploadPage from '../../../src/pages/admin/documents/DocumentUploadPage';
import {cocal as en} from '../../../src/i18n/local/en/cocal';
import {organizationId,projectId} from './fixture';
import '../../../src/index.css';
await i18n.use(initReactI18next).init({lng:'en',fallbackLng:false,resources:{en:{translation:en}}});
function Probe(){
  const auth=useAuth(),[message,setMessage]=useState(''),[,tick]=useState(0);
  useEffect(()=>{const timer=setInterval(()=>tick(value=>value+1),500);return()=>clearInterval(timer);},[]);
  const login=async(password:string)=>{try{await auth.signIn('synthetic@example.invalid',password);setMessage('synthetic login succeeded');}catch{setMessage('synthetic login rejected');}};
  return <section><p role="status">AuthProvider session={auth.session?'present':'none'}; current={String(currentSession(auth.session))}; operation current={String(Boolean(auth.session&&auth.isAuthenticationCurrent(auth.authEpoch,auth.session.user.id)))}; epoch={auth.authEpoch}; {message}</p><button onClick={()=>void login('synthetic-wrong')}>Fail explicit synthetic sign-in</button><button onClick={()=>void login('synthetic-short')}>Start short-lived synthetic session (12 seconds)</button><button onClick={()=>void auth.signOut().catch(()=>setMessage('synthetic sign-out uncertain'))}>Sign out synthetic session</button></section>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthProvider><Probe/>{new URLSearchParams(location.search).get('case')!=='expiry'&&<MemoryRouter initialEntries={[`/admin/documents/upload?organization_id=${organizationId}&project_id=${projectId}`]}><DocumentUploadPage/></MemoryRouter>}</AuthProvider></React.StrictMode>);
