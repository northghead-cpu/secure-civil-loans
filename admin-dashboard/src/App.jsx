import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import { supabase } from './supabaseClient'

function App() {
  const [count, setCount] = useState(0)
  const [loans, setLoans] = useState([])

  async function loadLoans() {
    const { data, error } = await supabase
      .from('loan_applications')
      .select('*')

    if (error) {
      console.log('Error loading loans:', error)
    } else {
      setLoans(data || [])
    }
  }

  useEffect(() => {
    loadLoans()
  }, [])

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>

        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
          </p>
        </div>

        <button
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <h2>Documentation</h2>
        </div>

        <div id="social">
          <h2>Connect with us</h2>
        </div>
      </section>

      <div className="ticks"></div>

      {/* ✅ LOAN DASHBOARD (FIXED TO MATCH YOUR REAL DB) */}
      <section style={{ padding: 20 }}>
        <h2>Loan Underwriting Dashboard</h2>

        {loans.length === 0 ? (
          <p>No loans found...</p>
        ) : (
          loans.map((loan) => (
            <div
              key={loan.id}
              style={{ border: '1px solid #ccc', margin: 10, padding: 10 }}
            >
              <p><b>Credit Score:</b> {loan.credit_score}</p>
              <p><b>Risk Level:</b> {loan.risk_level}</p>
              <p><b>Fraud Score:</b> {loan.fraud_score}</p>
              <p><b>Fraud Flag:</b> {loan.fraud_flag ? 'YES' : 'NO'}</p>
              <p><b>Requested Amount:</b> {loan.requested_amount}</p>
              <p><b>Interest Rate:</b> {loan.interest_rate}</p>
              <p><b>Decision Reason:</b> {loan.decision_reason}</p>
            </div>
          ))
        )}
      </section>

      <section id="spacer"></section>
    </>
  )
}

export default App