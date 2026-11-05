#!/usr/bin/env bash
# One-time: install the GitHub Actions runner ON the EC2 server (run there as ubuntu).
# Get the token: GitHub repo -> Settings -> Actions -> Runners -> New self-hosted runner
# (copy the value after --token; it is valid for 1 hour).
# Usage on the server: bash setup-github-runner.sh <TOKEN>
set -euo pipefail

TOKEN="${1:?Usage: bash setup-github-runner.sh <TOKEN>}"
REPO_URL="https://github.com/MobeenAshiq/logic-lab"
DIR="$HOME/actions-runner"

case "$(uname -m)" in
  aarch64|arm64) ARCH=arm64 ;;
  x86_64) ARCH=x64 ;;
  *) echo "Unsupported CPU: $(uname -m)" >&2; exit 1 ;;
esac

VERSION=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
  | grep -m1 '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
echo "• Installing GitHub runner $VERSION ($ARCH) in $DIR"
mkdir -p "$DIR" && cd "$DIR"
curl -fsSL -o runner.tar.gz \
  "https://github.com/actions/runner/releases/download/v${VERSION}/actions-runner-linux-${ARCH}-${VERSION}.tar.gz"
tar xzf runner.tar.gz && rm runner.tar.gz

./config.sh --unattended --replace --url "$REPO_URL" --token "$TOKEN" \
  --name logiclab-ec2 --labels logiclab --work _work

# Run as a service (starts on boot), as this user so pnpm/pm2 work like your SSH sessions.
sudo ./svc.sh install "$USER"
sudo ./svc.sh start
echo "✅ Runner installed. It should show as Idle under Settings -> Actions -> Runners."
