import { prepareVideoEditor } from './prepare-video-editor.mjs'
import { build, loadEnv } from 'vite'
import { randomUUID } from 'node:crypto'
import { writeFile,readFile } from 'node:fs/promises'
import { discoveryFiles } from './site-discovery.mjs'
import { prerenderEntry } from './prerender-entry.mjs'
const loaded = loadEnv('independent', process.cwd(), 'VITE_')
const config = { ...loaded, ...process.env }
for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) {
  if (!config[name] || config[name].includes('PREENCHER')) throw new Error(`Configure ${name} em .env.independent.local antes de gerar a versão independente.`)
}
const url = new URL(config.VITE_SUPABASE_URL)
if (url.protocol !== 'https:') throw new Error('Use a URL HTTPS do seu projeto Supabase.')
if (!config.VITE_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) throw new Error('Use a chave pública sb_publishable_ do Supabase. Nunca use secret ou service_role no frontend.')
process.env.VITE_AUTH_PROVIDER = 'supabase'
process.env.VITE_SUPABASE_URL = config.VITE_SUPABASE_URL
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = config.VITE_SUPABASE_PUBLISHABLE_KEY
const version = { id: randomUUID(), created_at: new Date().toISOString() }
await prepareVideoEditor()
await build({ mode: 'independent', define: { __ITEXT_VERSION__: JSON.stringify(version.id) } })
const discovery=discoveryFiles(config)
const welcome=await prerenderEntry()
const index=await readFile('dist/index.html','utf8')
if(!index.includes('<!-- ITEXT_DISCOVERY -->')||!index.includes('<div id="root"></div>'))throw new Error('A página de entrada não pôde ser preparada para buscadores.')
await writeFile('dist/index.html',index.replace('<!-- ITEXT_DISCOVERY -->',()=>discovery.head).replace('<div id="root"></div>',()=>`<div id="root">${welcome}</div>`))
await Promise.all([writeFile('dist/robots.txt',discovery.robots),writeFile('dist/sitemap.xml',discovery.sitemap)])
await writeFile('dist/version.json', JSON.stringify(version))
console.log('Site estático pronto em dist/ para Firebase Hosting. Autenticação e dados usam Supabase.')
