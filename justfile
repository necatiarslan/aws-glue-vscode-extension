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