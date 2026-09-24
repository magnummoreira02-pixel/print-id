import { useEffect } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import Bipagem from './components/Bipagem'
import Dados from './components/Dados'
import Config from './components/Config'
import { useStore } from './store/useStore'
import './styles/global.css'

export default function App(){
  const { aba, setAba, tema } = useStore()
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==='F1'){ e.preventDefault(); setAba('bipagem')}
      if(e.key==='F2'){ e.preventDefault(); setAba('dados')}
      if(e.key==='F3'){ e.preventDefault(); setAba('config')}
    }
    window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey)
  },[setAba])
  return (
    <div className={tema}>
      <TitleBar/>
      <div className="app">
        <Sidebar/>
        <main className="main">
          {aba==='bipagem' && <Bipagem/>}
          {aba==='dados' && <Dados/>}
          {aba==='config' && <Config/>}
        </main>
      </div>
    </div>
  )
}
