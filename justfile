package:
    vsce package
    mv *.vsix ./vsix/

build:
    vsce package
    mv *.vsix ./vsix/

publish:
    vsce publish

npm-doctor:
    npm doctor # check dependencies
    npm prune # remove unused dependencies
    npx depcheck # check dependencies
    npm-check # check dependencies


npm-outdated:
    npm outdated
    npx npm-check-updates

npm-update:
    npm update

npm-install:
    rm -rf node_modules package-lock.json
    npm install
    npx tsc --noEmit


list-cloudwatch-logs:
    aws --endpoint-url=http://localhost:4566 logs describe-log-groups

create-glue-job:
    aws --endpoint-url=http://localhost:4566 glue create-job \
    --name job1 \
    --role arn:aws:iam::000000000000:role/glue-role \
    --command '{"Name": "pythonshell", "ScriptLocation": "s3://my-bucket/glue-test/job.py"}'

list-glue-jobs:
    aws --endpoint-url=http://localhost:4566 glue list-jobs

start-glue-job:
    aws --endpoint-url=http://localhost:4566 glue start-job-run --job-name job1

stop-glue-job:
    aws --endpoint-url=http://localhost:4566 glue stop-job-run --job-name job1

get-glue-job:
    aws --endpoint-url=http://localhost:4566 glue get-job --job-name job1

get-glue-job-run:
    aws --endpoint-url=http://localhost:4566 glue get-job-run --job-name job1 --job-run-id jr_3d9a474c51c77df0bb718c777b93e7aa5779451fa65ee076e8663b6b07d3a8f5

get-glue-job-runs:
    aws --endpoint-url=http://localhost:4566 glue get-job-runs --job-name job1
    