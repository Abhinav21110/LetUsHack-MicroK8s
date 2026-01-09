module.exports = {
	apps: [
		{
			name: "Basic-site",
			cwd: "/home/letushack/Prod/basic-website-gitea",
			script: "npm",
			args: "run start",
			env: {
				NODE_ENV: "production",
			},
		},
	],
};
