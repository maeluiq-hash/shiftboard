export default function PendingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f7' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '48px', width: '100%', maxWidth: '400px', border: '0.5px solid #e5e5e5', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ fontSize: '18px', fontWeight: '500', margin: '0 0 8px' }}>Compte en attente</h2>
        <p style={{ color: '#888', fontSize: '14px', margin: '0 0 24px' }}>
          Ton compte est en cours de validation par l'admin. Tu recevras un accès dès qu'il sera approuvé. Reviens plus tard !
        </p>
        <form action="/api/logout" method="POST">
          <button type="submit" style={{ padding: '10px 24px', background: 'white', border: '0.5px solid #e5e5e5', borderRadius: '8px', fontSize: '14px', color: '#888', cursor: 'pointer' }}>
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  )
}
