"use client";

import { useState, useEffect } from "react";

export default function CTFSubmissionPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [flag, setFlag] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [mounted, setMounted] = useState(false); // Track client mount

  const questions = [
    { id: "csrf", name: "CSRF Challenge" },
    { id: "xss", name: "XSS Challenge" },
    { id: "metasploit", name: "Metasploit Challenge" },
  ];

  // Mark as mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/flag/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          flag,
          questionId: selectedQuestion 
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessage({ type: "error", text: data.message || "Flag validation failed" });
      } else {
        setMessage({ type: "success", text: data.message || "🎉 Correct Flag! Challenge Completed!" });
        setFlag("");
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#00ff99] font-mono p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 border-b-2 border-[#00ff99] pb-4">
          <h1 className="text-4xl font-bold mb-2 animate-pulse">CTF_FLAG_SUBMISSION</h1>
          <p className="text-cyan-400">// Capture The Flag - Submit Your Answer</p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 border-2 animate-pulse ${
              message.type === "success"
                ? "border-[#00ff99] bg-[#00ff99]/10 shadow-[0_0_20px_#00ff99]"
                : "border-red-500 bg-red-500/10 text-red-400 shadow-[0_0_20px_red]"
            }`}
          >
            <span className="text-2xl mr-2">{message.type === "success" ? "✓" : "✗"}</span>
            {message.text}
          </div>
        )}

        <div className="border-2 border-[#00ff99] p-8 shadow-[0_0_30px_#00ff99]/30">
          <form onSubmit={handleSubmitFlag} className="space-y-6">
            <h2 className="text-2xl font-bold mb-6">→ SUBMIT_YOUR_FLAG</h2>

            {/* Only render select after client mount to avoid hydration mismatch */}
            {mounted && (
              <div>
                <label className="block mb-2 text-cyan-400">SELECT_CHALLENGE:</label>
                <select
                  value={selectedQuestion}
                  onChange={(e) => setSelectedQuestion(e.target.value)}
                  className="w-full bg-[#0a0a0a] border-2 border-[#00ff99] p-3 focus:outline-none focus:shadow-[0_0_15px_#00ff99] transition-all"
                  required
                >
                  <option value="">-- Select Challenge --</option>
                  {questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block mb-2 text-cyan-400">ENTER_FLAG:</label>
              <input
                type="text"
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                className="w-full bg-transparent border-2 border-[#00ff99] p-4 text-lg focus:outline-none focus:shadow-[0_0_15px_#00ff99] transition-all"
                placeholder="HTB{your_discovered_flag_here}"
                required
              />
              <p className="text-xs text-cyan-400/60 mt-2">// Enter the flag you discovered from solving the challenge</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00ff99] text-[#0a0a0a] py-4 font-bold text-xl hover:shadow-[0_0_30px_#00ff99] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "⟳ VALIDATING..." : "» SUBMIT_FLAG"}
            </button>

            <div className="mt-6 p-4 border border-cyan-400/30 bg-cyan-400/5">
              {/* USER_CREDENTIALS_DISABLED_TEMPORARILY
                  ROLLBACK_INSTRUCTIONS: Replace guest mode with real user values once auth restored. */}
              <p className="text-cyan-400 text-sm">
                <span className="font-bold">ℹ INFO:</span> Auth temporarily disabled — using guest mode. No user email required.
              </p>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center text-cyan-400 text-sm">
          <p className="flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 bg-[#00ff99] rounded-full animate-pulse"></span>
            HTB-CLONE v1.0 | Status: ONLINE
          </p>
        </div>
      </div>
    </div>
  );
}
