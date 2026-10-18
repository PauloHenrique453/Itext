import { supabase, initializeAuth } from './auth.js'

const DEFAULT_SETTINGS = { feed: { mode: 'personalized' } }
const taxonomy = [
  ['programação', ['react','javascript','typescript','css','html','código','programação','api','backend','frontend','git','dev']],
  ['design', ['design','ui','ux','produto','tipografia','acessibilidade']],
  ['comunidades', ['comunidade','pessoas','grupo','encontro','colaboração']],
  ['inteligência artificial', ['inteligência artificial','llm','algoritmo','automação']],
  ['criatividade', ['criativo','vídeo','foto','criador','arte']],
]
const mediaCache = new Map()
const storyMediaCache = new Map()
const storagePrefix = 'itext-media:'
function storedUrl(value) {
  if (typeof value !== 'string') return null
  if (value.startsWith(storagePrefix)) return value
  try {
    const url = new URL(value)
    const marker = '/storage/v1/object/sign/itext-media/'
    const offset = url.pathname.indexOf(marker)
    if (offset >= 0 && url.origin === new URL(import.meta.env.VITE_SUPABASE_URL).origin) return storagePrefix + decodeURIComponent(url.pathname.slice(offset + marker.length))
    if (url.protocol === 'https:') return value
  } catch { /* Local placeholders are not stored as remote media. */ }
  return null
}
async function displayUrl(value) {
  if (!value?.startsWith(storagePrefix)) return value || null
  const path = value.slice(storagePrefix.length)
  const cached = mediaCache.get(path)
  if (cached && cached.expires > Date.now()) return cached.url
  const { data, error } = await supabase.storage.from('itext-media').createSignedUrl(path,3600)
  if (error) return null
  mediaCache.set(path,{url:data.signedUrl,expires:Date.now()+3300000})
  return data.signedUrl
}
async function result(query) {
  const {data,error}=await query
  if (error) throw new Error(error.code === '42P01' || error.code === 'PGRST205' ? 'Falta aplicar o arquivo social.sql no Supabase.' : error.message)
  return data
}
async function identity(required=true) {
  await initializeAuth()
  const {data,error}=await supabase.auth.getSession()
  if (error) throw error
  if (!data.session && required) throw new Error('Entre com Google para continuar.')
  return data.session?.user || null
}
function classify(text,code) {
  const words=`${text} ${code?.html||''} ${code?.css||''} ${code?.js||''}`.toLowerCase()
  const categories=taxonomy.filter(([,terms])=>terms.some((term)=>words.includes(term))).map(([name])=>name)
  if (code && !categories.includes('programação')) categories.push('programação')
  return {categories:categories.length?categories:['geral'],tags:[...new Set(text.match(/#[\p{L}\d_]+/gu)||[])]}
}
function timeAgo(value) {
  const minutes=Math.max(1,Math.floor((Date.now()-new Date(value))/60000))
  return minutes<60?`${minutes} min`:minutes<1440?`${Math.floor(minutes/60)}h`:`${Math.floor(minutes/1440)}d`
}
async function profile(row,authenticated=false,following=[],counts={}) {
  return {id:row.id,name:row.name,handle:`@membro-${row.id.slice(0,8)}`,avatar:await displayUrl(row.avatar_url),bio:row.bio||'',coverUrl:await displayUrl(row.cover_url),themeColor:row.theme_color||'blue',interests:row.interests||[],following,likesPublic:row.likes_public===true,followersCount:counts.followers||0,followingCount:counts.following||0,settings:{...DEFAULT_SETTINGS,...row.settings},onboardingComplete:Boolean(row.onboarding_complete),authenticated,createdAt:row.created_at}
}
async function profiles() {
  const rows=await result(supabase.from('itext_public_profiles').select('*').order('created_at',{ascending:false}).limit(100))
  const counts=rows.length?await result(supabase.from('itext_profile_counts').select('*').in('id',rows.map((row)=>row.id))):[]
  return Promise.all(rows.map((row)=>profile(row,false,[],counts.find((item)=>item.id===row.id))))
}
async function currentProfile() {
  const user=await identity(false)
  if (!user) return {id:'anonymous',name:'Visitante',handle:'',avatar:'/avatar.svg',bio:'',interests:[],following:[],settings:DEFAULT_SETTINGS,onboardingComplete:true,authenticated:false}
  const row=await result(supabase.from('chat_profiles').select('*').eq('id',user.id).single())
  const follows=await result(supabase.from('itext_follows').select('following_id').eq('follower_id',user.id))
  const counts=await result(supabase.from('itext_profile_counts').select('*').eq('id',user.id).single())
  return profile(row,true,follows.map((entry)=>entry.following_id),counts)
}
function groupItem(row,uid,members,memberCount=null) {
  const own=members.find((entry)=>entry.user_id===uid)
  const count=memberCount??members.filter((entry)=>entry.status==='active').length
  return {...row,memberCount:count,members:String(count),accent:'#1683ff',icon:'✦',membershipStatus:own?.status||'none',membershipRole:own?.role,canManage:row.owner_id===uid,canPost:own?.status==='active',isOwner:row.owner_id===uid}
}
async function lists(user) {
  const [groups,pages,ownMemberships,ownFollows,people]=await Promise.all([
    result(supabase.from('itext_groups').select('*').order('created_at',{ascending:false}).limit(100)),
    result(supabase.from('itext_pages').select('*').order('created_at',{ascending:false}).limit(100)),
    user.authenticated?result(supabase.from('itext_group_members').select('group_id,user_id,status,role').eq('user_id',user.id).limit(1000)):[],
    user.authenticated?result(supabase.from('itext_page_follows').select('*').eq('user_id',user.id).limit(1000)):[],profiles(),
  ])
  const [groupCounts,pageCounts]=await Promise.all([
    groups.length?result(supabase.from('itext_group_counts').select('*').in('group_id',groups.map((row)=>row.id))):[],
    pages.length?result(supabase.from('itext_page_counts').select('*').in('page_id',pages.map((row)=>row.id))):[],
  ])
  return {communities:groups.map((row)=>groupItem(row,user.id,ownMemberships.filter((entry)=>entry.group_id===row.id),groupCounts.find((entry)=>entry.group_id===row.id)?.members||0)),pages:await Promise.all(pages.map(async(row)=>({...row,avatar:await displayUrl(row.avatar_url),followers:pageCounts.find((entry)=>entry.page_id===row.id)?.followers||0,followed:ownFollows.some((entry)=>entry.page_id===row.id),isOwner:row.owner_id===user.id,verified:false}))),profiles:people.filter((entry)=>entry.id!==user.id).map((entry)=>({...entry,followed:user.following.includes(entry.id),score:entry.interests.filter((interest)=>user.interests.includes(interest)).length}))}
}
async function loadFeed(mode='chronological',{authorId,groupId}={}) {
  const user=await currentProfile()
  let query=supabase.from('itext_posts').select('*').order('created_at',{ascending:false}).limit(80)
  if (authorId) query=query.eq('author_id',authorId)
  if (groupId) query=query.eq('group_id',groupId)
  if (mode==='following') {
    if (!user.following.length) return {posts:[]}
    query=query.in('author_id',user.following)
  }
  const rows=await result(query)
  if (!rows.length) return {posts:[]}
  const ids=rows.map((row)=>row.id)
  const [likes,comments,people,spaces,counts]=await Promise.all([
    user.authenticated?result(supabase.from('itext_likes').select('*').in('post_id',ids).eq('user_id',user.id)):[],
    result(supabase.from('itext_comments').select('*').in('post_id',ids).order('created_at').limit(10000)),profiles(),lists(user),result(supabase.from('itext_post_counts').select('*').in('id',ids)),
  ])
  const missing=[...new Set([...rows.map((row)=>row.author_id),...comments.map((row)=>row.author_id)])].filter((id)=>id!==user.id&&!people.some((entry)=>entry.id===id))
  if (missing.length) people.push(...await Promise.all((await result(supabase.from('itext_public_profiles').select('*').in('id',missing))).map((row)=>profile(row))))
  const byId=new Map([...people,user].map((entry)=>[entry.id,entry]))
  const posts=await Promise.all(rows.map(async(row)=>{
    let author=byId.get(row.author_id)
    if (!author) {
      const found=await result(supabase.from('itext_public_profiles').select('*').eq('id',row.author_id).single())
      author=await profile(found)
    }
    const postComments=comments.filter((entry)=>entry.post_id===row.id)
    const postLikes=likes.filter((entry)=>entry.post_id===row.id)
    const group=spaces.communities.find((entry)=>entry.id===row.group_id)
    const page=spaces.pages.find((entry)=>entry.id===row.page_id)
    const interest=(row.categories||[]).filter((entry)=>user.interests.includes(entry))
    const relationship=user.following.includes(row.author_id)
    return {id:row.id,author:author.name,authorId:author.id,handle:author.handle,avatar:author.avatar,verified:false,time:timeAgo(row.created_at),createdAt:row.created_at,editedAt:row.edited_at,text:row.text,code:row.code,media:await Promise.all((row.media||[]).map(async(item)=>({...item,url:await displayUrl(item.url)}))),tags:row.tags,categories:row.categories,likes:counts.find((entry)=>entry.id===row.id)?.likes||0,comments:counts.find((entry)=>entry.id===row.id)?.comments||0,liked:postLikes.some((entry)=>entry.user_id===user.id),commentsList:postComments.map((entry)=>({id:entry.id,text:entry.text,author:byId.get(entry.author_id)?.name||'Membro do Itext'})),groupId:row.group_id,pageId:row.page_id,context:group?{type:'group',name:group.name}:page?{type:'page',name:page.name}:null,kind:row.code?'game':row.media?.some((entry)=>entry.type==='video')?'video':'post',reason:interest.length?`combina com seu interesse em ${interest[0]}`:relationship?`você segue ${author.name}`:'foi publicada na comunidade',score:interest.length*2+(relationship?2:0)+Math.exp(-(Date.now()-new Date(row.created_at))/172800000)}
  }))
  if (mode==='personalized') posts.sort((a,b)=>b.score-a.score)
  return {posts}
}
async function toggle(table,keys) {
  const user=await identity()
  const fields=Object.fromEntries(Object.entries(keys).map(([key,value])=>[key,value==='@me'?user.id:value]))
  let query=supabase.from(table).select('*')
  for (const [key,value] of Object.entries(fields)) query=query.eq(key,value)
  const existing=await result(query.maybeSingle())
  if (existing) {
    let deletion=supabase.from(table).delete()
    for (const [key,value] of Object.entries(fields)) deletion=deletion.eq(key,value)
    await result(deletion)
  } else await result(supabase.from(table).insert(fields))
  return !existing
}
async function dating() {
  const user=await identity()
  const [own,cards]=await Promise.all([result(supabase.from('itext_dating').select('*').eq('user_id',user.id).maybeSingle()),result(supabase.rpc('itext_dating_cards'))])
  if (!own) return {profile:null,candidates:[],matches:[]}
  const asCard=async(row)=>({id:row.id,name:row.name,avatar:await displayUrl(row.photos?.[0]||row.avatar),photos:await Promise.all((row.photos||[]).map(displayUrl)),bio:row.bio,city:row.city,age:row.age,interests:row.interests,sharedInterests:row.interests.filter((entry)=>own.interests.includes(entry)),distanceLabel:row.distance_label,lookingFor:row.looking_for})
  return {profile:{bio:own.bio,birthDate:own.birth_date,city:own.city,latitude:own.latitude,longitude:own.longitude,interests:own.interests,photos:await Promise.all(own.photos.map(displayUrl)),lookingFor:own.looking_for,discoveryEnabled:own.discovery_enabled},candidates:await Promise.all(cards.filter((row)=>!row.swiped).map(asCard)),matches:await Promise.all(cards.filter((row)=>row.matched).map(asCard))}
}
export const socialApi={
  async stories(authorId=null) {
    const user=await identity()
    let query=supabase.from('itext_stories').select('*').order('created_at',{ascending:false}).limit(100)
    if(authorId)query=query.eq('author_id',authorId)
    const rows=await result(query)
    if(!rows.length)return []
    const [authors,counts,likes]=await Promise.all([
      result(supabase.from('itext_public_profiles').select('id,name,avatar_url').in('id',[...new Set(rows.map(row=>row.author_id))])),
      result(supabase.from('itext_story_counts').select('*').in('id',rows.map(row=>row.id))),
      result(supabase.from('itext_story_likes').select('story_id').eq('user_id',user.id).in('story_id',rows.map(row=>row.id))),
    ])
    return Promise.all(rows.map(async row=>{
      const author=authors.find(person=>person.id===row.author_id)
      let cached=storyMediaCache.get(row.media_path)
      if(!cached||cached.expires<Date.now()) {
        const signed=await supabase.storage.from('itext-media').createSignedUrl(row.media_path,Math.max(1,Math.min(300,Math.floor((new Date(row.expires_at).getTime()-Date.now())/1000))))
        cached={url:signed.error?null:signed.data.signedUrl,expires:Math.min(Date.now()+270000,new Date(row.expires_at).getTime())}
        if(cached.url)storyMediaCache.set(row.media_path,cached)
      }
      return {...row,url:cached.url,name:author?.name||'Membro do Itext',avatar:await displayUrl(author?.avatar_url),likes:counts.find(count=>count.id===row.id)?.likes||0,liked:likes.some(like=>like.story_id===row.id)}
    }))
  },
  async createStory(file,caption='') {
    if(!['image','video'].includes(file?.type.split('/')[0]))throw new Error('Escolha uma foto ou um vídeo.')
    const user=await identity()
    const upload=await this.uploadMedia(file)
    return result(supabase.from('itext_stories').insert({author_id:user.id,media_path:upload.media.storagePath,media_type:upload.media.type,caption:caption.trim().slice(0,280)}).select('id').single())
  },
  toggleStoryLike:(id)=>toggle('itext_story_likes',{story_id:id,user_id:'@me'}),
  deleteStory:(id)=>result(supabase.rpc('itext_delete_story',{story_id:id})),
  async profilePhotos(profileId,cursor=null) {
    await identity()
    const rows=await result(supabase.rpc('itext_profile_photos',{profile_id:profileId,before_at:cursor?.created_at||null,before_id:cursor?.post_id||null}))
    return {rows:await Promise.all(rows.map(async row=>({...row,media:await Promise.all(row.media.map(async item=>({...item,url:await displayUrl(item.url)})))}))),hasMore:rows.length===40,cursor:rows.at(-1)||null}
  },
  async editPost(id,payload) {
    const user=await identity()
    const text=payload.text?.trim()||''
    const code=payload.code&&Object.values(payload.code).some(value=>value.trim())?payload.code:null
    const media=(payload.media||[]).map(entry=>{const url=entry.storagePath?storagePrefix+entry.storagePath:storedUrl(entry.url);return {...entry,url,storagePath:url?.startsWith(storagePrefix)?url.slice(storagePrefix.length):null}})
    return result(supabase.from('itext_posts').update({text,code,media,...classify(text,code)}).eq('id',id).eq('author_id',user.id).select('id').single())
  },
  async deletePost(id) {
    const user=await identity()
    return result(supabase.from('itext_posts').delete().eq('id',id).eq('author_id',user.id).select('id').single())
  },
  async likedPosts(profileId,after=null) {
    await identity()
    const visible=await result(supabase.rpc('itext_likes_visible',{profile_id:profileId}))
    if(!visible)return {visible:false,posts:[],hasMore:false,cursor:null}
    const rows=await result(supabase.rpc('itext_liked_posts',{profile_id:profileId,after_id:after}))
    const authors=rows.length?await result(supabase.from('itext_public_profiles').select('id,name').in('id',[...new Set(rows.map((row)=>row.author_id))])):[]
    const posts=await Promise.all(rows.map(async(row)=>({id:row.id,text:row.text,author:authors.find((entry)=>entry.id===row.author_id)?.name||'Membro do Itext',createdAt:row.created_at,hasCode:!!row.code,media:await Promise.all((row.media||[]).map(async(item)=>({...item,url:await displayUrl(item.url)})))})))
    return {visible:true,posts,hasMore:rows.length===40,cursor:rows.at(-1)?.id||null}
  },
  async people({query='',after=null,relation='all'}={}) {
    await identity()
    const rows=await result(supabase.rpc('itext_people',{search_query:query.trim().slice(0,80),after_id:after,relation}))
    return {people:await Promise.all(rows.map(async(row)=>({...await profile(row.profile,false,[],{followers:row.followers,following:row.following}),followed:row.followed,followsYou:row.follows_you}))),hasMore:rows.length===40,cursor:rows.at(-1)?.profile.id||null}
  },
  async bootstrap() { const user=await currentProfile(); return {user,...await lists(user)} },
  status:async()=>({mode:'supabase',persistence:'Postgres',refreshSeconds:30}),
  feed:(_uid,mode)=>loadFeed(mode),
  async ownPosts() { const user=await identity(false); return user?loadFeed('chronological',{authorId:user.id}):{posts:[]} },
  async createPost(payload) {
    const user=await identity()
    const text=payload.text?.trim()||''
    const code=payload.code && Object.values(payload.code).some((entry)=>String(entry).trim())?payload.code:null
    const media=(payload.media||[]).map((entry)=>{const url=storedUrl(entry.url);return {...entry,url,storagePath:url?.startsWith(storagePrefix)?url.slice(storagePrefix.length):null}})
    const classification=classify(text,code)
    const row=await result(supabase.from('itext_posts').insert({author_id:user.id,text,code,media,group_id:payload.groupId||null,page_id:payload.pageId||null,...classification}).select('id').single())
    return {...row,classification:{...classification,hasCode:Boolean(code)}}
  },
  toggleLike:(id)=>toggle('itext_likes',{post_id:id,user_id:'@me'}),
  async addComment(id,_uid,text) { const user=await identity(); return result(supabase.from('itext_comments').insert({post_id:id,author_id:user.id,text:text.trim()})) },
  async savePreferences(_uid,interests,onboardingComplete=true) { const user=await identity(); return result(supabase.from('chat_profiles').update({interests,onboarding_complete:onboardingComplete}).eq('id',user.id)) },
  async saveSettings(_uid,settings) { const user=await identity(); return result(supabase.from('chat_profiles').update({settings:{feed:{mode:settings.feed.mode}},likes_public:settings.likesPublic===true}).eq('id',user.id)) },
  async saveProfile(_uid,payload) { const user=await identity(); if(!payload.name?.trim()||payload.name.trim().length>80||String(payload.bio||'').length>280)throw new Error('Confira o nome e a biografia do perfil.'); return result(supabase.from('chat_profiles').update({name:payload.name.trim(),bio:payload.bio,avatar_url:storedUrl(payload.avatar),cover_url:storedUrl(payload.coverUrl),theme_color:payload.themeColor}).eq('id',user.id)) },
  async createCommunity(payload) {
    const id=await result(supabase.rpc('itext_create_group',{group_name:payload.name,group_description:payload.description||'',group_visibility:payload.visibility||'public',group_join_policy:payload.joinPolicy||'open'}))
    return {community:{id,...payload}}
  },
  async createPage(payload) { const user=await identity(); const page=await result(supabase.from('itext_pages').insert({owner_id:user.id,name:payload.name,category:payload.category,description:payload.description}).select().single()); return {page} },
  async uploadMedia(file) {
    const user=await identity()
    const type=file.type.split('/')[0]
    if (!['image','audio','video'].includes(type)) throw new Error('Escolha uma imagem, áudio ou vídeo.')
    const limit={image:8000000,audio:18000000,video:28000000}[type]
    if (file.size>limit) throw new Error('Este arquivo excede o limite de tamanho.')
    const path=`${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(-80)}`
    await result(supabase.storage.from('itext-media').upload(path,file,{contentType:file.type,upsert:false}))
    return {media:{url:await displayUrl(storagePrefix+path),storagePath:path,type,name:file.name,size:file.size}}
  },
  async group(id,inviteCode='') {
    const user=await currentProfile()
    const rows=await result(supabase.rpc('itext_group_by_invite',{gid:id,invite_code:inviteCode||''}))
    if (!rows.length) throw new Error('Grupo indisponível ou convite inválido.')
    const [members,people,feed]=await Promise.all([result(supabase.from('itext_group_members').select('*').eq('group_id',id)),profiles(),loadFeed('chronological',{groupId:id})])
    const group=groupItem(rows[0],user.id,members)
    group.join_policy=rows[0].join_policy
    if (group.canManage) { const invite=await result(supabase.from('itext_group_invites').select('code').eq('group_id',id).single());group.shareCode=invite.code }
    const names=new Map([...people,user].map((entry)=>[entry.id,entry]))
    return {group,posts:feed.posts,sessions:[],members:members.filter((entry)=>entry.status==='active').map((entry)=>({...names.get(entry.user_id),role:entry.role})),pending:members.filter((entry)=>entry.status==='pending').map((entry)=>({...names.get(entry.user_id),userId:entry.user_id}))}
  },
  async joinGroup(id,code='') { return {status:await result(supabase.rpc('itext_join_group',{gid:id,invite_code:code||''}))} },
  approveGroupMember:(id,uid)=>result(supabase.rpc('itext_approve_member',{gid:id,member_id:uid})),
  async togglePageFollow(id) { return {followed:await toggle('itext_page_follows',{page_id:id,user_id:'@me'})} },
  toggleProfileFollow:(id)=>toggle('itext_follows',{follower_id:'@me',following_id:id}),
  dating,
  async saveDatingProfile(payload) {
    const user=await identity()
    const rounded=(value)=>value==null?null:Math.round(Number(value)*10)/10
    await result(supabase.from('itext_dating').upsert({user_id:user.id,birth_date:payload.birthDate,bio:payload.bio,city:payload.city,latitude:rounded(payload.latitude),longitude:rounded(payload.longitude),interests:payload.interests,photos:payload.photos.map(storedUrl).filter(Boolean),looking_for:payload.lookingFor,discovery_enabled:payload.discoveryEnabled}))
    return dating()
  },
  async swipeDatingProfile(id,action) { const user=await identity();await result(supabase.from('itext_swipes').upsert({user_id:user.id,candidate_id:id,action}));const data=await dating();return {...data,matched:data.matches.some((row)=>row.id===id)} },
}
