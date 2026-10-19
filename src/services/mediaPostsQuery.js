// media is JSONB, not a PostgreSQL array: the SDK needs serialized JSON here.
export function mediaPostsQuery(client,columns,match){
 return client.from('itext_posts').select(columns).is('group_id',null)
  .contains('media',JSON.stringify([match]))
  .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(20)
}
