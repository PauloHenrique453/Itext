const pattern=/(^|[^\p{L}\p{N}_/#?&=])#([\p{L}\p{N}_]{1,64})(?![\p{L}\p{N}_])/gu
export function normalizeTag(value=''){
 const name=String(value).normalize('NFC').replace(/^#/,'').toLowerCase()
 return /^[\p{L}\p{N}_]{1,64}$/u.test(name)?'#'+name:null
}
export function hashtagParts(value=''){
 const text=String(value).normalize('NFC'),found=[...text.matchAll(pattern)],allowed=new Set([...new Set(found.map(match=>normalizeTag(match[2])))].sort().slice(0,30)),parts=[];let cursor=0
 for(const match of found){const start=match.index+match[1].length,end=match.index+match[0].length,tag=normalizeTag(match[2]);if(!allowed.has(tag))continue;if(start>cursor)parts.push({text:text.slice(cursor,start)});parts.push({text:text.slice(start,end),tag});cursor=end}
 if(cursor<text.length)parts.push({text:text.slice(cursor)})
 return parts
}
export function extractHashtags(text=''){return [...new Set(hashtagParts(text).filter(part=>part.tag).map(part=>part.tag))].sort()}
