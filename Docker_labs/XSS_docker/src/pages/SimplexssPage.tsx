import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { labApi } from "@/lib/labApi";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const SimplexssPage = () => {
	const [comments, setComments] = useState([
		{ username: "Alice", comment: "<p>Welcome to the guestbook.</p>" },
	]);
	const [showVulnerability, setShowVulnerability] = useState(false);
	const [isCompleted, setIsCompleted] = useState(false);
	const { toast } = useToast();
	const [showHint1, setShowHint1] = useState(false);
	const [showHint2, setShowHint2] = useState(false);
	const [showHint3, setShowHint3] = useState(false);
	const queryClient = useQueryClient();

	const { mutate: completeLevel } = useMutation({
		mutationFn: async () => {
			const user = await labApi.getCurrentUser();
			if (user) {
				return labApi.updateLabScore({
					user_id: user.user_id,
					lab_id: 1, // XSS lab_id
					level: 1, // This is level 1
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
			if (isCompleted) return; // Prevent multiple submissions
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

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const username = formData.get("username") as string;
		const comment = formData.get("comment") as string;

		setComments([{ username, comment }, ...comments]);
		e.currentTarget.reset();
	};

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
							Exercise 1: Stored DOM XSS
						</div>
					</div>
				</div>
			</nav>

			<div className="container mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
				<div className="bg-card/50 backdrop-blur-sm border border-border p-8 rounded-2xl shadow-lg">
					<h1 className="text-3xl font-bold mb-2 text-center">
						Stored DOM XSS Exercise
					</h1>
					<p className="text-muted-foreground mb-6 text-center">
						Leave a comment below! This guestbook uses `innerHTML` without
						sanitization.
					</p>

					<div className="mb-6 space-y-3">
						<button
							type="button"
							className="text-left w-full p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/40"
							onClick={() => setShowHint1((v) => !v)}>
							<span className="font-semibold text-blue-300">Show Hint 1</span>
						</button>
						{showHint1 && (
							<div className="bg-muted/50 p-4 rounded-lg border border-border text-muted-foreground">
								Your comment is rendered as HTML (not escaped). Anything you type can change DOM structure or add attributes that run JavaScript.
							</div>
						)}

						<button
							type="button"
							className="text-left w-full p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/40"
							onClick={() => setShowHint2((v) => !v)}>
							<span className="font-semibold text-blue-300">Show Hint 2</span>
						</button>
						{showHint2 && (
							<div className="bg-muted/50 p-4 rounded-lg border border-border text-muted-foreground">
								Elements that load resources (images, scripts, iframes) can trigger events automatically - use attributes like onerror, onload, or onclick to run code when those events fire.
							</div>
						)}

						<button
							type="button"
							className="text-left w-full p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/40"
							onClick={() => setShowHint3((v) => !v)}>
							<span className="font-semibold text-blue-300">Show Hint 3</span>
						</button>
						{showHint3 && (
							<div className="bg-muted/50 p-4 rounded-lg border border-border text-muted-foreground">
								Create an element whose resource will fail to load, and attach an onerror handler that calls the page completion function. Example structure:
								<code className="bg-background px-1 py-0.5 rounded">
								&lt;img src="BROKEN-URL"onerror="CALL_SUCCESS()"&gt;
								</code>
								replace BROKEN-URL with something that won't load and CALL_SUCCESS() with the function the lab exposes.
							</div>
						)}

						{showHint3 && (
							<div className="mt-3 bg-background/40 p-4 rounded-lg border border-dashed">
								<p className="font-semibold mb-2">Solution</p>
								<code className="bg-background px-2 py-1 rounded break-all">
									&lt;img src=x onerror="window.xssSuccess()"&gt;
								</code>
							</div>
						)}
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<Label htmlFor="username">Name</Label>
							<Input
								type="text"
								id="username"
								name="username"
								placeholder="Your Name"
								required
								className="mt-1"
							/>
						</div>
						<div>
							<Label htmlFor="comment">Comment</Label>
							<Textarea
								id="comment"
								name="comment"
								rows={4}
								placeholder="Write your comment here..."
								required
								className="mt-1"
							/>
						</div>
						<Button type="submit" className="w-full">
							Post Comment
						</Button>
					</form>
				</div>

				{showVulnerability && (
					<div className="mt-8 bg-success/20 border border-success rounded-xl p-6">
						<h3 className="text-xl font-bold text-success-foreground mb-2">
							Vulnerability Found!
						</h3>
						<p className="text-success-foreground">
							You successfully performed a **Stored DOM-based XSS** attack. The
							application stored your malicious input and then used the unsafe
							`innerHTML` property to write it into the page, allowing your
							script to execute.
						</p>
					</div>
				)}

				<div className="mt-8 bg-card/50 backdrop-blur-sm border border-border p-8 rounded-2xl shadow-lg">
					<h2 className="text-2xl font-bold mb-4 text-center">Comments</h2>
					<div className="space-y-6">
						{comments.map((comment, index) => (
							<div
								key={index}
								className="p-4 bg-muted/50 rounded-lg border border-border">
								<p className="font-semibold text-foreground">
									{comment.username}
								</p>
								<div
									className="text-muted-foreground mt-1"
									dangerouslySetInnerHTML={{ __html: comment.comment }}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

export default SimplexssPage;
