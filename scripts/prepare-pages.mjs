import {copyFile,rename,writeFile} from 'node:fs/promises';
const dir=new URL('../dist/_worker.js/',import.meta.url);
await rename(new URL('index.js',dir),new URL('nitro-entry.js',dir));
await copyFile(new URL('./pages-proxy-runtime.mjs',import.meta.url),new URL('pages-proxy-runtime.mjs',dir));
await writeFile(new URL('index.js',dir),`import app from './nitro-entry.js';\nimport {createPagesProxy} from './pages-proxy-runtime.mjs';\nexport default createPagesProxy(app);\n`);
