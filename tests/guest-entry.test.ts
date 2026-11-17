import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../scripts/guest-preview-17nov/worker.mjs',import.meta.url),'utf8');
describe('guest entry',()=>{
 it('uses a neutral address and keeps the old link usable',()=>{
  expect(source).toContain("Response.redirect(PUBLIC + '/try' + incoming.search, 302)");
  expect(source).toContain("incoming.pathname === '/try'");
  expect(source).toContain('href="/try"');
 });
 it('keeps honest sample boundaries and a working account route',()=>{
  expect(source).not.toContain('Account sign-in is currently unavailable');
  expect(source).toContain('Create an account');
  expect(source).toContain('SAMPLE ONLY');
  expect(source).toContain('No messages leave this page');
 });
});
