import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ExtractedDraftReviewPage from '../../../src/pages/admin/documents/ExtractedDraftReviewPage';
import { organizationId, projectId, draftId } from './fixture';
import '../../../src/index.css';

// Only this explicit test entry uses synthetic auth/services. The real page,
// dialogs, router and draftReview contract helper are mounted unchanged.
await i18n.use(initReactI18next).init({lng:'en',fallbackLng:'en',resources:{en:{translation:{
  common:{confirm:'Confirm',cancel:'Cancel'},
  drafts:{confirm_button:'Confirm draft',reject_button:'Reject draft',batch_confirm:'Batch confirm',
    confirm_dialog:{title:'Confirm draft dialog',message:'Save canonical draft values?',batch_message:'Confirm selected drafts?'},
    reject_dialog:{title:'Reject draft dialog',message:'Reject this draft?'},
    confirm_success:'Saved confirmation',reject_success:'Saved rejection',batch_confirm_success:'Saved batch'},
}}}});
const documentQuery=new URLSearchParams(location.search).get('case')==='single-document'?`&document=${draftId}`:'';
createRoot(document.getElementById('root')!).render(<React.StrictMode><MemoryRouter initialEntries={[`/admin/documents/drafts?organization_id=${organizationId}&project_id=${projectId}${documentQuery}`]}><ExtractedDraftReviewPage /></MemoryRouter></React.StrictMode>);
