export const SITE_ORIGIN='https://itext-1b9da.web.app'
export const SITE_DESCRIPTION='Itext é uma rede social para compartilhar publicações, stories e vídeos no Ishort, encontrar pessoas, participar de comunidades e conversar em tempo real.'
function escape(value){return value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')}
export function siteOrigin(value=SITE_ORIGIN){
 const url=new URL(value)
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('VITE_SITE_URL deve ser a origem HTTPS pública do site, sem caminhos ou credenciais.')
 return url.origin
}
export function discoveryFiles(config={}){
 const origin=siteOrigin(config.VITE_SITE_URL||SITE_ORIGIN),url=origin+'/'
 const tags=[`<meta name="description" content="${escape(SITE_DESCRIPTION)}" />`,`<link rel="canonical" href="${escape(url)}" />`,'<meta name="robots" content="index,follow" />',`<meta property="og:type" content="website" />`,`<meta property="og:site_name" content="Itext" />`,`<meta property="og:title" content="Itext" />`,`<meta property="og:description" content="${escape(SITE_DESCRIPTION)}" />`,`<meta property="og:url" content="${escape(url)}" />`,'<meta property="og:locale" content="pt_BR" />','<meta name="twitter:card" content="summary" />','<meta name="twitter:title" content="Itext" />',`<meta name="twitter:description" content="${escape(SITE_DESCRIPTION)}" />`]
 for(const [variable,name] of [['VITE_GOOGLE_SITE_VERIFICATION','google-site-verification'],['VITE_BING_SITE_VERIFICATION','msvalidate.01']])if(config[variable]){
  if(!/^[a-zA-Z0-9_-]{10,200}$/.test(config[variable]))throw new Error(`Confira o código público de verificação ${variable}.`)
  tags.push(`<meta name="${name}" content="${config[variable]}" />`)
 }
 const data={'@context':'https://schema.org','@type':'WebSite',name:'Itext',alternateName:'Itext social',url,description:SITE_DESCRIPTION,inLanguage:'pt-BR'}
 tags.push(`<script type="application/ld+json">${JSON.stringify(data).replaceAll('<','\\u003c')}</script>`)
 return {head:tags.join('\n    '),robots:`User-agent: *\nAllow: /\nDisallow: /*?\n\nSitemap: ${origin}/sitemap.xml\n`,sitemap:`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(url)}</loc></url></urlset>\n`}
}
