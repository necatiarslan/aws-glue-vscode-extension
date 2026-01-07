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

list-step-functions:
    aws --endpoint-url=http://localhost:4566 stepfunctions list-state-machines

add-step-function:
    aws --endpoint-url=http://localhost:4566 stepfunctions create-state-machine \
    --name my_step_function \
    --definition file://test/my_step_function.json \
    --role-arn arn:aws:iam::000000000000:role/DummyRole

trigger-step-function:
    aws --endpoint-url=http://localhost:4566 stepfunctions start-execution \
    --state-machine-arn arn:aws:states:us-east-1:000000000000:stateMachine:my_step_function

list-step-function-executions:
    aws --endpoint-url=http://localhost:4566 stepfunctions list-executions \
    --state-machine-arn arn:aws:states:us-east-1:000000000000:stateMachine:my_step_function

list-cloudwatch-logs:
    aws --endpoint-url=http://localhost:4566 logs describe-log-groups