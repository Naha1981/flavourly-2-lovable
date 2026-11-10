import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/routes/index.tsx',import.meta.url),'utf8');
describe('short home review',()=>{
 it('keeps the primary action and honest example label',()=>{
  expect(source).toContain('See what Flavourly finds');
  expect(source).toContain('Illustrative demo');
  expect(source).toContain('The restaurant still needs to confirm it.');
 });
 it('does not hide product messages behind delayed entrances',()=>{
  const bubble=source.slice(source.indexOf('function Bubble'),source.indexOf('function RevenueLeakSection'));
  expect(bubble).not.toContain('stage-in');
 });
 it('opens with one short supporting sentence',()=>{
  const hero=source.slice(source.indexOf('function Hero()'),source.indexOf('function HeroExperience'));
  expect(hero).toContain('Flavourly helps your team turn opportunities into bookings and repeat business.');
  expect(hero).not.toContain('Not another dashboard.');
  expect(hero).not.toContain('Start free trial');
 });
});
