import test from 'node:test';
import assert from 'node:assert/strict';
import {createInstance} from 'i18next';
import {cocal as zh} from '../src/i18n/local/zh/cocal.ts';
import {cocal as en} from '../src/i18n/local/en/cocal.ts';
import {cocal as ja} from '../src/i18n/local/ja/cocal.ts';
import {formatProjectEmissionTonnes} from '../src/services/projectStatistics.ts';

test('all supported locales resolve every new statistics state, boundary and explanation', async()=>{
  const i18n=createInstance();
  await i18n.init({lng:'en',fallbackLng:false,resources:{zh:{translation:zh},en:{translation:en},ja:{translation:ja}}});
  const keys=['loading','signIn','sessionExpired','readFailed','invalidScope','emptyTitle','emptyDescription','retry','boundary','boundaryTypes.operational_control','boundaryTypes.financial_control','boundaryTypes.equity_share','unknown','inclusionRate','scopeNote','counts','incompleteTotal','savedTotal','rateNote','reportStatus','reportAvailable','reportUnavailable'];
  for(const language of ['zh','en','ja']){
    const t=i18n.getFixedT(language);
    for(const suffix of keys){
      const key='projects.overview.statistics.'+suffix;
      assert.equal(i18n.exists(key,{lng:language}),true,language+': '+key);
      const value=t(key,{active:4,included:3,calculated:2,kg:'1.25',status:'TEST'});
      assert.ok(value.length>0);assert.notEqual(value,key);assert.doesNotMatch(value,/\{\{/);
    }
  }
});

test('locale changes resolve the current error/unknown label without a data reload or Chinese fallback',async()=>{
  const i18n=createInstance();
  await i18n.init({lng:'en',fallbackLng:false,resources:{zh:{translation:zh},en:{translation:en},ja:{translation:ja}}});
  const key='projects.overview.statistics.sessionExpired';
  const english=i18n.t(key);assert.match(english,/session/i);
  await i18n.changeLanguage('ja');const japanese=i18n.t(key);
  assert.notEqual(japanese,english);assert.match(japanese,/セッション/);
  assert.equal(formatProjectEmissionTonnes(null,i18n.language,i18n.t('projects.overview.statistics.unknown')),i18n.t('projects.overview.statistics.unknown'));
});

test('localized numeric display keeps unknown, true zero, normal and very small positive tonnes distinct',()=>{
  for(const language of ['zh','en','ja']){
    assert.equal(formatProjectEmissionTonnes(null,language,'UNKNOWN_TEST'),'UNKNOWN_TEST');
    assert.equal(formatProjectEmissionTonnes(0,language,'UNKNOWN_TEST'),'0');
    assert.equal(formatProjectEmissionTonnes(1234.5,language),new Intl.NumberFormat(language,{maximumFractionDigits:6}).format(1234.5));
    assert.equal(Number(formatProjectEmissionTonnes(1e-12,language)),1e-12);
  }
});
