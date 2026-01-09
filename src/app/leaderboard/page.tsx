"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../dashboard/components/Header";
import { Trophy, Medal, Award, Crown, RefreshCw } from "lucide-react";

interface LeaderboardEntry {
	rank: number;
	user_id: string;
	name: string;
	total_score: number;
	challenges_solved: number;
}

export default function LeaderboardPage() {
	const router = useRouter();
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string>("");
	const [user, setUser] = useState<{ user_id: string } | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [userIdSearch, setUserIdSearch] = useState("");

	useEffect(() => {
		async function checkAuth() {
			try {
				const res = await fetch("/api/auth/check");
				if (!res.ok) {
					throw new Error("Authentication check failed");
				}
				const data = await res.json();
				if (data.authenticated && data.user) {
					setUser(data.user);
				} else {
					router.replace("/login?from=/leaderboard");
				}
			} catch (err) {
				console.error("Auth check error:", err);
				router.replace("/login?from=/leaderboard");
			}
		}

		checkAuth();
	}, [router]);

	const fetchLeaderboard = async (isRefresh = false) => {
		try {
			if (isRefresh) {
				setRefreshing(true);
			} else {
				setLoading(true);
			}
			setError("");

			const res = await fetch("/api/leaderboard", {
				cache: "no-store",
				headers: {
					"Cache-Control": "no-cache",
				},
			});

			if (!res.ok) {
				throw new Error("Failed to fetch leaderboard");
			}
			const data = await res.json();
			setLeaderboard(data.data || []);
		} catch (err: any) {
			setError(err.message || "Failed to load leaderboard");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	useEffect(() => {
		if (user) {
			fetchLeaderboard();
		}
	}, [user]);

	const getRankIcon = (rank: number) => {
		switch (rank) {
			case 1:
				return <Crown className="w-6 h-6 text-yellow-400" />;
			case 2:
				return <Medal className="w-6 h-6 text-gray-400" />;
			case 3:
				return <Award className="w-6 h-6 text-amber-600" />;
			default:
				return null;
		}
	};

	const getRankBadgeColor = (rank: number) => {
		switch (rank) {
			case 1:
				return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-black";
			case 2:
				return "bg-gradient-to-r from-gray-300 to-gray-500 text-black";
			case 3:
				return "bg-gradient-to-r from-amber-600 to-amber-800 text-white";
			default:
				return "bg-gray-800 text-white";
		}
	};

	const getRowStyle = (rank: number, isCurrentUser: boolean) => {
		let baseStyle = "transition-all duration-200 ";

		if (isCurrentUser) {
			baseStyle += "bg-red-900/20 border-l-4 border-red-600 ";
		} else if (rank === 1) {
			baseStyle += "bg-yellow-900/10 hover:bg-yellow-900/20 ";
		} else if (rank === 2) {
			baseStyle += "bg-gray-800/30 hover:bg-gray-800/50 ";
		} else if (rank === 3) {
			baseStyle += "bg-amber-900/10 hover:bg-amber-900/20 ";
		} else {
			baseStyle += "bg-gray-900/30 hover:bg-gray-800/50 ";
		}

		return baseStyle;
	};

	// Filter leaderboard by user ID search
	const filteredLeaderboard = leaderboard.filter(
		(entry) =>
			userIdSearch === "" ||
			entry.user_id.toLowerCase().includes(userIdSearch.toLowerCase()) ||
			entry.name.toLowerCase().includes(userIdSearch.toLowerCase())
	);

	return (
		<div className="min-h-screen bg-black">
			<Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />

			<main className="max-w-7xl mx-auto px-6 py-12">
				<div className="mb-12">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
						<div>
							<div className="flex items-center gap-4 mb-3">
								<Trophy className="w-10 h-10 text-red-600" />
								<h1 className="text-white text-4xl font-bold">Leaderboard</h1>
							</div>
							<p className="text-gray-400 text-lg">
								See how you rank against other hackers in the arena
							</p>
						</div>
						{/* User ID Search Bar */}
						<div className="relative w-full sm:w-auto">
							<input
								type="text"
								placeholder="Search by user ID or name..."
								value={userIdSearch}
								onChange={(e) => setUserIdSearch(e.target.value)}
								className="bg-gray-900 text-white border border-gray-700 rounded-lg pl-4 pr-4 py-2.5 w-full sm:w-64 focus:outline-none focus:border-red-600 transition-colors"
							/>
							{userIdSearch && (
								<button
									onClick={() => setUserIdSearch("")}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
									✕
								</button>
							)}
						</div>
					</div>

					{/* Refresh Button */}
					{!loading && (
						<div className="flex justify-end mb-6">
							<button
								onClick={() => fetchLeaderboard(true)}
								disabled={refreshing}
								className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium
                  transition-all duration-200 transform
                  ${
										refreshing
											? "bg-gray-800 text-gray-400 cursor-not-allowed"
											: "bg-red-600 text-white hover:bg-red-700 hover:scale-105 active:scale-95"
									}
                  border border-gray-700 shadow-lg
                `}>
								<RefreshCw
									className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
								/>
								<span className="font-semibold">
									{refreshing ? "Refreshing..." : "Refresh Leaderboard"}
								</span>
							</button>
						</div>
					)}
				</div>

				{loading ? (
					<div className="flex items-center justify-center py-20">
						<div className="text-center">
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
							<p className="text-gray-400">Loading leaderboard...</p>
						</div>
					</div>
				) : error ? (
					<div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
						<p className="text-red-400 text-lg">{error}</p>
					</div>
				) : leaderboard.length === 0 ? (
					<div className="text-center py-12">
						<Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
						<h3 className="text-white text-xl font-semibold mb-2">
							No Data Yet
						</h3>
						<p className="text-gray-400">
							Complete challenges to earn points and appear on the leaderboard!
						</p>
					</div>
				) : filteredLeaderboard.length === 0 ? (
					<div className="text-center py-12">
						<Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
						<h3 className="text-white text-xl font-semibold mb-2">
							No Results Found
						</h3>
						<p className="text-gray-400">
							No users match the search "{userIdSearch}"
						</p>
					</div>
				) : (
					<>
						{/* Top 3 Podium - Desktop Only */}
						<div className="hidden lg:grid grid-cols-3 gap-6 mb-12">
							{filteredLeaderboard.slice(0, 3).map((entry, index) => {
								const positions = [1, 0, 2]; // Silver, Gold, Bronze order for visual appeal
								const actualEntry =
									index === 0
										? filteredLeaderboard[1]
										: index === 1
										? filteredLeaderboard[0]
										: filteredLeaderboard[2];
								if (!actualEntry) return null;

								return (
									<div
										key={actualEntry.user_id}
										className={`${
											index === 1 ? "transform -translate-y-4" : ""
										}`}>
										<div
											className={`bg-gray-900 border ${
												actualEntry.rank === 1
													? "border-yellow-600"
													: actualEntry.rank === 2
													? "border-gray-400"
													: "border-amber-600"
											} rounded-xl p-6 text-center`}>
											<div className="flex justify-center mb-4">
												{getRankIcon(actualEntry.rank)}
											</div>
											<div
												className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${getRankBadgeColor(
													actualEntry.rank
												)} text-2xl font-bold mb-4`}>
												{actualEntry.rank}
											</div>
											<h3 className="text-white font-semibold text-lg mb-1">
												{actualEntry.name}
											</h3>
											<p className="text-gray-400 text-sm mb-3">
												{actualEntry.user_id}
											</p>
											<div className="bg-black/50 rounded-lg px-4 py-2">
												<p className="text-red-400 text-2xl font-bold">
													{actualEntry.total_score}
												</p>
												<p className="text-gray-500 text-xs">points</p>
												<p className="text-gray-500 text-xs mt-1">
													{actualEntry.challenges_solved} solved
												</p>
											</div>
										</div>
									</div>
								);
							})}
						</div>

						{/* Leaderboard Table */}
						<div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="bg-black border-b border-gray-800">
											<th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
												Rank
											</th>
											<th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
												Name
											</th>
											<th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
												User ID
											</th>
											<th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
												Score / Solved
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-800">
										{filteredLeaderboard.map((entry) => {
											const isCurrentUser = user?.user_id === entry.user_id;

											return (
												<tr
													key={entry.user_id}
													className={getRowStyle(entry.rank, isCurrentUser)}>
													<td className="px-4 sm:px-6 py-4 whitespace-nowrap">
														<div className="flex items-center gap-3">
															{entry.rank <= 3 && (
																<div className="flex-shrink-0">
																	{getRankIcon(entry.rank)}
																</div>
															)}
															<span
																className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${getRankBadgeColor(
																	entry.rank
																)} text-sm font-bold`}>
																{entry.rank}
															</span>
														</div>
													</td>
													<td className="px-4 sm:px-6 py-4 whitespace-nowrap">
														<div className="flex items-center">
															<div>
																<div className="text-white font-medium">
																	{entry.name}
																	{isCurrentUser && (
																		<span className="ml-2 px-2 py-1 bg-red-600 text-white text-xs rounded-full">
																			You
																		</span>
																	)}
																</div>
															</div>
														</div>
													</td>
													<td className="px-4 sm:px-6 py-4 whitespace-nowrap">
														<span className="text-gray-400">
															{entry.user_id}
														</span>
													</td>
													<td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
														<div>
															<span className="text-red-400 text-lg font-semibold">
																{entry.total_score}
															</span>
															<span className="text-gray-500 text-sm ml-1">
																pts
															</span>
														</div>
														<div className="text-gray-500 text-xs mt-1">
															{entry.challenges_solved} solved
														</div>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>

						{/* Stats Footer */}
						<div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
								<p className="text-gray-400 text-sm mb-2">
									{userIdSearch ? "Filtered Results" : "Total Participants"}
								</p>
								<p className="text-white text-3xl font-bold">
									{userIdSearch
										? filteredLeaderboard.length
										: leaderboard.length}
								</p>
							</div>
							{user && leaderboard.find((e) => e.user_id === user.user_id) && (
								<>
									<div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
										<p className="text-gray-400 text-sm mb-2">Your Rank</p>
										<p className="text-red-400 text-3xl font-bold">
											#
											{
												leaderboard.find((e) => e.user_id === user.user_id)
													?.rank
											}
										</p>
									</div>
									<div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
										<p className="text-gray-400 text-sm mb-2">Your Score</p>
										<p className="text-white text-3xl font-bold">
											{
												leaderboard.find((e) => e.user_id === user.user_id)
													?.total_score
											}
										</p>
									</div>
								</>
							)}
						</div>
					</>
				)}
			</main>
		</div>
	);
}
