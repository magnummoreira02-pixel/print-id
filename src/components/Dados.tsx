import { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useStore } from '../store/useStore'

export default function Dados(){
  const { headers, rows, matrizMeta, setRows, updateRow, addRow, deleteRow } = useStore()
  const [q, setQ] = useState('')
  const [sortCol, setSortCol] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<{r:number,c:string}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pageSize=100

  const filtered = useMemo(()=>{
    let arr=[...rows]
    if(q){
      const qq=q.toLowerCase()
      arr=arr.filter(r=> headers.some(h=> String(r[h]??'').toLowerCase().includes(qq)))
    }
    if(sortCol){
      arr.sort((a,b)=>{
        const av=String(a[sortCol]??''), bv=String(b[sortCol]??'')
        return sortDir==='asc'? av.localeCompare(bv,'pt-BR',{numeric:true}): bv.localeCompare(av,'pt-BR',{numeric:true})
      })
    }
    return arr
  },[rows, q, sortCol, sortDir, headers])

  const totalPages = Math.max(1, Math.ceil(filtered.length/pageSize))
  const pageRows = filtered.slice((page-1)*pageSize, page*pageSize)

  async function handleImport(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file) return
    const buf=await file.arrayBuffer()
    let wb:XLSX.WorkBook
    if(file.name.endsWith('.csv')){
      const text=new TextDecoder().decode(buf)
      wb=XLSX.read(text,{type:'string'})
    }else{
      wb=XLSX.read(buf,{type:'array'})
    }
    const sheetName=wb.SheetNames[0]
    const ws=wb.Sheets[sheetName]
    const json:any[][]=XLSX.utils.sheet_to_json(ws,{header:1, defval:''})
    if(!json.length) return alert('Planilha vazia')
    const hdrs=json[0].map((h:any)=> String(h||'').trim()).filter(Boolean)
    const dataRows=json.slice(1).filter(r=> r.some(v=> String(v).trim()!=='')).map(r=>{
      const obj:any={}; hdrs.forEach((h,i)=> obj[h]=r[i]??''); return obj
    })
    const modo = rows.length? confirm('Substituir matriz atual? OK=Substituir / Cancelar=Acrescentar')? 'replace':'append' : 'replace'
    if(modo==='replace'){
      setRows(hdrs, dataRows, {arquivo:file.name, data:new Date().toLocaleString('pt-BR'), qtd:dataRows.length})
    }else{
      // acrescentar: merge headers
      const allHeaders = Array.from(new Set([...headers, ...hdrs]))
      const merged = [...rows, ...dataRows.map(r=>{ const o:any={}; allHeaders.forEach(h=> o[h]=r[h]??''); return o})]
      // ensure existing rows have all headers
      const normalized = merged.map(r=>{ const o:any={}; allHeaders.forEach(h=> o[h]=r[h]??''); return o})
      setRows(allHeaders, normalized, {arquivo: matrizMeta?.arquivo||file.name, data:new Date().toLocaleString('pt-BR'), qtd: normalized.length})
    }
    setPage(1)
    if(fileRef.current) fileRef.current.value=''
  }

  function exportFile(fmt:'xlsx'|'csv'){
    if(!rows.length) return alert('Sem dados')
    const ws=XLSX.utils.json_to_sheet(rows)
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Matriz')
    if(fmt==='xlsx'){ XLSX.writeFile(wb, 'matriz_print_id.xlsx') }
    else { const csv=XLSX.utils.sheet_to_csv(ws); const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='matriz_print_id.csv'; a.click() }
  }

  return (
    <div className="page dados">
      <header className="page-header">
        <div>
          <h2>MATRIZ DE ENSAIOS</h2>
          {matrizMeta && <small>{matrizMeta.arquivo} • {matrizMeta.qtd} linhas • {matrizMeta.data}</small>}
        </div>
        <div className="header-actions">
          <button className="btn lime" onClick={()=>fileRef.current?.click()}>Importar</button>
          <button className="btn outline" onClick={()=>exportFile('xlsx')}>Exportar XLSX</button>
          <button className="btn outline" onClick={()=>exportFile('csv')}>CSV</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleImport}/>
        </div>
      </header>

      <div className="toolbar">
        <input placeholder="Buscar em todas as colunas..." value={q} onChange={e=>{setQ(e.target.value); setPage(1)}} className="search-all"/>
        <span className="count">{filtered.length} linhas</span>
        <button className="btn small" onClick={()=>{
          const blank:any={}; headers.forEach(h=> blank[h]=''); addRow(blank)
        }}>+ Adicionar linha</button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{width:40}}>#</th>
              {headers.map(h=>(
                <th key={h} onClick={()=>{ if(sortCol===h) setSortDir(d=>d==='asc'?'desc':'asc'); else {setSortCol(h); setSortDir('asc')}}} className={sortCol===h?'sorted':''}>
                  {h} {sortCol===h? (sortDir==='asc'?'↑':'↓'):''}
                </th>
              ))}
              <th style={{width:60}}></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r,idx)=>{
              const realIdx = rows.indexOf(r)
              return (
                <tr key={idx}>
                  <td className="mono muted">{(page-1)*pageSize+idx+1}</td>
                  {headers.map(h=>(
                    <td key={h} onDoubleClick={()=>setEditing({r:realIdx,c:h})}>
                      {editing?.r===realIdx && editing.c===h ? (
                        <input autoFocus defaultValue={String(r[h]??'')} onBlur={e=>{ updateRow(realIdx,h,e.target.value); setEditing(null)}} onKeyDown={e=>{ if(e.key==='Enter'){ updateRow(realIdx,h,(e.target as HTMLInputElement).value); setEditing(null)} if(e.key==='Escape') setEditing(null) }}/>
                      ) : String(r[h]??'')}
                    </td>
                  ))}
                  <td><button className="icon-btn red" onClick={()=>{ if(confirm('Excluir linha?')) deleteRow(realIdx)}}>×</button></td>
                </tr>
              )
            })}
            {pageRows.length===0 && <tr><td colSpan={headers.length+2} style={{textAlign:'center', padding:40, opacity:0.6}}>Nenhum dado • Importe uma planilha</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>{filtered.length===0?0:(page-1)*pageSize+1}-{(page)*pageSize>filtered.length?filtered.length:page*pageSize} de {filtered.length}</span>
        <div className="pager">
          <button disabled={page===1} onClick={()=>setPage(1)}>«</button>
          <button disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹</button>
          <span>{page}/{totalPages}</span>
          <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
          <button disabled={page===totalPages} onClick={()=>setPage(totalPages)}>»</button>
        </div>
      </div>
      <div className="footer-hint">DUPLO CLIQUE NUMA CÉLULA PARA EDITAR</div>
    </div>
  )
}
