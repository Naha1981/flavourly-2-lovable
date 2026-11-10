import {readFileSync} from 'node:fs';import {describe,it,expect} from 'vitest';
const source=(p:string)=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
describe('light readability and primary touch targets',()=>{
 it('keeps the rendered-audited muted token and shared button targets',()=>{expect(source('styles.css')).toContain('oklch(0.48 0.022 80)');const s=source('components/ui/button.tsx');expect(s).toContain('min-h-11');expect(s).toContain('h-11 w-11');});
 it('gives mobile header/menu and expanded links 44px target floors',()=>{const s=source('components/site/site-header.tsx');expect(s).toContain('h-11 w-11');expect(s).toContain('flex min-h-11 min-w-0 items-center');expect(s).toContain('flex min-h-11 items-center rounded-xl');});
});
