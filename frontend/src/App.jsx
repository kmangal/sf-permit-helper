import { useState } from "react";
import "./App.css";

function App() {
  const [description, setDescription] = useState("");
  const [permits, setPermits] = useState([]);
  const [reasoning, setReasoning] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;

    setLoading(true);
    setError(null);
    setPermits([]);
    setReasoning("");
    setSearched(false);

    try {
      const res = await fetch("/api/permits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setPermits(data.permits);
      setReasoning(data.reasoning || "");
      setSearched(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>SF Permit Helper</h1>
      <p className="subtitle">
        Describe what you want to do and we'll help you find the permits you
        need.
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. I want to add a deck to the back of my house..."
          rows={4}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Find Permits"}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {searched && (
        <div className="results">
          {reasoning && (
            <div className="reasoning">
              <h2>Analysis</h2>
              <p>{reasoning}</p>
            </div>
          )}
          <h2>Permits You May Need</h2>
          {permits.length === 0 ? (
            <p>No permits found for that description.</p>
          ) : (
            permits.map((permit, i) => (
              <div key={i} className="permit-card">
                <h3>{permit.name}</h3>
                <p>{permit.description}</p>
                {permit.link && (
                  <a href={permit.link} target="_blank" rel="noopener noreferrer">
                    More info
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default App;
