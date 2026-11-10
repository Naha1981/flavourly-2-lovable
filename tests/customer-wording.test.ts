import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const source=(p:string)=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
describe('customer wording stays in Flavourly voice',()=>{
 it('uses outcome labels for the reply desk across entry points',()=>{
  for(const p of ['routes/dashboard.tsx','routes/dashboard.replies.tsx','routes/product.tsx']){
   expect(source(p)).not.toContain('AI desk');
   expect(source(p)).toMatch(/[Rr]eply desk/);
  }
 });
 it('keeps provider names out of visible voice status and help',()=>{
  const p=source('components/app/voice-operator.tsx');
  expect(p).not.toContain('Connecting to Gemini');
  expect(p).not.toContain('Gemini error');
  expect(p).not.toContain('Gemini Live uses');
  expect(p).toContain('Voice access expires after each session.');
 });
 it('reports setup gaps without implying an unconfigured capability works',()=>{
  const p=source('routes/dashboard.revenue-employee.tsx');
  expect(p).toContain('Setup needed');expect(p).not.toContain('adapter ready');
  expect(p).toContain('Connected capabilities');
  const labels=source('lib/intelligence/providers.server.ts').split('const labelMap:')[1]!.split('const modeMap:')[0]!;
  for(const vendor of ['OpenPost','BrightBean','Mixpost','Jev UltraFast','NahaLLM','Agent Reach'])expect(labels).not.toContain(vendor);
 });
});
