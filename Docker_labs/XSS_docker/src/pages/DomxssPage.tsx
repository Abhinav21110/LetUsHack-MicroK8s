import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { labApi } from "@/lib/labApi";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const DomxssPage = () => {
	const [showVulnerability, setShowVulnerability] = useState(false);
	const [showHint1, setShowHint1] = useState(false);
	const [showHint2, setShowHint2] = useState(false);
	const [showHint3, setShowHint3] = useState(false);
	const [isCompleted, setIsCompleted] = useState(false);
	const { toast } = useToast();
	const location = useLocation();
	const queryClient = useQueryClient();

	const { mutate: completeLevel } = useMutation({
		mutationFn: async () => {
			const user = await labApi.getCurrentUser();
			if (user) {
				return labApi.updateLabScore({
					user_id: user.user_id,
					lab_id: 1, // XSS lab_id
					level: 2, // This is level 2
					score: 33,
					solved: true,
				});
			}
			throw new Error("User not found");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["labStatuses"] });
			setIsCompleted(true);
			toast({
				title: "Success!",
				description:
					"You've successfully executed the script and your progress is saved!",
			});
		},
		onError: (error) => {
			console.error("Failed to update lab score", error);
			toast({
				title: "Error",
				description: "Failed to save your progress.",
				variant: "destructive",
			});
		},
	});

	useEffect(() => {
		// Define the xssSuccess function globally
		(window as any).xssSuccess = () => {
			if (isCompleted) return;
			const banner = document.createElement("div");
			banner.style.cssText =
				"position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#16a34a;color:white;padding:12px 20px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.4);font-weight:600;border:1px solid #22c55e;";
			banner.textContent = "✅ Success! Your script was executed.";
			document.body.appendChild(banner);

			completeLevel();

			setTimeout(() => {
				banner.remove();
				setShowVulnerability(true);
			}, 3000);
		};

		return () => {
			delete (window as any).xssSuccess;
		};
	}, [completeLevel, isCompleted]);

	useEffect(() => {
		const updateFromHash = () => {
			// With HashRouter, the URL is like /#/domxss#msg=...
			// window.location.hash will be #/domxss#msg=...
			const hashParts = window.location.hash.split("#");

			// After split: ['', 'domxss', 'msg=...']
			// The payload is the third element.
			const payloadHash = hashParts.length > 2 ? hashParts[2] : "";

			const params: Record<string, string> = {};
			payloadHash.split("&").forEach((part) => {
				const [key, value] = part.split("=");
				if (key) params[key] = value ? decodeURIComponent(value) : "";
			});

			const area = document.getElementById("injected-area");
			if (area) {
				if (params.msg) {
					// INTENTIONALLY VULNERABLE: Using innerHTML for educational purposes
					area.innerHTML = params.msg;
				} else {
					area.textContent = "No message.";
				}
			}
		};

		window.addEventListener("hashchange", updateFromHash);
		updateFromHash();

		return () => {
			window.removeEventListener("hashchange", updateFromHash);
		};
	}, [location]);

	return (
		<div className="min-h-screen text-foreground">
			<nav className="bg-black/20 backdrop-blur-sm border-b border-border">
				<div className="max-w-4xl mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<Link
							to="/"
							className="text-xl font-bold text-foreground hover:text-primary transition-colors">
							← Back to Lab
						</Link>
						<div className="text-sm text-muted-foreground">
							Exercise 2: DOM-based XSS
						</div>
					</div>
				</div>
			</nav>

			<div className="container mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
				<div className="bg-card/50 backdrop-blur-sm border border-border p-8 rounded-2xl shadow-lg">
					<h1 className="text-3xl font-bold mb-2 text-center">
						DOM-based XSS Exercise
					</h1>
					<p className="text-muted-foreground mb-6 text-center">
						This page demonstrates a DOM-based injection sink. Use the URL hash
						to inject content.
					</p>

					<div className="mb-6 space-y-3">
						<button
							type="button"
							className="text-left w-full p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/40"
							onClick={() => setShowHint1((v) => !v)}>
							<span className="font-semibold text-purple-300">Show Hint 1</span>
						</button>
						{showHint1 && (
							<div className="bg-muted/50 p-4 rounded-lg border border-border text-muted-foreground">
								This page reads the URL fragment (the #...) and injects it into the page as HTML. The fragment becomes rendered content.
							</div>
						)}

						<button
							type="button"
							className="text-left w-full p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/40"
							onClick={() => setShowHint2((v) => !v)}>
							<span className="font-semibold text-purple-300">Show Hint 2</span>
						</button>
						{showHint2 && (
							<div className="bg-muted/50 p-4 rounded-lg border border-border text-muted-foreground">
								You can place HTML inside the fragment - remember to URL-encode special characters when typing into the address bar so the browser treats them literally.
							</div>
						)}

						<button
							type="button"
							className="text-left w-full p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/40"
							onClick={() => setShowHint3((v) => !v)}>
							<span className="font-semibold text-purple-300">Show Hint 3</span>
						</button>
						{showHint3 && (
							<div className="bg-muted/50 p-4 rounded-lg border border-border text-muted-foreground">
								Put a small script into the hash and URL-encode it. Example form:

								Craft HTML with an event handler that calls{" "}
								<code className="bg-background px-1 py-0.5 rounded">
									#msg=&lt;script&gt;YOUR_JS_HERE&lt;/script&gt;
								</code>
								(when URL-encoded). First test with a simple alert() to confirm execution, then replace it with the lab's completion call.
							</div>
						)}
					</div>

					{!showVulnerability && (
						<div
							id="injected-area"
							className="p-4 bg-muted/50 rounded-lg border border-border text-muted-foreground">
							No message
						</div>
					)}
				</div>

				{showVulnerability && (
					<div className="mt-8 bg-success/20 border border-success rounded-xl p-6">
						<h3 className="text-xl font-bold text-success-foreground mb-2">
							Vulnerability Found!
						</h3>
						<p className="text-success-foreground">
							You successfully performed a **DOM-based XSS** attack. The
							JavaScript on this page takes input directly from the URL hash
							(the "source") and writes it into the HTML using `innerHTML` (the
							"sink") without any sanitization, allowing your script to run.
						</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default DomxssPage;
