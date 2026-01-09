Overview

CSRF_docker is a dockerised environment built to facilitate the deployment, testing and demonstration of Cross-Site Request Forgery (CSRF) labs. It provides a self-contained, easy-to-run image which sets up the required web application(s) and environment so you can explore CSRF vulnerabilities in a controlled setting.

This repository is maintained by the Talos-Sentries101 and aims to simplify lab setup for security training.

Features

Preconfigured environment tailored for CSRF vulnerabilities

Single Docker image & accompanying docker-compose.yml to simplify startup

.env configuration support to quickly adjust runtime parameters

Lightweight setup—ideal for local testing or classroom/lab use

Getting Started
Prerequisites

Before you run the lab environment, make sure you have:

Docker
 (version 18+ recommended)
Docker Compose
 (if using docker-compose.yml)

A machine with sufficient resources (e.g., at least 1-2 GB free RAM)

Installation

Clone the repository:

git clone https://github.com/Talos-Sentries101/CSRF_docker.git  
cd CSRF_docker  


(Optional) Copy or review the environment configuration file:

cp .env.docker .env  


Then edit .env if you wish to override defaults.

Build and start the Docker image:

docker build -t csrf_lab_image .  
docker run --rm -p 8080:80 csrf_lab_image  


Or using Docker Compose:

docker-compose up --build  

Usage

Once container(s) are running, open your browser and navigate to http://localhost:8080 (or the port you configured) to begin interacting with the CSRF lab environment.

You may see multiple endpoints or deliberate vulnerability scenarios. Use this to practice exploitation or defence techniques in a sandbox.

When done, stop the container(s):

docker-compose down  


or

docker stop <container_id>  

Project Structure
/
├─ public/                 ← Static web assets (HTML, CSS, JS) for the lab
├─ src/                    ← Source code for the web application(s) used in the lab
├─ Dockerfile              ← Docker build instructions
├─ docker-compose.yml      ← Compose configuration (multi-container, if applicable)
├─ .env.docker             ← Default environment configuration for Docker run
├─ .dockerignore           ← Files ignored when building Docker image
└─ README.md               ← This file


Feel free to inspect src/ and public/ to understand how the lab has been built and how the vulnerability scenarios are structured.

Configuration

You can adjust the behaviour of the lab by editing the .env file. Example variables might include:

APP_PORT — sets the port inside the container

EXTERNAL_PORT — the port exposed to host machine

DEBUG — enable/disable verbose logging

LAB_SCENARIO — choose which CSRF scenario to launch

Note: After changing configuration, rebuild or restart the containers to apply the new settings.