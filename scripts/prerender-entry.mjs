import {createServer} from 'vite'
import {createElement} from 'react'
import {renderToString} from 'react-dom/server'
export async function prerenderEntry(){
 const server=await createServer({mode:'independent',server:{middlewareMode:true},appType:'custom'})
 try{
  // Public welcome copy only. No sessions, users, stories or messages are fetched.
  const {WelcomeContent}=await server.ssrLoadModule('/src/features/WelcomeView.jsx')
  return renderToString(createElement(WelcomeContent,{providers:[],loading:true,error:'',busy:''}))
 }finally{await server.close()}
}
