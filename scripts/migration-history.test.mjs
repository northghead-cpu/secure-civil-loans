import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectHistory,checkRepository} from './migration-history.mjs';
test('short timestamps that break CLI ordering are rejected',()=>{assert.equal(inspectHistory(['20260815_old.sql']).errors.length,1);assert.equal(inspectHistory(['202610270001_old.sql']).errors.length,1);});
test('two files cannot share one migration version',()=>{assert.match(inspectHistory(['20260815130000_a.sql','20260815130000_b.sql']).errors[0],/Duplicate/);});
test('missing recorded versions cannot be hidden by another filename',()=>{assert.match(inspectHistory(['20260815130000_a.sql'],[{version:'20260815181032'}]).errors[0],/missing/);});
test('valid fixed-width filenames have chronological lexical ordering',()=>{const r=inspectHistory(['20260815181032_b.sql','20260815094140_a.sql']);assert.deepEqual(r.versions,['20260815094140','20260815181032']);assert.deepEqual(r.errors,[]);});
test('unrecorded SQL remains pending instead of being certified applied',()=>{const r=inspectHistory(['20260815094140_a.sql','20260815181032_b.sql'],[{version:'20260815094140'}]);assert.deepEqual(r.unrecorded,['20260815181032']);});
test('repository retains deployed versions and exact canonicalized SQL',async()=>{await checkRepository();});
