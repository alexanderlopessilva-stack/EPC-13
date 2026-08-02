import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#00341a 0%,#0a5c2e 45%,#f0f7f0 45%)', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, fontWeight: 'bold', color: '#fff', letterSpacing: 1 }}>EPC13</div>
        <div style={{ fontSize: 15, color: '#d5ecd7', marginBottom: 40 }}>TR/BOAVENTURA/TEU/UT</div>

        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/aderencia" style={{ textDecoration: 'none' }}>
            <div style={cardEstilo(true)}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 'bold', fontSize: 17, color: '#007a33' }}>Aderência Semanal</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                Programação, TAGs, situação, devolutiva e emissão de PT
              </div>
            </div>
          </Link>

          <div style={cardEstilo(false)}>
            <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.4 }}>📄</div>
            <div style={{ fontWeight: 'bold', fontSize: 17, color: '#999' }}>Controle de Drafts</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>Em construção — chega em breve</div>
          </div>
        </div>

        <div style={{ marginTop: 50, fontSize: 12, color: '#eee' }}>EPC13 Online — v1</div>
      </div>
    </div>
  );
}

function cardEstilo(ativo) {
  return {
    background: '#fff',
    borderRadius: 16,
    padding: '28px 24px',
    width: 220,
    boxShadow: '0 6px 24px rgba(0,0,0,.15)',
    cursor: ativo ? 'pointer' : 'default',
    opacity: ativo ? 1 : 0.7,
    transition: '.15s',
  };
}
