export default function TitleBar(){
  const isElectron = !!(window as any).electronAPI
  return (
    <div className="titlebar">
      <div className="titlebar-title">Print ID</div>
      <div className="titlebar-actions">
        {isElectron ? <>
          <button onClick={()=> (window as any).electronAPI?.windowControl('minimize')}>─</button>
          <button onClick={()=> (window as any).electronAPI?.windowControl('maximize')}>□</button>
          <button className="close" onClick={()=> (window as any).electronAPI?.windowControl('close')}>×</button>
        </> : <span className="titlebar-web">Web Preview</span>}
      </div>
    </div>
  )
}
