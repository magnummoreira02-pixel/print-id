import { useStore } from '../store/useStore'

export default function Sidebar(){
  const { aba, setAba, tema, setTema, rows, historico } = useStore()
  const items: {id:'bipagem'|'dados'|'config', label:string, kbd:string}[] = [
    {id:'bipagem', label:'BIPAGEM', kbd:'F1'},
    {id:'dados', label:'DADOS', kbd:'F2'},
    {id:'config', label:'CONFIGURAÇÕES', kbd:'F3'},
  ]
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-title">PRINT ID</div>
        <div className="logo-sub">ETIQUETAS</div>
      </div>
      <nav className="sidebar-nav">
        {items.map(it=>(
          <button key={it.id} className={`nav-item ${aba===it.id?'active':''}`} onClick={()=>setAba(it.id)}>
            <span>{it.label}</span><span className="kbd">{it.kbd}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="btn-outline" onClick={()=>setTema(tema==='dark'?'light':'dark')}>
          {tema==='dark'?'☀ MODO CLARO':'🌙 MODO ESCURO'}
        </button>
        <div className="footer-meta">
          <span>{rows.length} linhas</span>
          <span className="badge-sqlite">SQLITE</span>
          <span>v0.1.0</span>
        </div>
        <div className="footer-hint" style={{fontSize:10, opacity:0.6}}>{historico.length} bipagens salvas</div>
      </div>
    </aside>
  )
}
