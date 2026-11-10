import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
// Deployment adapter has no application secrets or user-supplied backend URL.
// @ts-expect-error Plain deployment module used by the generated worker.
import {createPagesProxy} from '../scripts/pages-proxy-runtime.mjs';
describe('free Pages hosting adapter',()=>{
 it('serves HTML in Pages, not Lovable',async()=>{const local={fetch:vi.fn(()=>new Response('local UI'))};const upstream=vi.fn();const r=await createPagesProxy(local,upstream).fetch(new Request('https://test.pages.dev/signup'),{},{});expect(await r.text()).toBe('local UI');expect(upstream).not.toHaveBeenCalled();});
 it('forwards an authenticated call only to the fixed existing backend',async()=>{let seen:Request|undefined;const proxy=createPagesProxy({fetch:vi.fn()},async(r:Request)=>{seen=r;return new Response('ok',{headers:{'set-cookie':'hidden=1'}})});const r=await proxy.fetch(new Request('https://test.pages.dev/_serverFn/abc?x=1',{method:'POST',body:'{}',headers:{authorization:'Bearer synthetic',origin:'https://test.pages.dev',cookie:'private=1'}}),{},{});expect(seen!.url).toBe('https://flavourly-2-lovable.lovable.app/_serverFn/abc?x=1');expect(seen!.headers.get('authorization')).toBe('Bearer synthetic');expect(seen!.headers.has('cookie')).toBe(false);expect(seen!.headers.get('origin')).toBe('https://flavourly-2-lovable.lovable.app');expect(r.headers.has('set-cookie')).toBe(false);expect(r.headers.get('cache-control')).toBe('no-store');});
 it('rejects foreign-origin function writes before forwarding',async()=>{const upstream=vi.fn();const r=await createPagesProxy({fetch:vi.fn()},upstream).fetch(new Request('https://test.pages.dev/_serverFn/abc',{method:'POST',headers:{origin:'https://other.invalid'}}),{},{});expect(r.status).toBe(403);expect(upstream).not.toHaveBeenCalled();});
 it('cannot become an open proxy via a query parameter',async()=>{let target='';const proxy=createPagesProxy({fetch:vi.fn()},async(r:Request)=>{target=r.url;return new Response('ok')});await proxy.fetch(new Request('https://test.pages.dev/api/health?url=https://attacker.invalid'),{},{});expect(new URL(target).origin).toBe('https://flavourly-2-lovable.lovable.app');});
});

describe('public menu on a separate UI host',()=>{
 it('loads data client-side through the protected backend gateway',()=>{const source=readFileSync(new URL('../src/routes/m.$slug.tsx',import.meta.url),'utf8');expect(source).toContain('ssr: false');});
 it('describes the actual sold-out state without promising disappearance',()=>{const source=readFileSync(new URL('../src/routes/dashboard.menu.tsx',import.meta.url),'utf8');expect(source).toContain('guests see it as unavailable');expect(source).not.toContain('disappears from your public menu');});
});

describe('menu removal confirmation',()=>{it('uses an accessible confirmation with cancel and failure state',()=>{const source=readFileSync(new URL('../src/routes/dashboard.menu.tsx',import.meta.url),'utf8');expect(source).toContain('<AlertDialog open={confirmDelete}');expect(source).toContain('Keep dish');expect(source).toContain("Couldn't remove the dish.");expect(source).not.toContain('if (confirm(');});});
