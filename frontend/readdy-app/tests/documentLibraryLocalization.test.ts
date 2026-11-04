import test from 'node:test';
import assert from 'node:assert/strict';
import {createInstance} from 'i18next';
import {cocal as zh} from '../src/i18n/local/zh/cocal.ts';
import {cocal as en} from '../src/i18n/local/en/cocal.ts';
import {cocal as ja} from '../src/i18n/local/ja/cocal.ts';
test('document library states and every allowed document type resolve in all supported locales',async()=>{
  const i18n=createInstance();
  await i18n.init({lng:'en',fallbackLng:false,resources:{zh:{translation:zh},en:{translation:en},ja:{translation:ja}}});
  const keys=['selectScope','selectScopeDescription','viewOriginal','downloadOriginal','loadingOriginal','unsupportedPreview','deleteUnconfirmed',...['scope','auth','read','context','missing','path','download','integrity'].map(k=>'errors.'+k)].map(k=>'documents.library.'+k);
  keys.push('common.table_actions');
  keys.push(...['receipt','invoice','bill','utility_bill','contract','report','other'].map(k=>'documents.types.'+k));
  for(const lng of ['zh','en','ja'])for(const key of keys){assert.ok(i18n.exists(key,{lng}),lng+': '+key);assert.notEqual(i18n.getFixedT(lng)(key),key);}
});
