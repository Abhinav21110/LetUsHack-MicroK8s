import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
	ArrowLeft,
	RefreshCw,
	CheckCircle2,
	Lightbulb,
	Shield,
	Code,
	AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { labApi } from "@/lib/labApi";

interface VictimSession {
	instanceId: string;
	email: string;
	flag: string;
	authToken: string;
}

const Lab3 = () => {
	const { toast } = useToast();
	const [session, setSession] = useState<VictimSession | null>(null);
	const [hintsUsed, setHintsUsed] = useState(0);
	const [isCompleted, setIsCompleted] = useState(false);
	const [attackCode, setAttackCode] = useState("");
	const [attackerLogs, setAttackerLogs] = useState<string[]>([]);
	const [capturedFlag, setCapturedFlag] = useState("");
	const [labAlreadyCompleted, setLabAlreadyCompleted] = useState(false);
	const [loading, setLoading] = useState(true);

	// const hints = [
	// 	"The victim is already logged in with cookies. Check the browser cookies to understand the authentication mechanism.",
	// 	"There's a hint cookie (auth_hint_*) that reveals the real authentication cookie name. Look for patterns.",
	// 	"The API endpoint /api/token/exchange accepts POST requests with the victim's email and returns sensitive data.",
	// 	"This API has a CSRF vulnerability - it doesn't check the origin of requests and allows CORS from any domain.",
	// 	"You need to craft an HTML page with JavaScript that automatically sends a POST request to the API using the victim's cookies.",
	// 	"The fetch API with credentials: 'include' will send cookies automatically. You can then read the response and extract the flag.",
	// ];

	const hints = [
		"Open DevTools → Application → Cookies and inspect cookies for this site. Look for any cookie names starting with auth_hint_ or similar.",
		"View the value of the hint cookie (it contains a clue). That hint points to the actual authentication cookie name used for the victim session.",
		"Once you know the real auth cookie name, find that cookie in the cookie list and note its value — that value is what the backend considers the user's authenticated session.",
		"The endpoint POST /api/token/exchange will return sensitive data (the flag) when called with the victim's email and the victim's auth cookie is present. This endpoint does not validate request origin or enforce CSRF protections.",
		"Because the victim is already authenticated in their browser, a request originating from a malicious page can be sent with the victim's cookies attached — the server will treat it as an authenticated request.",
		"Short process (no code): discover the hint cookie → identify the real auth cookie → craft a page that triggers the token-exchange request while the victim’s browser includes cookies → capture the response and exfiltrate the flag.",
	];

	// Check if lab is already completed
	useEffect(() => {
		const checkLabStatus = async () => {
			try {
				const user = await labApi.getCurrentUser();
				if (user) {
					const statuses = await labApi.getLabStatus(user.user_id, 2);
					const lab3Status = statuses.find((status) => status.level === 3);
					if (lab3Status?.solved) {
						setLabAlreadyCompleted(true);
					}
				}
			} catch (error) {
				console.error("Error checking lab status:", error);
			} finally {
				setLoading(false);
			}
		};

		checkLabStatus();
	}, []);

	const generateSession = () => {
		const instanceId = Math.random().toString(36).substring(2, 10);
		const email = `victim_${Math.floor(Math.random() * 1000)}@example.com`;
		const flag = `FLAG{csrf_${Math.random().toString(36).substring(2, 15)}}`;
		const authToken = btoa(
			JSON.stringify({
				user: email,
				exp: Date.now() + 3600000,
				secret: Math.random().toString(36),
			})
		);

		const newSession = { instanceId, email, flag, authToken };
		setSession(newSession);
		setHintsUsed(0);
		setIsCompleted(false);
		setAttackCode("");
		setAttackerLogs([]);
		setCapturedFlag("");

		// Set cookies (victim is auto-logged in)
		document.cookie = `auth_${instanceId}=${authToken}; path=/; max-age=3600`;
		document.cookie = `auth_hint_${instanceId}=cookie-name=auth_${instanceId}; path=/; max-age=3600`;

		// Add some decoy cookies
		document.cookie = `session_data=user_preferences; path=/; max-age=3600`;
		document.cookie = `tracking=${Math.random().toString(
			36
		)}; path=/; max-age=3600`;

		// Store session in localStorage (simulating backend)
		localStorage.setItem(
			`csrf_lab_session_${instanceId}`,
			JSON.stringify(newSession)
		);

		toast({
			title: "New Victim Session Created",
			description: `Email: ${email}`,
		});
	};

	useEffect(() => {
		generateSession();
	}, []);

	const handleReset = () => {
		generateSession();
		toast({
			title: "Lab Reset",
			description: "New victim session generated",
		});
	};

	const handleNextHint = () => {
		if (hintsUsed < hints.length) {
			setHintsUsed(hintsUsed + 1);
		}
	};

	// Simulated vulnerable API endpoint
	const simulateTokenExchangeAPI = async (
		email: string
	): Promise<{ flag?: string; error?: string }> => {
		// CSRF VULNERABILITY: No origin check, no CSRF token validation
		// In real scenario, this would be a backend endpoint

		if (!session) return { error: "No session" };

		// Check if auth cookie exists (simulating cookie validation)
		const cookies = document.cookie;
		const authCookiePattern = new RegExp(`auth_${session.instanceId}=([^;]+)`);
		const match = cookies.match(authCookiePattern);

		if (!match) {
			return { error: "Unauthorized - no valid auth cookie" };
		}

		// Validate email matches
		if (email !== session.email) {
			return { error: "Email mismatch" };
		}

		// VULNERABILITY: Return flag (simulating token exchange response)
		return { flag: session.flag };
	};

	const executeAttack = async () => {
		try {
			// Clear previous logs
			setAttackerLogs([]);
			setCapturedFlag("");

			// Expose API for the attack BEFORE creating iframe
			(window as any).Lab3API = {
				tokenExchange: simulateTokenExchangeAPI,
			};

			// Listen for attacker logs
			const messageHandler = (event: MessageEvent) => {
				if (event.data.type === "attacker_log") {
					const logData = event.data.data;
					console.log("Received attacker log:", logData);
					setAttackerLogs((prev) => [
						...prev,
						JSON.stringify(logData, null, 2),
					]);

					// Check if flag was captured
					if (logData.flag && logData.flag === session?.flag) {
						setCapturedFlag(logData.flag);

						// Update database before showing success toast
						const updateDatabase = async () => {
							try {
								const user = await labApi.getCurrentUser();
								if (user) {
									const success = await labApi.updateLabScore({
										user_id: user.user_id,
										lab_id: 2, // CSRF lab_id
										level: 3, // Lab 3
										score: 34,
										solved: true,
									});

									if (success) {
										setIsCompleted(true);
										toast({
											title: "Success!",
											description: "Flag captured via CSRF attack!",
										});
									} else {
										toast({
											variant: "destructive",
											title: "Error",
											description:
												"Failed to update lab score. Please try again.",
										});
									}
								}
							} catch (error) {
								console.error("Error updating lab score:", error);
								toast({
									variant: "destructive",
									title: "Error",
									description: "Failed to update lab score. Please try again.",
								});
							}
						};

						updateDatabase();
					}
				}
			};

			window.addEventListener("message", messageHandler);

			// Create an isolated iframe to execute the attack code
			const iframe = document.createElement("iframe");
			iframe.style.display = "none";
			document.body.appendChild(iframe);

			const iframeDoc =
				iframe.contentDocument || iframe.contentWindow?.document;
			if (!iframeDoc) throw new Error("Cannot access iframe");

			// Inject attack code into iframe
			iframeDoc.open();
			iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Attacker Page</title>
        </head>
        <body>
          <script>
            // Make API available to attack code
            window.API_ENDPOINT = '/api/token/exchange';
            window.VICTIM_EMAIL = '${session?.email}';
            
            // Simulated attacker log endpoint
            window.sendToAttacker = function(data) {
              console.log('Sending to attacker:', data);
              window.parent.postMessage({ type: 'attacker_log', data: data }, '*');
            };
            
            // Simulated vulnerable API (in real scenario, this would be on victim's domain)
            window.callTokenExchange = async function(email) {
              console.log('Calling token exchange for:', email);
              const response = await window.parent.Lab3API.tokenExchange(email);
              console.log('Token exchange response:', response);
              return response;
            };
          </script>
          <script>
            ${attackCode}
          </script>
        </body>
        </html>
      `);
			iframeDoc.close();

			toast({
				title: "Attack Code Executed",
				description: "Check the Attacker Dashboard below",
			});

			// Cleanup after 10 seconds (increased from 5)
			setTimeout(() => {
				window.removeEventListener("message", messageHandler);
				if (document.body.contains(iframe)) {
					document.body.removeChild(iframe);
				}
				delete (window as any).Lab3API;
			}, 10000);
		} catch (error) {
			toast({
				variant: "destructive",
				title: "Execution Error",
				description: error instanceof Error ? error.message : "Invalid code",
			});
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-background p-6 flex items-center justify-center">
				<div className="text-center">
					<RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
					<p className="text-muted-foreground">Loading lab status...</p>
				</div>
			</div>
		);
	}

	if (labAlreadyCompleted) {
		return (
			<div className="min-h-screen bg-background p-6">
				<div className="max-w-4xl mx-auto">
					<Link to="/">
						<Button variant="ghost" className="mb-6">
							<ArrowLeft className="w-4 h-4 mr-2" />
							Back to Labs
						</Button>
					</Link>

					<Card className="border-success/20 bg-success/5">
						<CardHeader>
							<div className="flex items-center gap-3">
								<CheckCircle2 className="w-8 h-8 text-success" />
								<div>
									<CardTitle className="text-2xl text-success">
										Lab 3 Already Completed!
									</CardTitle>
									<p className="text-muted-foreground mt-2">
										You have already successfully completed this lab and earned
										100 points.
									</p>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground mb-4">
								This lab cannot be accessed again once completed.
								Congratulations on completing all CSRF labs!
							</p>
							<Link to="/">
								<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
									Return to Lab Selection
								</Button>
							</Link>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-7xl mx-auto">
				<Link to="/">
					<Button variant="ghost" className="mb-6">
						<ArrowLeft className="w-4 h-4 mr-2" />
						Back to Labs
					</Button>
				</Link>

				<div className="grid lg:grid-cols-4 gap-6">
					{/* Left Sidebar */}
					<div className="lg:col-span-1 space-y-4">
						<Card className="border-primary/20">
							<CardHeader>
								<CardTitle className="text-lg flex items-center gap-2">
									<div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
									Victim Status
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2 text-sm">
								<div className="flex flex-col gap-1">
									<span className="text-muted-foreground">Email:</span>
									<span className="font-mono text-xs break-all">
										{session?.email}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Status:</span>
									<Badge
										variant="outline"
										className="bg-success/10 text-success">
										Logged In
									</Badge>
								</div>
								<div className="flex flex-col gap-1">
									<span className="text-muted-foreground">Instance ID:</span>
									<span className="font-mono text-xs">
										{session?.instanceId}
									</span>
								</div>
							</CardContent>
						</Card>

						<Card className="border-primary/20">
							<CardHeader>
								<CardTitle className="text-lg">Objective</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">
								Exploit the CSRF vulnerability in the token exchange API to
								steal the victim's flag without their knowledge.
							</CardContent>
						</Card>

						<Card className="border-primary/20">
							<CardHeader>
								<CardTitle className="text-lg flex items-center gap-2">
									<Lightbulb className="w-4 h-4 text-warning" />
									Hints ({hintsUsed}/{hints.length})
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{hints.slice(0, hintsUsed).map((hint, index) => (
									<div
										key={index}
										className="text-xs text-muted-foreground p-2 bg-secondary rounded">
										{index + 1}. {hint}
									</div>
								))}
								{hintsUsed < hints.length && (
									<Button
										onClick={handleNextHint}
										variant="outline"
										size="sm"
										className="w-full">
										Show Next Hint
									</Button>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Main Content */}
					<div className="lg:col-span-3 space-y-6">
						<Card className="border-primary/20">
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="text-2xl">
										Lab 3: CSRF Token Theft
									</CardTitle>
									<Button onClick={handleReset} variant="outline" size="sm">
										<RefreshCw className="w-4 h-4 mr-2" />
										Reset
									</Button>
								</div>
							</CardHeader>
						</Card>

						<Card className="border-primary/20">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Shield className="w-5 h-5" />
									Vulnerable Application Info
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="bg-secondary p-4 rounded-lg font-mono text-xs space-y-2">
									<p className="text-primary font-semibold">
										// Simulated Web Application
									</p>
									<p className="text-muted-foreground">
										Victim User: {session?.email}
									</p>
									<p className="text-muted-foreground">
										Authentication: Cookie-based (HttpOnly + hint cookie)
									</p>
									<p className="text-muted-foreground">
										Instance ID: {session?.instanceId}
									</p>
									<Separator className="my-2" />
									<p className="text-warning">⚠️ Vulnerable API Endpoint:</p>
									<p className="text-primary">POST /api/token/exchange</p>
									<p className="text-muted-foreground text-[10px]">
										Accepts: {`{ "email": "<user_email>" }`}
										<br />
										Returns: {`{ "flag": "FLAG{...}" }`}
										<br />
										CORS: Allows all origins (*)
										<br />
										CSRF Protection: ❌ None
									</p>
								</div>

								<div className="bg-danger/10 border border-danger/20 p-3 rounded-lg">
									<div className="flex items-start gap-2">
										<AlertTriangle className="w-4 h-4 text-danger mt-0.5" />
										<div>
											<p className="text-xs text-danger font-medium mb-1">
												Vulnerability Details:
											</p>
											<p className="text-xs text-muted-foreground">
												The API endpoint doesn't validate request origin and
												lacks CSRF tokens. An attacker can craft a malicious
												page that triggers the victim's browser to send
												authenticated requests and leak sensitive data.
											</p>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="border-primary/20">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Code className="w-5 h-5" />
									Boilerplate Code Template
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="bg-secondary p-4 rounded-lg font-mono text-xs overflow-x-auto">
									<pre className="text-primary">{`// CSRF Attack Boilerplate Template
// Step 1: Get victim's email
const victimEmail = window.VICTIM_EMAIL;

// Step 2: Call the vulnerable API
window.callTokenExchange(victimEmail)
  .then(response => response.json())
  .then(data => {
    // Step 3: Extract and send the flag
    if (data.flag) {
      window.sendToAttacker({ flag: data.flag });
    }
  })
  .catch(error => {
    console.error('Attack failed:', error);
  });`}</pre>
								</div>
								<p className="text-xs text-muted-foreground">
									💡 This template shows the basic structure. Modify it to
									create your attack payload.
								</p>
							</CardContent>
						</Card>

						<Card className="border-primary/20">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Code className="w-5 h-5" />
									Craft Your Attack
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<label className="text-sm font-medium mb-2 block">
										Malicious Code (HTML + JavaScript)
									</label>
									<Textarea
										placeholder={`// Craft your CSRF attack here\n// Example structure:\n// 1. Call the vulnerable API automatically\n// 2. Extract the flag from response\n// 3. Send it to window.sendToAttacker({ flag: ... })\n\n// Available helpers:\n// - window.VICTIM_EMAIL (victim's email)\n// - window.callTokenExchange(email) (calls vulnerable API)\n// - window.sendToAttacker(data) (logs captured data)`}
										value={attackCode}
										onChange={(e) => setAttackCode(e.target.value)}
										className="font-mono text-xs min-h-[200px] bg-background/50"
									/>
									<Button
										onClick={executeAttack}
										variant="outline"
										size="sm"
										className="mt-2"
										disabled={!attackCode}>
										Execute Attack
									</Button>
								</div>
							</CardContent>
						</Card>

						{hintsUsed >= hints.length && (
							<Card className="border-warning/20 bg-warning/5">
								<CardHeader>
									<CardTitle className="text-lg">Solution Code</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="bg-secondary p-4 rounded-lg font-mono text-xs overflow-x-auto">
										<pre className="text-primary">{`// Step 1: Automatically call the vulnerable API when page loads
(async function() {
  try {
    // Step 2: Get victim email from window variable
    const victimEmail = window.VICTIM_EMAIL;
    
    // Step 3: Call the token exchange API with victim's cookies
    const response = await window.callTokenExchange(victimEmail);
    
    // Step 4: Extract flag from response
    if (response.flag) {
      // Step 5: Exfiltrate to attacker server
      window.sendToAttacker({
        success: true,
        flag: response.flag,
        victim: victimEmail
      });
    }
  } catch (error) {
    window.sendToAttacker({
      error: error.message
    });
  }
})();`}</pre>
									</div>
									<p className="text-xs text-muted-foreground">
										💡 This attack exploits the lack of CSRF protection by
										automatically triggering an authenticated API call and
										reading the response due to permissive CORS settings.
									</p>
								</CardContent>
							</Card>
						)}

						<Card className="border-primary/20">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<AlertTriangle className="w-5 h-5 text-danger" />
									Attacker Dashboard
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="bg-secondary p-4 rounded-lg min-h-[100px] max-h-[300px] overflow-y-auto">
									{attackerLogs.length === 0 ? (
										<p className="text-xs text-muted-foreground italic">
											No logs yet. Execute your attack to see results...
										</p>
									) : (
										<div className="space-y-2">
											{attackerLogs.map((log, index) => (
												<div
													key={index}
													className="bg-background p-2 rounded border border-primary/10">
													<p className="text-xs text-success mb-1">
														📡 Incoming data:
													</p>
													<pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
														{log}
													</pre>
												</div>
											))}
										</div>
									)}
								</div>

								{capturedFlag && (
									<div className="bg-success/10 border border-success/20 p-3 rounded-lg">
										<p className="text-xs text-success font-medium mb-1">
											✅ Captured Flag:
										</p>
										<p className="font-mono text-sm text-success font-bold">
											{capturedFlag}
										</p>
									</div>
								)}
							</CardContent>
						</Card>

						{isCompleted && (
							<Card className="border-success bg-success/10">
								<CardContent className="p-6">
									<div className="flex items-center gap-3">
										<CheckCircle2 className="w-8 h-8 text-success" />
										<div>
											<h3 className="font-bold text-lg text-success">
												Lab Completed!
											</h3>
											<p className="text-sm text-muted-foreground">
												You've successfully exploited the CSRF vulnerability and
												captured the flag!
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						)}

						<Card className="border-primary/20 bg-primary/5">
							<CardHeader>
								<CardTitle className="text-lg">
									🛡️ Real-World Mitigation
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground space-y-2">
								<p>
									<strong>To prevent CSRF attacks:</strong>
								</p>
								<ul className="list-disc list-inside space-y-1 text-xs">
									<li>
										Implement anti-CSRF tokens (synchronizer token pattern)
									</li>
									<li>Use SameSite cookie attribute (Strict or Lax)</li>
									<li>Verify Origin and Referer headers</li>
									<li>Don't use CORS wildcard (*) for sensitive endpoints</li>
									<li>Require custom headers for state-changing requests</li>
									<li>Use POST for state changes, never GET</li>
								</ul>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Lab3;
