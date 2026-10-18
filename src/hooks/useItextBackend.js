import { useCallback, useEffect, useRef, useState } from 'react'
import { initializeAuth, independent, supabase } from '../services/auth.js'
import { itextApi } from '../services/itextApi.js'

export function useItextBackend() {
  // Identity is supplied by the server; URL parameters never select a profile.
  const userId = ''
  const likeResults=useRef(new Map())
  const [state, setState] = useState({ user: null, posts: [], ownPosts: [], communities: [], pages: [], profiles: [], dating: null, status: null })
  const [feedMode, setFeedMode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)

  const refresh = useCallback(async () => {
    const requestedAt=Date.now()
    try {
      await initializeAuth()
      const [bootstrap, status] = await Promise.all([itextApi.bootstrap(userId), itextApi.status()])
      const selectedMode = feedMode || bootstrap.user.settings?.feed?.mode || 'personalized'
      const [feed, ownFeed] = await Promise.all([itextApi.feed(userId, selectedMode), itextApi.ownPosts()])
      if (!feedMode) setFeedMode(selectedMode)
      function mergeLike(post){const changed=likeResults.current.get(post.id);return changed&&changed.at>=requestedAt?{...post,...changed.value}:post}
      setState((current) => ({ ...current, user: bootstrap.user, posts: feed.posts.map(mergeLike), ownPosts: ownFeed.posts.map(mergeLike), communities: bootstrap.communities, pages: bootstrap.pages, profiles: bootstrap.profiles || [], status }))
      setError('')
    } catch (requestError) {
      setError(requestError.message || 'Servidor Itext indisponível.')
    } finally {
      setLoading(false)
    }
  }, [feedMode, userId])

  useEffect(() => { refresh() }, [refresh, refreshToken])

  useEffect(() => {
    const subscription = independent && supabase ? supabase.auth.onAuthStateChange(() => setRefreshToken((value) => value + 1)).data.subscription : null
    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    const polling = window.setInterval(() => setRefreshToken((value) => value + 1), 30_000)
    return () => window.clearInterval(polling)
  }, [])

  useEffect(()=>{
    const update=event=>{likeResults.current.set(event.detail.id,{at:Date.now(),value:{likes:event.detail.likes,liked:event.detail.liked}});setState(current=>({...current,...Object.fromEntries(['posts','ownPosts'].map(key=>[key,current[key].map(post=>post.id===event.detail.id?{...post,likes:event.detail.likes,liked:event.detail.liked}:post)]))}))}
    window.addEventListener('itext:post-like',update)
    return()=>window.removeEventListener('itext:post-like',update)
  },[])

  const run = useCallback(async (operation) => {
    try {
      const result = await operation()
      await refresh()
      return result
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível sincronizar a alteração.')
      throw requestError
    }
  }, [refresh])

  // Profile actions always use the identity returned by the server.
  const activeUserId = state.user?.id || userId

  return {
    ...state, userId: activeUserId, feedMode, setFeedMode, loading, error, clearError: () => setError(''), refresh,
    publishPost: (payload) => run(() => itextApi.createPost({ ...payload, userId: activeUserId })),
    editPost: (id,payload) => run(() => itextApi.editPost(id,payload)),
    deletePost: (id) => run(() => itextApi.deletePost(id)),
    toggleLike: (postId,desired) => itextApi.setPostLike(postId,desired),
    addComment: (postId, text) => run(() => itextApi.addComment(postId, activeUserId, text)),
    savePreferences: (interests, onboardingComplete) => run(() => itextApi.savePreferences(activeUserId, interests, onboardingComplete)),
    saveSettings: async (settings) => {
      const result = await run(() => itextApi.saveSettings(activeUserId, settings))
      if (settings.feed?.mode) {
        const nextMode = settings.feed.mode
        setFeedMode(nextMode)
        const feed = await itextApi.feed(activeUserId, nextMode === 'following' ? 'following' : nextMode)
        setState((current) => ({ ...current, posts: feed.posts }))
      }
      return result
    },
    saveSpace: (kind,id,payload) => run(() => itextApi.saveSpace(kind,id,payload)),
    createCommunity: (payload) => run(() => itextApi.createCommunity(payload)),
    createPage: (payload) => run(() => itextApi.createPage(payload)),
    uploadMedia: (file) => itextApi.uploadMedia(file),
    saveProfile: (payload) => run(() => itextApi.saveProfile(activeUserId, payload)),
    getDating: async () => {
      const dating = await itextApi.dating()
      setState((current) => ({ ...current, dating }))
      return dating
    },
    saveDatingProfile: async (payload) => {
      const dating = await run(() => itextApi.saveDatingProfile(payload))
      setState((current) => ({ ...current, dating }))
      return dating
    },
    swipeDatingProfile: async (candidateId, action) => {
      const dating = await run(() => itextApi.swipeDatingProfile(candidateId, action))
      setState((current) => ({ ...current, dating }))
      return dating
    },
    openGroup: (groupId, inviteCode) => itextApi.group(groupId, inviteCode),
    joinGroup: (groupId, inviteCode) => run(() => itextApi.joinGroup(groupId, inviteCode)),
    approveGroupMember: (groupId, memberId) => run(() => itextApi.approveGroupMember(groupId, memberId)),
    togglePageFollow: (pageId) => run(() => itextApi.togglePageFollow(pageId)),
    toggleProfileFollow: (profileId) => run(() => itextApi.toggleProfileFollow(profileId)),
  }
}
