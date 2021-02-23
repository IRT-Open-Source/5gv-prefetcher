# syntax=docker/dockerfile:experimental
FROM node:latest
RUN echo "version:0.0.2"
WORKDIR /usr/prefetcher
COPY ./*.json ./
# Add git server to list of known hosts. This is needed for installation
# of npm packages from private repositories 
RUN mkdir -p -m 0600 ~/.ssh && ssh-keyscan gitlab.irt.de >> ~/.ssh/known_hosts
# The below line uses two key features to install npm packages from private repositories 
# 1. '--mount=type=ssh,id=gitlab': Temporarly (only during runtime of this run command)
#    mounts the ssh key needed to authenticate at the private git repository. The 
#    ssh key will not be available in any build image or intermediate docker layer!
#    This feature is an experimental docker feature (the first comment in this script
#    tells docker to switch to experimental mode). The value of variable gitlab is specified
#    in the docker command:
#    $ docker build --ssh gitlab="$HOME/.ssh/<<name_of_your_public_key>>" -t aggregator:latest .
# 2. 'npm config set unsafe-perm true' needed to allow npm executing prepare scripts 
#    in package.json files of private repositories (i.e. 'messenger' and '5gv-dto')
#    see: https://github.com/npm/npm/issues/17346
RUN --mount=type=ssh,id=gitlab npm config set unsafe-perm true && npm install
RUN npm i -g @nestjs/cli
