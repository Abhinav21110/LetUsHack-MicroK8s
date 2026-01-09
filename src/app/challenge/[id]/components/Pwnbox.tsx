"use client";

import { useState, useEffect } from "react";
import { Monitor, Play, Square, RotateCcw, Maximize, Minimize } from "lucide-react";
import Timer from "@/app/components/Timer";

// Add fullscreen CSS styles
if (typeof document !== 'undefined') {
	const style = document.createElement('style');
	style.textContent = `
		#pwnbox-container:fullscreen {
			width: 100vw !important;
			height: 100vh !important;
			display: flex !important;
			flex-direction: column !important;
			background: black !important;
		}
		#pwnbox-container:-webkit-full-screen {
			width: 100vw !important;
			height: 100vh !important;
			display: flex !important;
			flex-direction: column !important;
			background: black !important;
		}
		#pwnbox-container:-moz-full-screen {
			width: 100vw !important;
			height: 100vh !important;
			display: flex !important;
			flex-direction: column !important;
			background: black !important;
		}
		#pwnbox-container:-ms-fullscreen {
			width: 100vw !important;
			height: 100vh !important;
			display: flex !important;
			flex-direction: column !important;
			background: black !important;
		}
	`;
	if (!document.getElementById('pwnbox-fullscreen-styles')) {
		style.id = 'pwnbox-fullscreen-styles';
		document.head.appendChild(style);
	}
}

interface OSContainerInfo {
	containerId: string;
	osType: string;
	vncUrl: string;
	url: string;
	status: string;
	createdAt: string;
}

interface PwnboxProps {
	user: { user_id: string; name?: string } | null;
	onContainerChange?: (info: OSContainerInfo | null) => void;
	labTimeout?: number;
}

