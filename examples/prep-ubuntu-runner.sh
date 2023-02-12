##
# This script prepares an ubuntu instance to a custom github runner.
# You can prep your AMI manually, or use Packer or EC2 Image Builder.
##

##
# Required: Update apt-get
##
sudo apt-get update

##
# Optional: Install any other dependencies your workload needs.
# In this example we're installing `git` and `docker` but you might not need it.
# If you use actions/checkout to pull your repository down, you'll need git.
##
sudo apt-get install -y git
sudo apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release
sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo chmod a+r /etc/apt/keyrings/docker.gpg
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

##
# Required: Install Github actions runner software.
# This action assumes the runner software is already installed.
##
mkdir actions-runner
cd actions-runner
case $(uname -m) in aarch64) ARCH="arm64" ;; amd64|x86_64) ARCH="x64" ;; esac && export RUNNER_ARCH=${ARCH}
curl -o actions-runner-linux-${RUNNER_ARCH}-2.301.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.301.1/actions-runner-linux-${RUNNER_ARCH}-2.301.1.tar.gz
tar xzf ./actions-runner-linux-${RUNNER_ARCH}-2.301.1.tar.gz
