import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedClaims,validResult} from './policy.mjs';
const good={repository_id:'1197102403',repository_owner_id:'271791151',repository:'northghead-cpu/secure-civil-loans',ref:'refs/heads/main',workflow_ref:'northghead-cpu/secure-civil-loans/.github/workflows/payslip-forensics.yml@refs/heads/main',runner_environment:'github-hosted',event_name:'schedule'};
test('only the production Marketplace scanner is authorized',()=>{
 assert.ok(allowedClaims(good));
 for(const [k,v] of Object.entries({repository_id:'123',repository_owner_id:'123',repository:'attacker/fork',ref:'refs/pull/1/merge',workflow_ref:'other',runner_environment:'self-hosted',event_name:'pull_request_target'}))assert.equal(allowedClaims({...good,[k]:v}),false,k);
});
test('no approval verdict or clear result for incomplete coverage',()=>{
 const r={status:'no_indicators_detected',authenticity_verified:false,sha256:'a'.repeat(64),findings:[],textless_pages:[]};
 assert.ok(validResult(r));
 for(const update of [{authenticity_verified:true},{sha256:'wrong'},{textless_pages:[1]},{findings:[{code:'TEXT_OVERLAY'}]},{status:'approved'}])assert.equal(validResult({...r,...update}),false);
});
