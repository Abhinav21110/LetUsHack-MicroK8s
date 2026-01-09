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
	XCircle,
	Lightbulb,
	Code,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import LocalAPI from "@/lib/localApi";
import { labApi } from "@/lib/labApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface UserCredentials {
	email: string;
	password: string;
}

const Lab1 = () => {
	const { toast } = useToast();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [credentials, setCredentials] = useState<UserCredentials>({
		email: "",
		password: "",
	});
	const [userInput, setUserInput] = useState({ email: "", password: "" });
	const [hintsUsed, setHintsUsed] = useState(0);
	const [maliciousCode, setMaliciousCode] = useState("");

	const { data: user } = useQuery({
		queryKey: ["currentUser"],
		queryFn: labApi.getCurrentUser,
	});

	const { data: labStatuses, isLoading: isStatusLoading } = useQuery({
		queryKey: ["labStatuses", user?.user_id],
		queryFn: () => labApi.getLabStatus(user!.user_id, 2),
		enabled: !!user,
	});

	const labAlreadyCompleted = labStatuses?.find(
		(status) => status.level === 1
	)?.solved;

	const updateScoreMutation = useMutation({
		mutationFn: labApi.updateLabScore,
		onSuccess: () => {
			toast({
				title: "Success!",
				description: "You've successfully extracted the credentials!",
			});
			// Invalidate the lab statuses query to refetch the data on the Home page
			queryClient.invalidateQueries({ queryKey: ["labStatuses"] });
			navigate("/"); // Navigate back to home to see the unlocked lab
		},
		onError: () => {
			toast({
				variant: "destructive",
				title: "Error",
				description: "Failed to update lab score. Please try again.",
			});
		},
	});

	// const hints = [
	// 	"Check the browser's Application/Storage tab - the vulnerable app stores data locally.",
	// 	"Look through localStorage entries for suspicious keys that might contain user data.",
	// 	"The stored data might be encoded - check for base64 encoded strings (they often end with = or ==).",
	// 	"Use JavaScript's atob() function to decode base64 strings. Inspect the JSON structure carefully.",
	// ];
	const hints = [
		"Open your browser DevTools → Application (Storage) and inspect Local Storage for keys created by the app. Look for keys that seem to hold session or metadata.",
		"View the value of the suspicious key — it’s not plain text credentials but a JSON string. Try copying the value into a JSON viewer or using the console to inspect its structure.",
		"Inside that JSON, notice short/unfriendly property names (e.g. single letters) instead of 'email' or 'password'. These hold the actual credential values.",
		"Those property values look encoded (long alphanumeric strings and sometimes trailing ‘=’ padding). That’s a common sign of base64 — try decoding those strings with a base64 decoder.",
		"Combine parsing the stored JSON and decoding the encoded fields to reveal the email and password. Once you have them, submit them in the solution form to complete the lab.",
	];

	const generateCredentials = async () => {
		LocalAPI.clearDatabase();
		const randomEmail = `user${Math.floor(Math.random() * 10000)}@gmail.com`;
		const randomPassword = Math.random().toString(36).slice(-8);
		setCredentials({ email: randomEmail, password: randomPassword });
		setUserInput({ email: "", password: "" });
		setHintsUsed(0);

		// Simulate vulnerable endpoint call
		await simulateVulnerableRequest(randomEmail, randomPassword);
	};

	const simulateVulnerableRequest = async (email: string, password: string) => {
		// This simulates a CSRF-vulnerable POST request that stores credentials
		await LocalAPI.storeCredentials(email, password);
		toast({
			title: "User Action Simulated",
			description: "Credentials stored in local database",
		});
	};

	useEffect(() => {
		generateCredentials();
	}, []);

	const handleReset = () => {
		generateCredentials();
		toast({
			title: "Lab Reset",
			description: "New credentials generated",
		});
	};

	const handleNextHint = () => {
		if (hintsUsed < hints.length) {
			setHintsUsed(hintsUsed + 1);
		}
	};

	const handleSubmit = async () => {
		if (
			userInput.email === credentials.email &&
			userInput.password === credentials.password
		) {
			if (user) {
				updateScoreMutation.mutate({
					user_id: user.user_id,
					lab_id: 2, // CSRF lab_id
					level: 1, // Lab 1
					score: 33,
					solved: true,
				});
			}
		} else {
			toast({
				variant: "destructive",
				title: "Incorrect",
				description: "The credentials don't match. Try again!",
			});
		}
	};

	if (isStatusLoading) {
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
										Lab 1 Already Completed!
									</CardTitle>
									<p className="text-muted-foreground mt-2">
										You have already successfully completed this lab and earned
										50 points.
									</p>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground mb-4">
								This lab cannot be accessed again once completed. Try the next
								lab in the sequence!
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

	const isCompleted = updateScoreMutation.isSuccess;

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
									User Status
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Status:</span>
									<Badge
										variant="outline"
										className="bg-success/10 text-success">
										Logged In
									</Badge>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Session:</span>
									<span className="font-mono text-xs">Active</span>
								</div>
							</CardContent>
						</Card>

						<Card className="border-primary/20">
							<CardHeader>
								<CardTitle className="text-lg">Objective</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">
								Extract the victim's email and password by analyzing the
								CSRF-vulnerable requests made during user interactions.
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
										Lab 1: Credential Extraction
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
									<Code className="w-5 h-5" />
									Exploit Area
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="bg-secondary p-4 rounded-lg font-mono text-sm">
									<p className="text-muted-foreground mb-2">
										# Simulated Vulnerable Application
									</p>
									<p className="text-primary">
										User performs actions on the vulnerable site...
									</p>
									<Button
										onClick={() =>
											simulateVulnerableRequest(
												credentials.email,
												credentials.password
											)
										}
										variant="outline"
										size="sm"
										className="mt-3">
										Trigger User Action
									</Button>
								</div>

								<Separator />

								<div>
									<label className="text-sm font-medium mb-2 block">
										Write Your Malicious Code
									</label>
									<Textarea
										placeholder="// Write your exploit code here&#10;// Example: document.cookie, console.log(), etc."
										value={maliciousCode}
										onChange={(e) => setMaliciousCode(e.target.value)}
										className="font-mono text-xs min-h-[150px] bg-background/50"
									/>
									<Button
										onClick={() => {
											try {
												eval(maliciousCode);
												toast({
													title: "Code Executed",
													description: "Check console for results",
												});
											} catch (error) {
												toast({
													variant: "destructive",
													title: "Execution Error",
													description:
														error instanceof Error
															? error.message
															: "Invalid code",
												});
											}
										}}
										variant="outline"
										size="sm"
										className="mt-2"
										disabled={!maliciousCode}>
										Execute Code
									</Button>
								</div>

								<p className="text-xs text-muted-foreground">
									Monitor the browser console and network tab to extract
									credentials.
								</p>
							</CardContent>
						</Card>

						<Card className="border-primary/20">
							<CardHeader>
								<CardTitle>Solution</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="text-sm text-muted-foreground p-4 bg-muted/10 rounded-lg mb-4">
									💡 Use the hints above and the exploit area to extract the
									credentials
								</div>

								<Separator />

								<div className="grid md:grid-cols-2 gap-4">
									<div>
										<label className="text-sm font-medium mb-2 block">
											Email
										</label>
										<Input
											type="text"
											placeholder="Enter extracted email"
											value={userInput.email}
											onChange={(e) =>
												setUserInput({ ...userInput, email: e.target.value })
											}
											className="font-mono"
										/>
									</div>
									<div>
										<label className="text-sm font-medium mb-2 block">
											Password
										</label>
										<Input
											type="text"
											placeholder="Enter extracted password"
											value={userInput.password}
											onChange={(e) =>
												setUserInput({ ...userInput, password: e.target.value })
											}
											className="font-mono"
										/>
									</div>
								</div>
								<Button
									onClick={handleSubmit}
									className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
									disabled={isCompleted}>
									{isCompleted ? (
										<>
											<CheckCircle2 className="w-4 h-4 mr-2" />
											Completed!
										</>
									) : (
										"Submit Solution"
									)}
								</Button>
							</CardContent>
						</Card>

						{isCompleted && (
							<Card className="border-success bg-success/10">
								<CardContent className="p-6">
									<div className="flex items-center gap-3">
										<CheckCircle2 className="w-8 h-8 text-success" />
										<div>
											<h3 className="font-bold text-lg text-success">
												You've successfully extracted the credentials. Ready for
												the next challenge?
											</h3>
											<p className="text-sm text-muted-foreground">
												You've successfully extracted the credentials. Ready for
												the next challenge?
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Lab1;