export default function Pwnbox({ user, onContainerChange, labTimeout = 60 }: PwnboxProps) {
	const [osContainer, setOSContainer] = useState<OSContainerInfo | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [bufferMessage, setBufferMessage] = useState<string | null>(null);

	// Check for active OS containers
	useEffect(() => {
		async function checkActiveOSContainers() {
			if (!user) return;
			
			try {
				const res = await fetch("/api/os/status");
				const data = await res.json();
				
				if (data.success && data.data.activeOSContainers.length > 0) {
					const info = data.data.activeOSContainers[0];
					setOSContainer(info);
					onContainerChange?.(info);
				}
			} catch (err) {
				console.error("Error checking active OS containers:", err);
			}
		}

		checkActiveOSContainers();
	}, [user]);

	const startOSContainer = async () => {
		if (!user) return;

		setLoading(true);
		setError(null);

		try {
			// Start the container and add minimum 6 second buffer for Ingress routing
			const startTime = Date.now();
			const res = await fetch("/api/os/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ osType: "debian" }),
			});

			const data = await res.json();

			if (data.success) {
				// Calculate remaining time to ensure minimum 6 seconds
				const elapsed = Date.now() - startTime;
				const minLoadTime = 6000; // 6 seconds minimum
				const remainingTime = Math.max(0, minLoadTime - elapsed);

				// Wait for remaining time with informative message
				if (remainingTime > 0) {
					setBufferMessage("Setting up Ingress routing for pwnbox...");
					await new Promise(resolve => setTimeout(resolve, remainingTime));
					setBufferMessage(null);
				}

				const info = {
					containerId: data.data.containerId,
					osType: "debian",
					vncUrl: data.data.vncUrl,
					url: data.data.url,
					status: "running",
					createdAt: new Date().toISOString(),
				} as OSContainerInfo;
				setOSContainer(info);
				onContainerChange?.(info);
			} else {
				setError(data.error || "Failed to start pwnbox");
			}
		} catch (err) {
			console.error("Error starting pwnbox:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to start pwnbox. Please try again."
			);
		} finally {
			setLoading(false);
		}
	};

	const stopOSContainer = async () => {
		if (!osContainer) return;

		setLoading(true);
		setError(null);

		try {
			const res = await fetch("/api/os/stop", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ containerId: osContainer.containerId }),
			});

			const data = await res.json();

			if (data.success) {
				// Add 6 second buffer for Ingress to update routing
				setBufferMessage("Stopping pwnbox and updating routing...");
				await new Promise(resolve => setTimeout(resolve, 6000));
				setBufferMessage(null);
				setOSContainer(null);
				onContainerChange?.(null);
				setIsFullscreen(false);
			} else {
				setError(data.error || "Failed to stop pwnbox");
			}
		} catch (err) {
			console.error("Error stopping pwnbox:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to stop pwnbox. Please try again."
			);
		} finally {
			setLoading(false);
		}
	};

	const restartOSContainer = async () => {
		if (!osContainer) return;

		setLoading(true);
		setError(null);

		try {
			const res = await fetch("/api/os/restart", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ containerId: osContainer.containerId }),
			});

			const data = await res.json();

			if (data.success) {
				// Add 6 second buffer for Ingress to update routing
				setBufferMessage("Restarting pwnbox and reconnecting...");
				await new Promise(resolve => setTimeout(resolve, 6000));
				setBufferMessage(null);
				const info = {
					...osContainer,
					containerId: data.data.containerId,
					vncUrl: data.data.vncUrl,
					url: data.data.url,
				} as OSContainerInfo;
				setOSContainer(info);
				onContainerChange?.(info);
			} else {
				setError(data.error || "Failed to restart pwnbox");
			}
		} catch (err) {
			console.error("Error restarting pwnbox:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to restart pwnbox. Please try again."
			);
		} finally {
			setLoading(false);
		}
	};

	const toggleFullscreen = async () => {
		if (!isFullscreen) {
			// Enter fullscreen mode
			const element = document.getElementById('pwnbox-container');
			if (element) {
				try {
					if (element.requestFullscreen) {
						await element.requestFullscreen();
					} else if ((element as any).webkitRequestFullscreen) {
						await (element as any).webkitRequestFullscreen();
					} else if ((element as any).mozRequestFullScreen) {
						await (element as any).mozRequestFullScreen();
					} else if ((element as any).msRequestFullscreen) {
						await (element as any).msRequestFullscreen();
					}
					setIsFullscreen(true);
				} catch (err) {
					console.error('Error entering fullscreen:', err);
				}
			}
		} else {
			// Exit fullscreen mode
			try {
				if (document.exitFullscreen) {
					await document.exitFullscreen();
				} else if ((document as any).webkitExitFullscreen) {
					await (document as any).webkitExitFullscreen();
				} else if ((document as any).mozCancelFullScreen) {
					await (document as any).mozCancelFullScreen();
				} else if ((document as any).msExitFullscreen) {
					await (document as any).msExitFullscreen();
				}
				setIsFullscreen(false);
			} catch (err) {
				console.error('Error exiting fullscreen:', err);
			}
		}
	};

	// Listen for fullscreen changes (when user presses ESC)
	useEffect(() => {
		const handleFullscreenChange = () => {
			const isCurrentlyFullscreen = !!(
				document.fullscreenElement ||
				(document as any).webkitFullscreenElement ||
				(document as any).mozFullScreenElement ||
				(document as any).msFullscreenElement
			);
			setIsFullscreen(isCurrentlyFullscreen);
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.addEventListener('mozfullscreenchange', handleFullscreenChange);
		document.addEventListener('MSFullscreenChange', handleFullscreenChange);

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
			document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
		};
	}, []);

	if (!user) return null;

	return (
		<div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
			<div className="flex items-center gap-3 mb-4">
				<Monitor className="text-cyan-400" size={24} />
				<h2 className="text-white text-2xl font-semibold">Pwnbox</h2>
				<span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded">
					Debian XFCE Desktop
				</span>
			</div>

			{error && (
				<div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-4">
					{error}
				</div>
			)}

			{bufferMessage && (
				<div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg mb-4 flex items-center gap-3">
					<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
					{bufferMessage}
				</div>
			)}

			{osContainer ? (
				<div className="space-y-4">
					{/* Control Panel */}
					<div className="bg-gray-800 p-4 rounded-lg">
						<div className="flex items-center justify-between mb-3">
							<div>
								<h3 className="text-green-400 font-semibold">Pwnbox Active</h3>
								<p className="text-gray-400 text-sm">
									Debian desktop environment ready for reconnaissance
								</p>
							</div>
							<div className="flex items-center gap-2">							{osContainer.createdAt && (
								<Timer 
									startTime={osContainer.createdAt} 
									durationMinutes={labTimeout}
									variant="os"
									onExpire={stopOSContainer}
								/>
							)}								<button
									onClick={restartOSContainer}
									disabled={loading}
									className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white p-2 rounded-lg transition-colors"
									title="Restart Pwnbox">
									<RotateCcw size={16} />
								</button>
								<button
									onClick={toggleFullscreen}
									className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
									title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
									{isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
								</button>
								<button
									onClick={stopOSContainer}
									disabled={loading}
									className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white p-2 rounded-lg transition-colors"
									title="Stop Pwnbox">
									<Square size={16} />
								</button>
							</div>
						</div>
						
						<div className="flex items-center gap-4 text-sm">
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 bg-green-400 rounded-full"></div>
								<span className="text-gray-300">Status: Running</span>
							</div>
							<div className="text-gray-400">
								Password: <span className="text-cyan-400 font-mono">debian</span>
							</div>
						</div>
					</div>

					{/* Desktop Interface */}
					<div 
						id="pwnbox-container"
						className={`${isFullscreen 
							? "fixed inset-0 z-50 bg-black flex flex-col overflow-hidden" 
							: "relative"
						}`}>
						{isFullscreen && (
							<div className="flex justify-between items-center px-4 py-2 bg-gray-900 flex-shrink-0">
								<h3 className="text-white text-lg font-semibold">Pwnbox - Fullscreen Mode</h3>
								<button
									onClick={toggleFullscreen}
									className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2">
									<Minimize size={16} />
									Exit Fullscreen
								</button>
							</div>
						)}
						
						<div className={`bg-black border border-gray-700 rounded-lg overflow-hidden ${
							isFullscreen ? "flex-1 w-full h-full border-0 rounded-none" : "h-96"
						}`}>
							<iframe
								src={osContainer.vncUrl}
								className="w-full h-full"
								title="Pwnbox Desktop Environment"
								allow="fullscreen"
								sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
								referrerPolicy="no-referrer-when-downgrade"
								style={{
									background: "linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1a 75%), linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)",
									backgroundSize: "20px 20px",
									backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px"
								}}
							/>
						</div>
						
						{!isFullscreen && (
							<div className="bg-gray-800 px-4 py-2 text-xs text-gray-400 border-t border-gray-700">
								<div className="flex justify-between items-center">
									<span>Desktop ready • Use mouse and keyboard • Tools pre-installed</span>
									<span>Auto-login as debian user</span>
								</div>
							</div>
						)}
					</div>

					{/* Usage Tips */}
					<div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg">
						<h4 className="text-purple-400 font-semibold mb-2">⚙️ Pwnbox Tips & Shortcuts</h4>
						<ul className="text-sm text-gray-300 space-y-2">
							<li>• Pre-installed tools: nmap, gobuster, nikto, burpsuite, metasploit, and more</li>
							<li>• Use Firefox ESR for web testing and browser-based tools</li>
							<li>• Open terminal with Ctrl+Alt+T or click terminal icon</li>
							<li>• Password for sudo operations: <span className="text-cyan-400 font-mono">debian</span></li>
							<li>• Use fullscreen mode for better visibility during testing</li>
							<li>• Desktop environment is automatically accessible in the interface below</li>
						</ul>
					</div>

					{/* Tools Information */}
					<div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
						<h4 className="text-green-400 font-semibold mb-2">Pre-installed Tools</h4>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-300">
							<div>• nmap</div>
							<div>• Firefox ESR</div>
							<div>• netcat</div>
							<div>• telnet</div>
							<div>• ping/traceroute</div>
							<div>• DNS utilities</div>
						</div>
						<p className="text-xs text-gray-400 mt-2">
							🖥️ Open terminal with Ctrl+Alt+T • Use fullscreen mode for better visibility
						</p>
					</div>
				</div>
			) : (
				<div className="space-y-4">
					<p className="text-gray-400">
						Launch a full Debian desktop environment with pre-installed penetration testing tools. 
						Perfect for reconnaissance and vulnerability assessment tasks.
					</p>
					
					<div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-lg">
						<h4 className="text-cyan-400 font-semibold mb-2">What's Included</h4>
						<div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
							<div>• XFCE Desktop Environment</div>
							<div>• Firefox ESR Browser</div>
							<div>• Network Analysis Tools</div>
							<div>• Web Application Testing</div>
							<div>• Password Cracking Tools</div>
							<div>• Exploitation Frameworks</div>
						</div>
					</div>

					<button
						onClick={startOSContainer}
						disabled={loading}
						className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-cyan-500/20">
						<Play size={18} />
						{loading ? "Starting Pwnbox... (Setting up environment)" : "Start Pwnbox"}
					</button>
				</div>
			)}
		</div>
	);
}