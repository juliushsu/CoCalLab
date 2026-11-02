import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {cocal as en} from '../../../src/i18n/local/en/cocal';
import {cocal as zh} from '../../../src/i18n/local/zh/cocal';
import {cocal as ja} from '../../../src/i18n/local/ja/cocal';
import DocumentUploadPage from '../../../src/pages/admin/documents/DocumentUploadPage';
import {organizationId,projectId,secondProjectId,releasePendingUpload} from './fixture';
import '../../../src/index.css';
await i18n.use(initReactI18next).init({lng:new URLSearchParams(location.search).get('lang')||'en',fallbackLng:false,resources:{en:{translation:en},zh:{translation:zh},ja:{translation:ja}}});
function ProjectSwitchFixture(){const navigate=useNavigate();return new URLSearchParams(location.search).get('case')==='project-switch-mid-upload'?<button onClick={()=>{navigate(`/admin/documents/upload?organization_id=${organizationId}&project_id=${secondProjectId}`);releasePendingUpload();}}>Switch project route and release delayed synthetic upload</button>:null;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><MemoryRouter initialEntries={[`/admin/documents/upload?organization_id=${organizationId}&project_id=${projectId}`]}><ProjectSwitchFixture/><DocumentUploadPage /></MemoryRouter></React.StrictMode>);
