"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Pwnbox from "./components/Pwnbox";
import Timer from "@/app/components/Timer";
import {
	checkAuthStatus,
	startLabContainer,
	stopLabContainer,
	getContainerStatus,
} from "@/lib/client-auth";

interface Lab {
	lab_id: number;
	lab_name: string;
	lab_description: string;
	lab_tags: string[];
	level: number;
	max_score: number;
	created_at: string;
	updated_at: string;
}

interface ContainerInfo {
	containerId: string;
	labType: string;
	port: number;
	url: string;
	status: string;
	createdAt: string;
	podName?: string;
	namespace?: string;
}

export default function ChallengePage() {
	const router = useRouter();
	const params = useParams();
	const labId = params.id as string;

	const [lab, setLab] = useState<Lab | null>(null);
	const [loading, setLoading] = useState(true);
	const [containerLoading, setContainerLoading] = useState(false);
	const [activeContainer, setActiveContainer] = useState<ContainerInfo | null>(
		null
	);
	const [error, setError] = useState<string | null>(null);
	const [user, setUser] = useState<{ user_id: string; name?: string } | null>(
		null
	);
	const [labTimeout, setLabTimeout] = useState<number>(60);
	const [hasOpenTab, setHasOpenTab] = useState(false);
	const [flagStatuses, setFlagStatuses] = useState<{
		easy: string | null;
		medium: string | null;
		hard: string | null;
	}>({ easy: null, medium: null, hard: null });
	const [solvedFlags, setSolvedFlags] = useState<{
		easy?: { points: number; submittedAt: string };
		medium?: { points: number; submittedAt: string };
		hard?: { points: number; submittedAt: string };
	}>({});
	const [totalScore, setTotalScore] = useState(0);
	const [osContainer, setOsContainer] = useState<{ containerId: string } | null>(null);

	// Fetch nmap flag progress from existing lab_scores API
	const fetchNmapProgress = async () => {
		if (!labId) return;
		
		try {
			const res = await fetch('/api/lab_scores');
			const data = await res.json();
			
			if (data.success) {
				// Filter scores for this specific lab and nmap flags (levels 1-3)
				const nmapScores = data.lab_scores?.filter(
					(score: any) => score.lab_id === parseInt(labId) && score.level >= 1 && score.level <= 3 && score.solved
				) || [];
				
				// Map level to difficulty
				const difficultyMap: { [key: number]: 'easy' | 'medium' | 'hard' } = {
					1: 'easy',
					2: 'medium',
					3: 'hard'
				};
				
				const solved: any = {};
				let total = 0;
				
				nmapScores.forEach((score: any) => {
					const difficulty = difficultyMap[score.level];
					if (difficulty) {
						solved[difficulty] = {
							points: score.score,
							submittedAt: score.submitted_at
						};
						total += score.score;
					}
				});
				
				setSolvedFlags(solved);
				setTotalScore(total);
			}
		} catch (err) {
			console.error('Error fetching nmap progress:', err);
		}
	};
	
	const handleFlagSubmit = async (difficulty: string, flag: string) => {
		if (!flag.trim()) {
			setFlagStatuses(prev => ({ ...prev, [difficulty]: 'Please enter a flag' }));
			return;
		}

		if (!activeContainer) {
			setFlagStatuses(prev => ({ ...prev, [difficulty]: 'Lab container must be running' }));
			return;
		}

		try {
			const res = await fetch('/api/labs/validate-flag', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					labId,
					difficulty,
					flag: flag.trim(),
					podName: activeContainer.podName,
					namespace: activeContainer.namespace
				})
			});

			const data = await res.json();

			if (data.success && data.correct) {
				if (data.alreadySolved) {
					setFlagStatuses(prev => ({ ...prev, [difficulty]: `Already solved! ${data.points} points` }));
				} else {
					setFlagStatuses(prev => ({ ...prev, [difficulty]: `✅ Correct! +${data.points} points` }));
					// Refresh progress
					await fetchNmapProgress();
				}
				setTimeout(() => {
					setFlagStatuses(prev => ({ ...prev, [difficulty]: null }));
				}, 5000);
			} else {
				setFlagStatuses(prev => ({ ...prev, [difficulty]: '❌ Incorrect flag' }));
				setTimeout(() => {
					setFlagStatuses(prev => ({ ...prev, [difficulty]: null }));
				}, 3000);
			}
		} catch (err) {
			console.error('Flag submission error:', err);
			setFlagStatuses(prev => ({ ...prev, [difficulty]: 'Error submitting flag' }));
		}
	};

	// Check authentication
	useEffect(() => {
		async function checkAuth() {
			try {
				const authStatus = await checkAuthStatus();
				if (authStatus.authenticated && authStatus.user) {
					setUser(authStatus.user);
				} else {
					router.replace("/login?from=/dashboard");
				}
			} catch (err) {
				console.error("Auth check error:", err);
				router.replace("/login?from=/dashboard");
			}
		}

		async function fetchSettings() {
			try {
				const res = await fetch('/api/admin/settings');
				const data = await res.json();
				if (data.success && data.settings?.lab_timeout_minutes) {
					setLabTimeout(parseInt(data.settings.lab_timeout_minutes));
				}
			} catch (err) {
				console.error('Error fetching timeout setting:', err);
			}
		}

		checkAuth();
		fetchSettings();
	}, [router]);

	// Fetch lab details
	useEffect(() => {
		async function fetchLab() {
			try {
				const res = await fetch("/api/labs");
				const data = await res.json();
				if (data.success) {
					const foundLab = data.labs.find(
						(l: Lab) => l.lab_id.toString() === labId
					);
					if (foundLab) {
						setLab(foundLab);
					} else {
						setError("Lab not found");
					}
				}
			} catch (err) {
				console.error("Error fetching lab:", err);
				setError("Failed to load lab details");
			} finally {
				setLoading(false);
			}
		}

		if (labId) {
			fetchLab();
		}
	}, [labId]);

	// Check for active containers
	useEffect(() => {
		async function checkActiveContainers() {
			try {
				const data = await getContainerStatus();
				if (data.success && data.data.activeContainers.length > 0) {
					setActiveContainer(data.data.activeContainers[0]);
				}
			} catch (err) {
				console.error("Error checking active containers:", err);
			}
		}

		if (user) {
			checkActiveContainers();
		}
	}, [user]);

	// Fetch 3-flag progress when lab and user are loaded
	useEffect(() => {
		if (user && lab && (lab.lab_name.toLowerCase().includes('nmap') || lab.lab_name.toLowerCase().includes('linux'))) {
			fetchNmapProgress();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user, lab, labId]);

	// Tab tracking to prevent multiple tabs accessing the same container
	useEffect(() => {
		if (!activeContainer || !user) return;

		const tabKey = `container_tab_${activeContainer.containerId}`;
		const tabId = `${Date.now()}_${Math.random()}`;

		// Check if another tab already has this container open
		const existingTabId = localStorage.getItem(tabKey);
		if (existingTabId && existingTabId !== tabId) {
			setHasOpenTab(true);

			// Listen for storage changes to detect when the other tab closes
			const handleStorageChange = (e: StorageEvent) => {
				if (e.key === tabKey && !e.newValue) {
					setHasOpenTab(false);
				}
			};

			window.addEventListener("storage", handleStorageChange);
			return () => window.removeEventListener("storage", handleStorageChange);
		} else {
			// This tab can access the container
			setHasOpenTab(false);
			localStorage.setItem(tabKey, tabId);

			// Clean up when tab closes or component unmounts
			const cleanup = () => {
				const currentTabId = localStorage.getItem(tabKey);
				if (currentTabId === tabId) {
					localStorage.removeItem(tabKey);
				}
			};

			window.addEventListener("beforeunload", cleanup);

			return () => {
				cleanup();
				window.removeEventListener("beforeunload", cleanup);
			};
		}
	}, [activeContainer, user]);

	const isLinuxLab = (labName: string): boolean => {
		return labName.toLowerCase().includes("linux");
	};

	const getLabType = (labName: string): "xss" | "csrf" | "nmap" | null => {
		const name = labName.toLowerCase();
		if (name.includes("xss")) return "xss";
		if (name.includes("csrf")) return "csrf";
		if (name.includes("nmap")) return "nmap";
		// Linux OS containers are handled separately via Pwnbox component, not through startLabContainer
		return null;
	};

	const startChallenge = async () => {
		if (!lab || !user) return;

		const labType = getLabType(lab.lab_name);
		if (!labType) {
			setError("This challenge type is not supported for Docker deployment");
			return;
		}

		setContainerLoading(true);
		setError(null);

		try {
			// Start the container and add minimum 6 second buffer for Ingress routing
			const startTime = Date.now();
			const data = await startLabContainer(labType);

			if (data.success) {
				// Calculate remaining time to ensure minimum 6 seconds
				const elapsed = Date.now() - startTime;
				const minLoadTime = 6000; // 6 seconds minimum
				const remainingTime = Math.max(0, minLoadTime - elapsed);

				// Wait for remaining time if needed
				if (remainingTime > 0) {
					await new Promise(resolve => setTimeout(resolve, remainingTime));
				}

				setActiveContainer({
					containerId: data.data.containerId,
					labType: data.data.labType,
					port: data.data.port,
					url: data.data.url,
					status: "running",
					createdAt: data.data.createdAt || new Date().toISOString(),
					podName: data.data.podName,
					namespace: data.data.namespace,
				});
			} else {
				setError(data.error || "Failed to start challenge");
			}
		} catch (err) {
			console.error("Error starting challenge:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to start challenge. Please try again."
			);
		} finally {
			setContainerLoading(false);
		}
	};

	const stopChallenge = async () => {
		if (!activeContainer || !user) return;

		setContainerLoading(true);
		setError(null);

		try {
			if (!activeContainer.podName || !activeContainer.namespace) {
				throw new Error('Pod information missing');
			}
			const data = await stopLabContainer(activeContainer.podName, activeContainer.namespace);

			if (data.success) {
				// Clean up tab lock when container is stopped
				const tabKey = `container_tab_${activeContainer.containerId}`;
				localStorage.removeItem(tabKey);

				setActiveContainer(null);
				setHasOpenTab(false);
			} else {
				setError(data.error || "Failed to stop challenge");
			}
		} catch (err) {
			console.error("Error stopping challenge:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to stop challenge. Please try again."
			);
		} finally {
			setContainerLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-black flex items-center justify-center">
				<div className="text-white text-xl">Loading challenge...</div>
			</div>
		);
	}

	if (error && !lab) {
		return (
			<div className="min-h-screen bg-black flex items-center justify-center">
				<div className="text-center">
					<div className="text-red-400 text-xl mb-4">{error}</div>
					<Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
						Back to Dashboard
					</Link>
				</div>
			</div>
		);
	}

	if (!lab) return null;

	const labType = getLabType(lab.lab_name);
	const isDockerSupported = labType !== null;

	return (
		<div className="min-h-screen bg-black">
			<div className="max-w-4xl mx-auto px-6 py-12">
				{/* Header */}
				<div className="mb-8">
					<Link
						href="/dashboard"
						className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
						← Back to Dashboard
					</Link>
					<h1 className="text-white text-4xl font-bold mb-4">{lab.lab_name}</h1>
					<p className="text-gray-400 text-lg">{lab.lab_description}</p>
				</div>

				{/* Challenge Info */}
				<div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div>
							<h3 className="text-white font-semibold mb-2">Difficulty</h3>
							<span
								className={`px-3 py-1 rounded-lg text-sm font-semibold ${
									lab.level <= 2
										? "bg-green-500/10 text-green-400"
										: lab.level <= 4
										? "bg-yellow-500/10 text-yellow-400"
										: "bg-red-500/10 text-red-400"
								}`}>
								Level {lab.level}
							</span>
						</div>
						<div>
							<h3 className="text-white font-semibold mb-2">Points</h3>
							<span className="text-red-400 font-bold text-xl">
								{lab.max_score}
							</span>
						</div>
						<div>
							<h3 className="text-white font-semibold mb-2">Tags</h3>
							<div className="flex flex-wrap gap-2">
								{lab.lab_tags?.map((tag, index) => (
									<span
										key={index}
										className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm">
										{tag}
									</span>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Docker Container Management (not shown for Linux Fundamentals) */}
				{isDockerSupported && !isLinuxLab(lab?.lab_name || '') ? (
					<div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
						<h2 className="text-white text-2xl font-semibold mb-4">
							Challenge Environment
						</h2>

						{error && (
							<div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-4">
								{error}
							</div>
						)}

						{activeContainer ? (
							<div className="space-y-4">
								{hasOpenTab ? (
									<div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-4 rounded-lg">
										<div className="flex items-center justify-between">
											<div>
												<h3 className="font-semibold mb-2">
													Challenge Already Open in Another Tab
												</h3>
												<p className="text-sm">
													Your {activeContainer.labType.toUpperCase()} challenge
													is already being accessed in another browser tab.
													Close that tab to access it from here.
												</p>
											</div>
											<div className="flex items-center gap-3">
												<button
													disabled={true}
													className="bg-gray-600 text-gray-400 px-4 py-2 rounded-lg text-sm font-semibold cursor-not-allowed">
													Open Challenge (Locked)
												</button>
												<button
													onClick={stopChallenge}
													disabled={containerLoading}
													className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
													{containerLoading ? "Stopping..." : "Stop Challenge"}
												</button>
											</div>
										</div>
									</div>
								) : (
									<div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg">
										<div className="flex items-center justify-between">
											<div className="flex-1">
												<h3 className="font-semibold mb-2">
													Challenge Environment Active
												</h3>
												<p className="text-sm">
													Your {activeContainer.labType.toUpperCase()} challenge
													is running on port {activeContainer.port}
												</p>
											</div>
											<div className="flex items-center gap-3">
												{activeContainer.createdAt && (
													<Timer 
														startTime={activeContainer.createdAt} 
														durationMinutes={labTimeout}
														variant="lab"
														onExpire={stopChallenge}
													/>
												)}
												<a
													href={activeContainer.url}
													target="_blank"
													rel="noopener noreferrer"
													className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
													Open Challenge
												</a>
												<button
													onClick={stopChallenge}
													disabled={containerLoading}
													className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
													{containerLoading ? "Stopping..." : "Stop Challenge"}
												</button>
											</div>
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="space-y-4">
								<p className="text-gray-400">
									This challenge requires a Docker container environment. Click
									the button below to start your isolated challenge instance.
								</p>
								<button
									onClick={startChallenge}
									disabled={containerLoading}
									className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-red-500/20">
									{containerLoading
									? "Starting Challenge... (Setting up Ingress routing)"
										: `Start ${labType?.toUpperCase()} Challenge`}
								</button>
							</div>
						)}
					</div>
				) : (
					<div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-6 rounded-2xl mb-8">
						<h3 className="font-semibold mb-2">Static Challenge</h3>
						<p>
							This challenge doesn't require a Docker environment. You can work
							on it directly or access it through other means.
						</p>
					</div>
				)}

				{/* Instructions - Show before Pwnbox for nmap/linux challenges */}
				{(labType === "nmap" || isLinuxLab(lab?.lab_name || '')) && (
					<div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
						<h2 className="text-white text-2xl font-semibold mb-4">
							🎯 {isLinuxLab(lab?.lab_name || '') ? 'Linux Fundamentals Tips' : 'Lab Access Instructions'}
						</h2>
						<div className="text-gray-300 space-y-4">
							<div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
								<h4 className="text-blue-400 font-semibold mb-2">
									{isLinuxLab(lab?.lab_name || '') ? '📘 Basic Terminal Guide' : '🔍 Reconnaissance Guide'}
								</h4>
								{isLinuxLab(lab?.lab_name || '') ? (
									<>
										<p className="text-sm mb-3">Use the Pwnbox terminal (Ctrl+Alt+T) and these commands to navigate and discover files:</p>
										<div className="bg-gray-950/50 p-3 rounded mb-2">
											<p className="text-xs text-gray-400 mb-1">📂 Navigation and listing files</p>
											<code className="text-green-400 text-sm font-mono block">pwd; ls -la</code>
											  <code className="text-green-400 text-sm font-mono block mt-1">{`ls -la ~ | grep lf`}</code>
											  <code className="text-green-400 text-sm font-mono block mt-1">{`cat ~/README.txt`}</code>
											<p className="text-xs text-gray-500 mt-1 italic">Start with README.txt for helpful hints!</p>
										</div>
										<div className="bg-gray-950/50 p-3 rounded mb-2">
											<p className="text-xs text-gray-400 mb-1">🔍 Finding files by name or pattern</p>
											<code className="text-green-400 text-sm font-mono block">{`find /opt -name "*lf*" 2>/dev/null`}</code>
											  <code className="text-green-400 text-sm font-mono block mt-1">{`find /var -name ".*lf*" 2>/dev/null`}</code>
											  <code className="text-green-400 text-sm font-mono block mt-1">{`grep -i "easy" <<< $(ls -la ~)`}</code>
											<p className="text-xs text-gray-500 mt-1 italic">Use find for searching directories, grep for filtering output</p>
										</div>
										<div className="bg-gray-950/50 p-3 rounded mb-2">
											<p className="text-xs text-gray-400 mb-1">📄 Reading files and searching content</p>
											<code className="text-green-400 text-sm font-mono block">cat /path/to/file</code>
											  <code className="text-green-400 text-sm font-mono block mt-1">{`ls -la | less`}</code>
											  <code className="text-green-400 text-sm font-mono block mt-1">{`grep -R "LXF{" /opt 2>/dev/null`}</code>
											<p className="text-xs text-gray-500 mt-1 italic">Flags look like LXF{'{...}'} - use less to scroll long output</p>
										</div>
									</>
								) : (
									<>
										<p className="text-sm mb-3">Use the Pwnbox terminal below (Ctrl+Alt+T) to perform network reconnaissance and enumeration:</p>
										<div className="bg-gray-950/50 p-3 rounded mb-2">
											<p className="text-xs text-gray-400 mb-1">Step 1: Discover the gateway IP</p>
											<code className="text-green-400 text-sm font-mono block">
												route -n | grep '^0.0.0.0'
											</code>
											<p className="text-xs text-gray-500 mt-1 italic">Look for the Gateway column in the output</p>
										</div>
										<div className="bg-gray-950/50 p-3 rounded mb-2">
											<p className="text-xs text-gray-400 mb-1">Step 2: Scan for open ports and services</p>
											<code className="text-green-400 text-sm font-mono block">
												nmap -p [PORT] [GATEWAY_IP]
											</code>
											<p className="text-xs text-gray-500 mt-1 italic">Scan web service ports to identify running services</p>
										</div>
										<div className="bg-gray-950/50 p-3 rounded mb-2">
											<p className="text-xs text-gray-400 mb-1">Step 3: Enumerate HTTP services with nmap scripts</p>
											<code className="text-green-400 text-sm font-mono block">
												nmap --script [SCRIPT_NAME] -p [PORT] [GATEWAY_IP]
											</code>
											<p className="text-xs text-gray-500 mt-1 italic">Useful HTTP scripts: http-enum, http-title, http-headers, http-methods, http-backup-finder</p>
											<p className="text-xs text-cyan-400 mt-1">💡 Try different scripts to discover directories, files, and configurations</p>
										</div>
										<div className="bg-gray-950/50 p-3 rounded">
											<p className="text-xs text-gray-400 mb-1">Step 4: Access discovered resources</p>
											<code className="text-cyan-400 text-sm font-mono block">
												curl http://[GATEWAY_IP]/{user?.name?.toLowerCase().replace(/\s+/g, '-') || "user-name"}/nmap/[PATH]
											</code>
											<p className="text-xs text-gray-500 mt-1 italic">Enumerate directories and files you discover</p>
											<p className="text-xs text-yellow-400 mt-1">⚠️ Your lab base path: /{user?.name?.toLowerCase().replace(/\s+/g, '-') || "user-name"}/nmap/</p>
										</div>
									</>
								)}
							</div>
							<div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg">
								<h4 className="text-purple-400 font-semibold mb-2">
									🚩 Flag Hunting Objectives
								</h4>
								<p className="text-sm mb-2">Discover three hidden flags using progressive {isLinuxLab(lab?.lab_name || '') ? 'Linux file discovery' : 'reconnaissance'} techniques:</p>
								<ul className="text-sm space-y-2 mt-2 ml-4">
									{isLinuxLab(lab?.lab_name || '') ? (
										<>
											<li>• <span className="text-green-400 font-semibold">Easy Flag (33 pts)</span>: Explore your home directory and visible locations</li>
											<li>• <span className="text-yellow-400 font-semibold">Medium Flag (33 pts)</span>: Look under common system directories for practice files</li>
											<li>• <span className="text-red-400 font-semibold">Hard Flag (34 pts)</span>: Search for hidden files in temp-like locations</li>
										</>
									) : (
										<>
											<li>• <span className="text-green-400 font-semibold">Easy Flag (33 pts)</span>: Basic directory enumeration - find publicly accessible directories</li>
											<li>• <span className="text-yellow-400 font-semibold">Medium Flag (33 pts)</span>: API discovery - locate configuration endpoints and sensitive data</li>
											<li>• <span className="text-red-400 font-semibold">Hard Flag (34 pts)</span>: Advanced enumeration - use specialized nmap scripts to find hidden resources</li>
										</>
									)}
								</ul>
								<p className="text-xs text-cyan-400 mt-3">💡 Pro Tip: Each flag requires different enumeration techniques. Start simple and progress to advanced methods!</p>
							</div>
						</div>
					</div>
				)}

				{/* Flag Submission for Linux Fundamentals - Show right after instructions */}
		{isLinuxLab(lab?.lab_name || '') && osContainer && (
					<div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-white text-2xl font-semibold">🚩 Submit Linux Fundamentals Flags</h2>
							<div className="text-right">
								<div className="text-sm text-gray-400">Progress</div>
								<div className="text-2xl font-bold text-cyan-400">{totalScore}/100</div>
								<div className="text-xs text-gray-500">{Object.keys(solvedFlags).length}/3 flags found</div>
							</div>
						</div>
						<div className="space-y-4">
							{['easy','medium','hard'].map((difficulty) => {
								const points = difficulty === 'easy' ? 33 : difficulty === 'medium' ? 33 : 34;
								const isSolved = (solvedFlags as any)[difficulty];
								const hint = difficulty === 'easy' ? 'Hint: ls -la ~ | grep easy' : difficulty === 'medium' ? 'Hint: find /opt -name "*lf*" 2>/dev/null' : 'Hint: find /var -name ".*lf*" 2>/dev/null';

								return (
									<div key={difficulty} className={`bg-gray-800/50 border rounded-lg p-4 ${isSolved ? 'border-green-500/30 bg-green-500/5' : 'border-gray-700'}`}>
										<div className="flex items-center justify-between mb-2">
											<label className="text-sm font-semibold capitalize flex items-center gap-2" style={{
												color: difficulty === 'easy' ? '#4ade80' : difficulty === 'medium' ? '#fbbf24' : '#ef4444'
											}}>
												{difficulty === 'easy' ? '🟢' : difficulty === 'medium' ? '🟡' : '🔴'} {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Flag
												{isSolved && <span className="text-green-400 text-xs">✓ Solved</span>}
											</label>
											<span className={`text-xs font-semibold px-2 py-1 rounded ${isSolved ? 'bg-green-700/50 text-green-300' : 'bg-gray-700/50 text-gray-400'}`}>
												{isSolved ? `✓ ${points} pts` : `${points} points`}
											</span>
										</div>
										<div className="text-xs text-gray-400 mb-2">{hint}</div>
										<div className="flex gap-2">
											<input
												type="text"
												placeholder={isSolved ? '✓ Flag already submitted' : `LXF{${difficulty.toUpperCase()}_...}`}
												className={`flex-1 border rounded px-3 py-2 text-sm font-mono focus:outline-none ${
													isSolved ? 'bg-gray-900/30 border-gray-600 text-gray-500 cursor-not-allowed' : 'bg-gray-950/50 border-gray-600 text-white focus:border-cyan-500'
												}`}
												id={`linux-flag-${difficulty}`}
												disabled={!!isSolved}
											/>
											<button
												onClick={async () => {
													const input = document.getElementById(`linux-flag-${difficulty}`) as HTMLInputElement;
													const value = input?.value || '';
													if (!value.trim()) {
														setFlagStatuses(prev => ({ ...prev, [difficulty]: 'Please enter a flag' }));
														return;
													}
													try {
														const res = await fetch('/api/labs/validate-linux-flags', {
															method: 'POST',
															headers: { 'Content-Type': 'application/json' },
															body: JSON.stringify({ labId, difficulty, flag: value.trim(), containerId: osContainer.containerId })
														});
														const data = await res.json();
														if (data.success && data.correct) {
															setFlagStatuses(prev => ({ ...prev, [difficulty]: `✅ Correct! +${data.points} points` }));
															await fetchNmapProgress();
															setTimeout(() => setFlagStatuses(prev => ({ ...prev, [difficulty]: null })), 5000);
														} else {
															setFlagStatuses(prev => ({ ...prev, [difficulty]: '❌ Incorrect flag' }));
															setTimeout(() => setFlagStatuses(prev => ({ ...prev, [difficulty]: null })), 3000);
														}
													} catch (e) {
														setFlagStatuses(prev => ({ ...prev, [difficulty]: 'Error submitting flag' }));
													}
												}}
												disabled={!!isSolved || !osContainer}
												className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
													isSolved ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700 text-white'
												}`}
											>
												{isSolved ? 'Locked' : 'Submit'}
											</button>
										</div>
										{flagStatuses[difficulty as keyof typeof flagStatuses] && (
											<p className={`text-sm mt-2 ${flagStatuses[difficulty as keyof typeof flagStatuses]?.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
												{flagStatuses[difficulty as keyof typeof flagStatuses]}
											</p>
										)}
									</div>
								);
							})}
						</div>
						<div className="mt-4 pt-4 border-t border-gray-700 text-center">
							{totalScore === 100 ? (
								<p className="text-green-400 font-semibold text-lg">🎉 Challenge Complete! You earned all 100 points!</p>
							) : (
								<p className="text-sm text-gray-400">Complete all flags to earn <span className="text-cyan-400 font-semibold">100 points</span></p>
							)}
						</div>
					</div>
				)}

				{/* Pwnbox - Show for nmap and linux fundamentals */}
				{(labType === "nmap" || isLinuxLab(lab?.lab_name || '')) && (
					<div className="mb-8">
						<Pwnbox 
							user={user} 
							onContainerChange={(info) => setOsContainer(info ? { containerId: info.containerId } : null)} 
							labTimeout={labTimeout}
						/>
					</div>
				)}

				{/* Flag Submission - Only show for nmap challenges */}
				{labType === "nmap" && activeContainer && (
					<div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-white text-2xl font-semibold">
								🚩 Submit Flags
							</h2>
							<div className="text-right">
								<div className="text-sm text-gray-400">Progress</div>
								<div className="text-2xl font-bold text-cyan-400">
									{totalScore}/100
								</div>
								<div className="text-xs text-gray-500">
									{Object.keys(solvedFlags).length}/3 flags found
								</div>
							</div>
						</div>
						<div className="space-y-4">
							{['easy', 'medium', 'hard'].map((difficulty) => {
								const points = difficulty === 'easy' ? 33 : difficulty === 'medium' ? 33 : 34;
								const isSolved = solvedFlags[difficulty as keyof typeof solvedFlags];
								const hint = difficulty === 'easy'
									? 'Hint: Try enumerating public directories like uploads/'
									: difficulty === 'medium'
									? 'Hint: Inspect API endpoints and configs under /api/'
									: 'Hint: Use deeper enumeration to uncover hidden files in uploads';
								
								return (
									<div key={difficulty} className={`bg-gray-800/50 border rounded-lg p-4 ${
										isSolved ? 'border-green-500/30 bg-green-500/5' : 'border-gray-700'
									}`}>
										<div className="flex items-center justify-between mb-2">
											<label className="text-sm font-semibold capitalize flex items-center gap-2" style={{
												color: difficulty === 'easy' ? '#4ade80' : difficulty === 'medium' ? '#fbbf24' : '#ef4444'
											}}>
												{difficulty === 'easy' ? '🟢' : difficulty === 'medium' ? '🟡' : '🔴'} {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Flag
												{isSolved && <span className="text-green-400 text-xs">✓ Solved</span>}
											</label>
											<span className={`text-xs font-semibold px-2 py-1 rounded ${
												isSolved ? 'bg-green-700/50 text-green-300' : 'bg-gray-700/50 text-gray-400'
											}`}>
												{isSolved ? `✓ ${points} pts` : `${points} points`}
											</span>
										</div>
										<div className="text-xs text-gray-400 mb-2">{hint}</div>
										<div className="flex gap-2">
											<input
												type="text"
												placeholder={isSolved ? '✓ Flag already submitted' : `THM{${difficulty.toUpperCase()}_FLAG_...}`}
												className={`flex-1 border rounded px-3 py-2 text-sm font-mono focus:outline-none ${
													isSolved 
														? 'bg-gray-900/30 border-gray-600 text-gray-500 cursor-not-allowed' 
														: 'bg-gray-950/50 border-gray-600 text-white focus:border-cyan-500'
												}`}
												id={`flag-${difficulty}`}
												disabled={!!isSolved}
											/>
											<button
												onClick={() => {
													const input = document.getElementById(`flag-${difficulty}`) as HTMLInputElement;
													handleFlagSubmit(difficulty, input?.value || '');
												}}
												disabled={!!isSolved}
												className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
													isSolved
														? 'bg-gray-700 text-gray-500 cursor-not-allowed'
														: 'bg-cyan-600 hover:bg-cyan-700 text-white'
												}`}>
												{isSolved ? 'Locked' : 'Submit'}
											</button>
										</div>
										{flagStatuses[difficulty as keyof typeof flagStatuses] && (
											<p className={`text-sm mt-2 ${
												flagStatuses[difficulty as keyof typeof flagStatuses]?.startsWith('✅') 
													? 'text-green-400' 
													: 'text-red-400'
											}`}>
												{flagStatuses[difficulty as keyof typeof flagStatuses]}
											</p>
										)}
									</div>
								);
							})}
						</div>
						<div className="mt-4 pt-4 border-t border-gray-700 text-center">
							{totalScore === 100 ? (
								<p className="text-green-400 font-semibold text-lg">
									🎉 Challenge Complete! You earned all 100 points!
								</p>
							) : (
								<p className="text-sm text-gray-400">
									Complete all flags to earn <span className="text-cyan-400 font-semibold">100 points</span>
								</p>
							)}
						</div>
					</div>
				)}

				{/* Challenge Instructions */}
				{labType !== "nmap" && (
					<div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
						<h2 className="text-white text-2xl font-semibold mb-4">
							Instructions
						</h2>
						<div className="text-gray-300 space-y-4">
							<p>
								Complete this {lab.lab_name} challenge to earn {lab.max_score}{" "}
								points.
							</p>
							{isDockerSupported && (
								<div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
									<h4 className="text-blue-400 font-semibold mb-2">
										Docker Environment
									</h4>
									<ul className="text-sm space-y-1">
										<li>
											• Click "Start Challenge" to deploy your isolated
											environment
										</li>
										<li>
											• Each user can only have one active container at a time
										</li>
										<li>
											• The environment will be accessible via the provided URL
										</li>
										<li>
											• Only one browser tab can access the container at a time
										</li>
										<li>• Remember to stop the challenge when you're done</li>
									</ul>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
