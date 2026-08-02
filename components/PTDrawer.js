import { useState } from 'react';
import { supabase } from '../lib/supabase';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const PT_STATUS_OPCOES = [
  { v: '', label: '— sem status —' },
  { v: 'PTT', label: 'PTT' },
  { v: 'AREA_LIBERADA', label: 'Área liberada' },
  { v: 'FALTA_VERIFICACAO', label: 'Falta verificação' },
  { v: 'ELABORAR', label: 'Elaborar' },
  { v: 'SERVICO_FINALIZADO', label: 'Serviço finalizado' },
  { v: 'REEMITIR', label: 'Reemitir' },
  { v: 'PT_DIA_ANTERIOR', label: 'PT do dia anterior' },
  { v: 'CUSTOM', label: '✏️ Outro (digitar)' },
];
const PT_LABEL = Object.fromEntries(PT_STATUS_OPCOES.map(o => [o.v, o.label]));
const PT_COM_CHECK = ['ELABORAR', 'REEMITIR'];

export default function PTDrawer({ aberto, onClose, itens, onAtualizado }) {
  const [diaAtivo, setDiaAtivo] = useState('Seg');

  if (!aberto) return null;

  async function atualizarStatus(item, novoStatus) {
    const ptAtual = item.emissao_pt || {};
    const infoAtual = ptAtual[diaAtivo] || {};
    const novoInfo = { ...infoAtual, status: novoStatus };
    if (!PT_COM_CHECK.includes(novoStatus)) novoInfo.feito = false;
    const novoPT = { ...ptAtual, [diaAtivo]: novoInfo };
    await supabase.from('itens').update({ emissao_pt: novoPT }).eq('id', item.id);
    onAtualizado();
  }
  async function atualizarCustom(item, texto) {
    const ptAtual = item.emissao_pt || {};
    const novoPT = { ...ptAtual, [diaAtivo]: { ...(ptAtual[diaAtivo] || {}), textoCustom: texto } };
    await supabase.from('itens').update({ emissao_pt: novoPT }).eq('id', item.id);
    onAtualizado();
  }
  async function alternarFeito(item) {
    const ptAtual = item.emissao_pt || {};
    const infoAtual = ptAtual[diaAtivo] || {};
    const novoPT = { ...ptAtual, [diaAtivo]: { ...infoAtual, feito: !infoAtual.feito } };
    await supabase.from('itens').update({ emissao_pt: novoPT }).eq('id', item.id);
    onAtualizado();
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 800 }}>
      <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 420, maxWidth: '92vw',
        background: '#f4f9f4', boxShadow: '-6px 0 24px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg,#00341a,#007a33)', color: '#fff', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>📄 Emissão de PT</b>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: 10, background: '#e3f0e3', flexWrap: 'wrap' }}>
          {DIAS.map(d => (
            <button key={d} onClick={() => setDiaAtivo(d)}
              style={{ background: d === diaAtivo ? '#1b5e20' : '#fff', color: d === diaAtivo ? '#fff' : '#3a5a3a',
                border: '1.5px solid ' + (d === diaAtivo ? '#1b5e20' : '#c8dfc8'), borderRadius: 16, padding: '6px 13px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>
              {d}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          <div style={{ fontSize: 12, color: '#3a5a3a', fontWeight: 'bold', marginBottom: 10 }}>
            {itens.length} draft(s) — {diaAtivo}
          </div>
          {itens.map(it => {
            const info = (it.emissao_pt || {})[diaAtivo] || {};
            const mostraCheck = PT_COM_CHECK.includes(info.status);
            return (
              <div key={it.id} style={{ background: '#fff', border: '1px solid #dde8dd', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  <b style={{ color: '#1b5e20' }}>ITEM {it.item}</b> | DRAFT {it.draft || '-'}<br />{it.assunto}
                </div>
                <select value={info.status || ''} onChange={e => atualizarStatus(it, e.target.value)}
                  style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1.5px solid #c8dfc8', borderRadius: 7, marginBottom: 8 }}>
                  {PT_STATUS_OPCOES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
                {info.status === 'CUSTOM' && (
                  <input placeholder="Descreva o status..." value={info.textoCustom || ''} onChange={e => atualizarCustom(it, e.target.value)}
                    style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1.5px solid #ffcc80', borderRadius: 7, marginBottom: 8, boxSizing: 'border-box' }} />
                )}
                {mostraCheck && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff8e1', border: '1.5px solid #ffd54f', borderRadius: 8, padding: '8px 12px' }}>
                    <div onClick={() => alternarFeito(it)}
                      style={{ width: 32, height: 32, flexShrink: 0, border: '2.5px solid #b8860b', borderRadius: 6,
                        background: info.feito ? '#fff3e0' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 'bold', color: '#c0392b' }}>
                      {info.feito ? 'X' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#7a5c00', fontWeight: 'bold' }}>
                      {info.feito ? 'Já feito' : 'Ainda não feito'} — marque quando concluir "{PT_LABEL[info.status]}"
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {itens.length === 0 && <div style={{ textAlign: 'center', color: '#999', padding: 30 }}>Nenhum item nesta semana.</div>}
        </div>
      </div>
    </div>
  );
}
