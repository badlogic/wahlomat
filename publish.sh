#!/bin/bash
set -e
npm run build
host=slayer.marioslab.io
host_dir=/home/badlogic/wahlomat.mariozechner.at
current_date=$(date "+%Y-%m-%d %H:%M:%S")
commit_hash=$(git rev-parse HEAD)
echo "{\"date\": \"$current_date\", \"commit\": \"$commit_hash\"}" > html/version.json

ssh -t $host "mkdir -p $host_dir/docker/data/postgres"
# Create .env file locally in docker directory
cat > docker/.env << EOF
WAHLOMAT_DB=$WAHLOMAT_DB
WAHLOMAT_DB_USER=$WAHLOMAT_DB_USER
WAHLOMAT_DB_PASSWORD=$WAHLOMAT_DB_PASSWORD
EOF

rsync -avz --exclude .venv --exclude preprocessing --exclude node_modules --exclude .git --exclude docker/data ./ $host:$host_dir

if [ "$1" == "server" ]; then
    echo "Publishing client & server"
    ssh -t $host "cd $host_dir && ./docker/control.sh stop && ./docker/control.sh start && ./docker/control.sh logs"
else
    echo "Publishing client only"
fi