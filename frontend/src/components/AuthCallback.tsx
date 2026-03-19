import React, { useEffect, useState } from 'react';
import { setToken, getClaims } from '../auth';

// Magic link lands here with ?token=<jwt>
// Stores the token and redirects to the app root.
export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setError('No token in URL');
      return;
    }

    setToken(token);
    const claims = getClaims();
    if (!claims?.sub) {
      setError('Token is not a valid Mystira JWT');
      return;
    }

    // Clean the token out of the URL before redirecting
    window.location.replace('/');
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-red-400 text-sm">{error}</div>
          <a href="/" className="text-amber-500 text-xs hover:underline">Back to app</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="text-amber-500 text-sm">Signing in…</div>
    </div>
  );
}
